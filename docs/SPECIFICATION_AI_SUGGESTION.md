# MACHO - AIメニュー提案機能 仕様書

> 親仕様書: [SPECIFICATION.md](./SPECIFICATION.md)
> 本書は「8. 将来拡張 / ChatGPT メニュー提案機能」の詳細仕様。

## 1. 機能概要

ユーザーの目標・レベル・直近のワークアウト履歴を踏まえて、ChatGPT (OpenAI API) が次回のおすすめメニューを提案する機能。提案結果はテンプレートとして保存でき、後の記録作成に再利用できる。

| 項目 | 内容 |
|------|------|
| モデル | GPT-5 mini (コスト効率重視) |
| 利用条件 | 許可リストに登録されたユーザーのみ |
| レート上限 | 1日10回 / 月100回 (個別) |
| 全体上限 | 月3,000コール (環境変数で設定) |
| エンドポイント | `POST /api/suggest`, `POST /api/templates` |

想定コスト: 1回あたり約 $0.00125（入力1000+出力500トークン換算）。月100回/人でも約19円/人。GPT-4o-miniより高いが許可リスト運用なら無視できる額。

## 2. 設計上の重要原則

### 2.1 コスト暴走への多層防御

| レイヤー | 仕組み | 役割 |
|----------|--------|------|
| ① 許可リスト | `user_profiles.ai_suggestion_enabled` フラグ | 初期は開発者のみtrue。Supabase管理画面で手動許可 |
| ② 個別レート制限 | `ai_suggestion_logs` 集計 | 1日10回・月100回まで |
| ③ グローバルキャップ | 環境変数 `MONTHLY_AI_CALL_LIMIT` | 全体で月3,000コール超過したら全停止 |
| ④ キャッシュ | 同一入力ハッシュ・1時間以内なら前回結果を返す | 連打防止 |
| ⑤ トークン上限 | `max_tokens=1000` | 1回あたりのコスト上限 |

すべてのチェックは **API Route 側で実行**。フロントのみのチェックは信用しない。

### 2.2 目標ベースのパーソナライズ

初回ログイン時にオンボーディングでヒアリング → `user_profiles` に保存 → 提案リクエスト時にプロンプトへ自動注入。設定画面からいつでも編集可。

## 3. データモデル追加

### 3.1 `user_profiles` (新規)

| カラム | 型 | デフォルト | 説明 |
|--------|----|----|------|
| user_id | uuid (PK, FK → auth.users) | - | |
| training_goal | text | NULL | `hypertrophy` / `strength` / `fat_loss` / `maintenance` |
| experience_level | text | NULL | `beginner` / `intermediate` / `advanced` |
| weekly_frequency | int | NULL | 週のトレーニング頻度 (1-7) |
| focus_muscle_group_ids | uuid[] | `{}` | 重点部位 (muscle_groups.id の配列) |
| ai_suggestion_enabled | boolean | `false` | 提案機能の使用可否 |
| onboarding_completed | boolean | `false` | オンボーディング完了フラグ |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

### 3.2 `workout_templates` (新規)

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| name | text | 例: 「AI提案 - 胸の日 (06/24)」 |
| source | text | `ai_suggestion` / `manual` |
| source_log_id | uuid (FK, nullable) | `ai_suggestion_logs.id` への参照 |
| created_at | timestamptz | |

### 3.3 `template_exercises` (新規)

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid (PK) | |
| template_id | uuid (FK) | |
| exercise_name | text | |
| muscle_group_id | uuid (FK) | |
| muscle_sub_group_id | uuid (FK, nullable) | |
| equipment_id | uuid (FK, nullable) | |
| target_sets | int | 推奨セット数 |
| target_reps | int | 推奨回数 |
| target_weight_kg | decimal (nullable) | 推奨重量 |
| notes | text (nullable) | AIからの一言コメント |
| sort_order | int | |

### 3.4 `ai_suggestion_logs` (新規)

| カラム | 型 | 説明 |
|--------|----|------|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| input_hash | text | リクエスト内容のSHA-256 (キャッシュ判定用) |
| request_payload | jsonb | リクエスト内容 |
| response_payload | jsonb (nullable) | レスポンス内容 (キャッシュ・テンプレ保存用) |
| prompt_tokens | int (nullable) | |
| completion_tokens | int (nullable) | |
| total_tokens | int (nullable) | |
| cost_usd | decimal (nullable) | 推定コスト (USD) |
| status | text | `success` / `cached` / `rate_limited` / `forbidden` / `error` |
| error_message | text (nullable) | |
| created_at | timestamptz | |

## 4. RLS (Row Level Security)

| テーブル | ポリシー |
|----------|----------|
| `user_profiles` | 本人のみ SELECT/UPDATE。INSERTはトリガで自動作成 |
| `workout_templates` | 本人のみ CRUD |
| `template_exercises` | template経由で本人のみ CRUD |
| `ai_suggestion_logs` | 本人のみ SELECT。書き込みは Service Role キー経由のみ |

