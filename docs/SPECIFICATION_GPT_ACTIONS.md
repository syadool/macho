# MACHO - ChatGPT連携 (Custom GPT Actions) 仕様書

> 親仕様書: [SPECIFICATION.md](./SPECIFICATION.md)
> 本書は、顧客のChatGPTがMACHOのトレーニングデータを自動取得・分析できるようにする
> Custom GPT Actions 連携機能の仕様。**実装済み**（`/api/gpt/*` + APIキー管理画面）。

---

## 1. 背景・目的

現在AI機能（メニュー提案）は自前で提供しているが、顧客が普段使っているChatGPT上で
自分のトレーニングデータを分析させたいというニーズに応えるための試験的な仕組み。

毎回データをアップロードするのは手間なので、ChatGPT（Custom GPT）が必要な時に
自動でMACHOのAPIを呼び出してデータを取得する「Actions」方式を採用する。

### 1.1 検討した代替案と選定理由

| 方式 | 実装コスト | 利用側の手間 | 利用側の制約 |
|------|-----------|-------------|-------------|
| CSV/JSONエクスポート＋手動アップロード | 低 | 毎回手動 | なし（無料プランでも可） |
| **Custom GPT Actions（採用）** | 中 | 不要（自動） | ChatGPT Plus以上が必要 |
| MCP（Model Context Protocol） | 高（OAuth 2.1、SSE/Streamable HTTP） | 不要（自動） | ChatGPT Plus以上＋カスタムコネクタ対応プラン |

Actionsは通常のREST API + OpenAPIスキーマで実装できるため、Vercelのサーバーレス環境と
相性が良く、MCPのような長時間接続やOAuthサーバーの実装が不要。試験導入にはこちらが適している。

---

## 2. 認証方式

既存の認証（`src/lib/supabase/server.ts` の `createClient()` / `requireUser()`）は
Cookieベースのセッションであり、ChatGPTからは利用できない。そのため**専用のAPIキー方式**を
別レイヤーとして追加する。

### 2.1 `api_keys` テーブル

```sql
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash      TEXT NOT NULL UNIQUE,       -- SHA-256ハッシュ
  key_prefix    CHAR(12) NOT NULL,           -- 表示用 "macho_a1b2..."
  name          TEXT NOT NULL DEFAULT 'ChatGPT',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at  TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own keys" ON api_keys
  FOR ALL USING (user_id = auth.uid());
```

- キー形式: `macho_` + 32文字ランダムhex
- 発行時のみ平文を表示し、以後はハッシュのみ保存（再表示不可）
- ユーザーがいつでも失効（DELETE）できるようにする

### 2.2 認証ミドルウェア (`src/lib/gpt/auth.ts`)

```typescript
export async function authenticateGptRequest(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.match(/^Bearer (.+)$/)?.[1];
  if (!token?.startsWith("macho_")) return null;

  const hash = sha256(token);
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("user_id")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!data) return null;

  // last_used_at は fire-and-forget で更新
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hash);

  return data.user_id;
}
```

- service role client（`src/lib/supabase/admin.ts` の `createAdminClient()`）を使用するため
  RLSをバイパスし、`user_id` で明示的にスコープする
- 既存の `requireApiOnboardedUser()` パターンとは別系統（Cookie前提のため流用不可）

---

## 3. APIエンドポイント（すべて読み取り専用）

書き込み系は提供しない。APIキー漏洩時の被害を「読み取りのみ」に限定するため。

| エンドポイント | 用途 | 主な返却データ |
|---|---|---|
| `GET /api/gpt/profile` | ユーザー情報 | training_goal, experience_level, weekly_frequency, focus_muscle_group_ids |
| `GET /api/gpt/workouts?days=30&limit=50` | トレーニング記録 | 日付、種目、部位、器具、重量、回数、カーディオ |
| `GET /api/gpt/stats?days=30` | 集計済み統計 | 週あたり頻度、部位別ボリューム、重量推移、カーディオ集計 |
| `GET /api/gpt/exercises` | マスタデータ | 筋肉部位（日英）、サブグループ、器具一覧 |
| `GET /api/gpt/openapi.json` | OpenAPIスキーマ配信 | Actions設定用 |

### 3.1 設計判断

- **statsはサーバー側で集計してから返す** — 生データをそのままGPTに渡すよりトークン消費を抑えられる
- **部位名は日英併記** — GPTが英語で応答するケースにも対応
- **レスポンスは既存の深いネスト構造をフラット化** — `src/lib/data.ts` の `WORKOUT_SELECT` 相当の
  ネスト（muscle_groups, equipment, workout_sets...）はそのまま返すとトークンを浪費するため、
  GPT向けには簡略化したシリアライズを別途用意する

### 3.2 `/api/gpt/stats` レスポンス例

```json
{
  "period": { "from": "2026-05-27", "to": "2026-06-26", "days": 30 },
  "summary": {
    "total_sessions": 18,
    "avg_sessions_per_week": 4.2,
    "total_sets": 324,
    "total_exercises": 72
  },
  "volume_by_muscle_group": [
    { "name": "胸", "name_en": "Chest", "total_sets": 64, "total_reps": 580 }
  ],
  "progression": [
    {
      "exercise_name": "ベンチプレス",
      "data_points": [
        { "date": "2026-06-01", "max_weight_kg": 80, "max_reps_at_max_weight": 6 },
        { "date": "2026-06-15", "max_weight_kg": 82.5, "max_reps_at_max_weight": 5 }
      ]
    }
  ],
  "cardio_summary": {
    "total_sessions": 6,
    "total_duration_minutes": 180,
    "total_distance_km": 32.5,
    "total_calories": 1850
  }
}
```

---

## 4. 追加ファイル一覧（実装時）

```
supabase/migrations/XXXXXXXX_api_keys.sql     # api_keys テーブル定義
src/lib/gpt/auth.ts                            # APIキー認証 (authenticateGptRequest)
src/lib/gpt/serialize.ts                       # GPT向けレスポンス整形（フラット化）
app/api/gpt/profile/route.ts
app/api/gpt/workouts/route.ts
app/api/gpt/stats/route.ts
app/api/gpt/exercises/route.ts
app/api/gpt/openapi.json/route.ts              # OpenAPI 3.1 スキーマを動的配信
app/settings/api-keys/                         # APIキー発行・失効UI（未設計・要追加検討）
```

---

## 5. 利用フロー（顧客側）

1. MACHOの設定画面でAPIキーを発行（`macho_xxx`、一度だけ表示）
2. ChatGPTでCustom GPTを作成
3. `/api/gpt/openapi.json` の内容をActionsの「Import from URL」または貼り付けで登録
4. Authentication に「API Key」「Bearer」を選択し、発行したキーを設定
5. ユーザーが「最近のトレーニング傾向を分析して」のように質問
6. GPTが自動で `/api/gpt/stats` 等を呼び出し、回答に反映

---

## 6. 制約・前提・未決事項

- **ChatGPT Plus以上が必要**（Custom GPT作成・利用のため、無料プランは対象外）
- レート制限は当面なし（1ユーザー1キーの個人利用想定）。濫用が見えたら `ai_suggestion_logs` と
  同様の使用量トラッキングを追加検討
- APIキー管理UI（発行・一覧・失効）は未設計。`app/settings/` 配下に追加する想定だが、
  既存の設定画面構成は要確認
- 同じデータ基盤をMCP化する場合は、`src/lib/gpt/` 配下のロジック（特に集計部分）を
  そのまま再利用できるように分離しておく