`ai_suggestion_enabled` は本人が変更不可（管理者のみ）→ 別途 admin ロールまたは Supabase 管理画面で手動編集。

## 5. オンボーディング画面

### 5.1 表示条件
ログイン後、`user_profiles.onboarding_completed = false` ならオンボーディングへ強制リダイレクト。

### 5.2 ステップ構成（4ステップ ウィザード）

| ステップ | タイトル | 入力 | UI |
|---------|---------|------|-----|
| 1 | トレーニングの目的は？ | 単一選択 | 4枚の大きなカード |
| 2 | レベルは？ | 単一選択 | 3枚のカード |
| 3 | 週に何回トレーニングしますか？ | 1〜7 | セレクター/ボタン |
| 4 | 特に鍛えたい部位は？(複数選択可・スキップ可) | 部位の複数選択 | 部位カラーのチップ |

**選択肢:**
- 目的: 筋肥大 / 筋力向上 / 減量 / 健康維持
- レベル: 初心者 / 中級者 / 上級者

完了時:
1. `user_profiles` を UPSERT (`onboarding_completed = true`)
2. ダッシュボードへ遷移

### 5.3 設定からの編集
ダッシュボード右上のアバター → 「プロフィール設定」から同じ項目をいつでも編集可能。

## 6. AI提案画面

### 6.1 起動導線
ダッシュボードの「AIメニュー提案」カードをタップ → 提案画面へ。
※ `ai_suggestion_enabled = false` の場合はカード自体に「準備中」バッジを表示しタップ不可。

### 6.2 提案画面の構成

| エリア | 内容 |
|--------|------|
| ヘッダー | 「AIメニュー提案」 + 残り回数表示 (例: 今日 7/10 回利用可) |
| 部位選択 | 鍛えたい部位 (複数選択、デフォルト = プロファイルの重点部位) |
| テーマ入力 (任意) | 自由記述。例: 「軽め」「ハードに」「時間がない」 |
| 生成ボタン | 「提案を生成」 |

### 6.3 生成後の画面

| エリア | 内容 |
|--------|------|
| 全体コメント | AIからの一言（例: 「胸メインの中強度メニューです」） |
| 種目カード一覧 | 各種目の `exercise_name` / `target_sets×target_reps@weight` / `notes` |
| アクション | 「テンプレートとして保存」/「閉じる」/「再生成」 |

「再生成」もレート消費する旨を表示。

## 7. テンプレート画面

### 7.1 一覧
- AI提案 + 手動テンプレを `created_at desc` で一覧
- フィルタ: 全て / AI提案 / 手動
- カード: 名前 / source バッジ / 種目数 / 作成日

### 7.2 詳細
- 種目リストを表示
- アクション:
  - 「このメニューで記録開始」→ 記録画面に事前入力された状態で遷移
  - 「削除」

### 7.3 記録画面への引き継ぎ
記録画面 (`/record`) は `?template_id=...` クエリを受け付け、テンプレ内容を初期値として展開する。ユーザーが重量・回数を微調整して「ワークアウトを保存」で確定。

## 8. API設計

### 8.1 `POST /api/suggest`

**リクエスト:**
```json
{
  "target_muscle_group_ids": ["uuid1", "uuid2"],
  "theme": "軽め"
}
```

**サーバー処理フロー:**
1. 認証チェック (Supabase Auth) → 未認証なら 401
2. `user_profiles.ai_suggestion_enabled` 確認 → false なら 403 (`status=forbidden` でログ)
3. 個別レート制限チェック (当日10回 / 当月100回) → 超過なら 429 (`status=rate_limited` でログ)
4. グローバルキャップチェック (全ユーザー当月3,000コール) → 超過なら 503
5. `input_hash = sha256(user_id + sorted_target_ids + theme)` 算出
6. キャッシュチェック: 同 `input_hash` の `status=success` レコードが過去1時間以内にあれば、その `response_payload` を返却 (`status=cached` で新ログ追加)
7. 直近2週間の `workouts` + `user_profiles` を取得
8. OpenAI API 呼び出し (`gpt-5-mini`, `response_format=json_object`, `max_tokens=1000`)
9. レスポンスをスキーマ検証
10. `ai_suggestion_logs` に記録 (tokens, cost_usd, response_payload, status=success)
11. レスポンス返却

**レスポンス:**
```json
{
  "suggestion_id": "uuid",
  "overall_comment": "胸メインの中強度メニューです",
  "exercises": [
    {
      "exercise_name": "ベンチプレス",
      "muscle_group_id": "uuid",
      "muscle_sub_group_id": "uuid",
      "equipment_id": "uuid",
      "target_sets": 4,
      "target_reps": 8,
      "target_weight_kg": 60.0,
      "notes": "前回より2.5kg増を試してみましょう"
    }
  ],
  "usage": {
    "remaining_today": 6,
    "remaining_this_month": 87
  }
}
```

**エラーレスポンス:**
```json
{ "error": "rate_limit_exceeded", "message": "本日の上限(10回)に達しました", "reset_at": "2026-06-25T00:00:00Z" }
```

### 8.2 `POST /api/templates`

**リクエスト:**
```json
{
  "name": "AI提案 - 胸の日 (06/24)",
  "source": "ai_suggestion",
  "source_log_id": "uuid",
  "exercises": [ /* template_exercises と同形式 */ ]
}
```

**処理:**
- トランザクションで `workout_templates` + `template_exercises` を INSERT

**レスポンス:**
```json
{ "template_id": "uuid" }
```

### 8.3 `GET /api/templates`
- 自分のテンプレート一覧

### 8.4 `DELETE /api/templates/:id`
- 自分のテンプレート削除

## 9. プロンプト設計（雛形）

### System
```
あなたは筋トレメニュー提案AIです。
ユーザーの目的・レベル・直近の履歴を踏まえて、安全で効果的な次回メニューを提案してください。
- 初心者には複雑すぎる種目を避ける
- 直近で同じ部位を高強度で鍛えていたら回復を考慮する
- 必ず指定されたJSONスキーマで返答する
- 種目数は3〜5種目に収める
```

### User
```
# ユーザープロファイル
- 目的: {training_goal}
- レベル: {experience_level}
- 週の頻度: {weekly_frequency}回
- 重点部位: {focus_muscle_groups_label}

# 今回鍛えたい部位
{target_muscle_groups_label}

# 直近2週間のワークアウト履歴
{recent_workouts_summary}

# 今日のテーマ (任意)
{theme}

# 利用可能な部位ID / サブカテゴリID / 器具ID 一覧
{master_data}

上記を踏まえ、JSON形式でメニューを提案してください。
muscle_group_id / muscle_sub_group_id / equipment_id は必ず提示された一覧から選んでください。
```

### Response Schema (JSON Mode)
```json
{
  "overall_comment": "string",
  "exercises": [
    {
      "exercise_name": "string",
      "muscle_group_id": "uuid",
      "muscle_sub_group_id": "uuid | null",
      "equipment_id": "uuid | null",
      "target_sets": "integer",
      "target_reps": "integer",
      "target_weight_kg": "number | null",
      "notes": "string | null"
    }
  ]
}
```

## 10. 環境変数

| キー | 例 | 説明 |
|------|----|------|
| `OPENAI_API_KEY` | `sk-...` | OpenAI APIキー (サーバー専用) |
| `OPENAI_MODEL` | `gpt-5-mini` | 使用モデル |
| `MONTHLY_AI_CALL_LIMIT` | `3000` | 全体の月次キャップ |
| `AI_CACHE_TTL_HOURS` | `1` | キャッシュTTL |
| `AI_PENDING_RESERVATION_TTL_MINUTES` | `15` | pending予約を利用枠に含める時間 |
| `AI_MAX_TOKENS` | `3000` | 1回の最大出力トークン数 |

## 11. 観測・運用

### 11.1 監視ポイント
- `ai_suggestion_logs` の日次集計 (Supabase の `count`, `sum(cost_usd)`)
- `status` 別の内訳 (success / cached / rate_limited / error)
- グローバル使用量（月次キャップに対する消化率）

### 11.2 簡易管理ビュー（将来）
- 開発者向けの `/admin/usage` ページ
- ユーザー別の利用回数、月次総コスト、エラー率を表示

## 12. 将来の課金移行計画

| フェーズ | アクセス制御 |
|---------|-------------|
| Phase 1 (今回) | 許可リスト方式 (`ai_suggestion_enabled`) |
| Phase 2 | `user_profiles.subscription_tier` を追加 (`free` / `pro` / `unlimited`) |
| Phase 3 | Stripe 連携、tier に応じてレート上限を動的変更 |

移行時:
- Phase 1 で許可されているユーザーは `tier = pro` 相当に自動移行
- `free` は提案機能なし or 月3回などの試用枠

## 13. 実装スコープ（このフェーズで作るもの）

1. ✅ `user_profiles` / `workout_templates` / `template_exercises` / `ai_suggestion_logs` のマイグレーション
2. ✅ オンボーディング画面 (4ステップ)
3. ✅ プロフィール設定画面
4. ✅ AI提案画面 (入力 + 結果表示)
5. ✅ テンプレート一覧/詳細画面
6. ✅ 記録画面のテンプレート読み込み対応
7. ✅ `/api/suggest` エンドポイント (多層防御 + キャッシュ)
8. ✅ `/api/templates` CRUDエンドポイント
9. ✅ RLSポリシー

スコープ外:
- 課金連携 (Stripe等)
- admin画面
- 利用状況の可視化ダッシュボード
