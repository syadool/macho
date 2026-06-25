# MACHO - サブスクリプション課金機能 仕様書

> 親仕様書: [SPECIFICATION.md](./SPECIFICATION.md)
> 関連仕様: [SPECIFICATION_AI_SUGGESTION.md](./SPECIFICATION_AI_SUGGESTION.md)（AI提案機能）
> 本書は AI 提案機能の有料化に伴うサブスクリプション課金機能の詳細仕様。

---

## 1. 機能概要

AI メニュー提案機能を段階的に有料化し、Stripe を決済基盤としたサブスクリプション課金を導入する。

| 項目 | 内容 |
|------|------|
| 決済基盤 | Stripe (Checkout Sessions + Customer Portal) |
| 課金モデル | 月額サブスクリプション (4プラン) |
| 通貨 | JPY |
| 対象機能 | AI メニュー提案 (`POST /api/suggest`) |
| フロントエンド決済UI | Stripe Checkout (Stripe ホスト型) |
| 顧客管理UI | Stripe Customer Portal |

---

## 2. プラン設計

### 2.1 プラン一覧

| プラン | 月額 (税込) | AI提案回数/月 | 1回あたり単価 | 備考 |
|--------|------------|--------------|--------------|------|
| **Free** | ¥0 | 10回 | - | 既存ユーザーのデフォルト |
| **Go** | ¥580 | 40回 | ¥14.5 | ライトユーザー向け |
| **Plus** ⭐ | ¥980 | 100回 | ¥9.8 | **おすすめ** (BEST VALUE) |
| **Pro** | ¥1,280 | 200回 | ¥6.4 | ヘビーユーザー向け |

### 2.2 プランごとの制限値マッピング

| プラン | `monthly_ai_limit` | `daily_ai_limit` | 日次上限の考え方 |
|--------|--------------------|--------------------|-----------------|
| Free | 10 | 5 | 月10回を2日で使い切らないよう制限 |
| Go | 40 | 10 | 現行と同じ日次上限 |
| Plus | 100 | 20 | 週5日利用で月100回を余裕で消化可能 |
| Pro | 200 | 30 | 週7日利用でも月200回に到達可能 |

### 2.3 全体コスト試算

| 項目 | 計算 |
|------|------|
| OpenAI コスト/回 | 約 ¥0.19 (GPT-5 mini, ~$0.00125) |
| Pro ユーザー最大コスト/月 | 200回 × ¥0.19 = ¥38 |
| Pro プラン粗利 | ¥1,280 - ¥38 - Stripe手数料 ≈ **¥1,193** (粗利率93%) |
| Stripe 手数料 | 3.6% (日本のカード決済) |

---

## 3. Stripe 設計

### 3.1 Stripe リソース構成

```
Stripe Product: "MACHO AI メニュー提案"
├── Price (Go):   ¥580/月  recurring, interval=month, currency=jpy
├── Price (Plus): ¥980/月  recurring, interval=month, currency=jpy
└── Price (Pro):  ¥1,280/月 recurring, interval=month, currency=jpy
```

> Free プランは Stripe 上に Price を作成しない。サブスクリプションなし = Free として扱う。

### 3.2 Checkout Session の作成

```typescript
const session = await stripe.checkout.sessions.create({
  mode: "subscription",
  customer: stripeCustomerId,     // 既存 Customer があれば指定
  customer_email: userEmail,      // 新規の場合
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${BASE_URL}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${BASE_URL}/settings/billing`,
  subscription_data: {
    metadata: { supabase_user_id: userId },
  },
  metadata: { supabase_user_id: userId },
  locale: "ja",
});
// payment_method_types は指定しない (Dynamic Payment Methods)
```

### 3.3 Customer Portal

ユーザー自身でプラン変更・解約・支払い方法更新を行えるようにする。

```typescript
const portalSession = await stripe.billingPortal.sessions.create({
  customer: stripeCustomerId,
  return_url: `${BASE_URL}/settings/billing`,
});
```

**Portal 設定 (Stripe Dashboard):**
- サブスクリプションの変更: 有効 (即時適用、按分計算)
- サブスクリプションのキャンセル: 有効 (期間終了時に解約)
- 支払い方法の更新: 有効
- 請求履歴の閲覧: 有効

### 3.4 Webhook イベント処理

| イベント | 処理内容 |
|---------|---------|
| `checkout.session.completed` | Stripe Customer ID を `user_profiles` に紐づけ。サブスクリプション情報を同期 |
| `customer.subscription.created` | `subscription_tier` を対応プランに更新。AI利用上限を反映 |
| `customer.subscription.updated` | プラン変更を反映 (アップグレード/ダウングレード) |
| `customer.subscription.deleted` | `subscription_tier` を `free` に戻す。AI利用上限をリセット |
| `invoice.payment_succeeded` | 正常継続。ログ記録 |
| `invoice.payment_failed` | 支払い失敗。Stripe の Smart Retries に任せる。3回失敗でサブスクリプション自動キャンセル |

**Webhook 署名検証:**
```typescript
const event = stripe.webhooks.constructEvent(
  rawBody,
  request.headers.get("stripe-signature")!,
  process.env.STRIPE_WEBHOOK_SECRET!,
);
```

### 3.5 API キー管理

| キー | 用途 | 保管場所 |
|------|------|---------|
| Restricted API Key (`rk_`) | サーバーサイド API 呼び出し | Vercel 環境変数 |
| Publishable Key (`pk_`) | クライアント (不要: Checkout はリダイレクト型) | - |
| Webhook Signing Secret (`whsec_`) | Webhook 署名検証 | Vercel 環境変数 |

> Secret Key (`sk_`) ではなく **Restricted API Key** を使用する。必要最小限の権限のみ付与:
> - `checkout.sessions`: write
> - `billing_portal.sessions`: write
> - `customers`: read/write
> - `subscriptions`: read
> - `prices`: read
> - `products`: read

---

## 4. データモデル変更

### 4.1 `user_profiles` テーブル拡張

| カラム (追加) | 型 | デフォルト | 説明 |
|--------|----|-----------|------|
| `subscription_tier` | text | `'free'` | `free` / `go` / `plus` / `pro` |
| `stripe_customer_id` | text (nullable) | NULL | Stripe Customer ID (`cus_xxx`) |
| `subscription_status` | text | `'none'` | `none` / `active` / `past_due` / `canceled` |
| `subscription_id` | text (nullable) | NULL | Stripe Subscription ID (`sub_xxx`) |
| `current_period_end` | timestamptz (nullable) | NULL | 現在の請求期間終了日 |

**CHECK 制約:**
```sql
ALTER TABLE user_profiles
  ADD CONSTRAINT chk_subscription_tier
    CHECK (subscription_tier IN ('free', 'go', 'plus', 'pro')),
  ADD CONSTRAINT chk_subscription_status
    CHECK (subscription_status IN ('none', 'active', 'past_due', 'canceled'));
```

**RLS 追加ポリシー:**
- `stripe_customer_id`, `subscription_tier`, `subscription_status`, `subscription_id`, `current_period_end` はユーザー本人が **変更不可** (Service Role のみ更新可)
- ユーザー本人は SELECT のみ可

### 4.2 `subscription_events` テーブル (新規)

Webhook イベントの冪等性保証とデバッグ用のログテーブル。

| カラム | 型 | 説明 |
|--------|----|------|
| `id` | uuid (PK) | |
| `stripe_event_id` | text (UNIQUE) | Stripe Event ID (`evt_xxx`) |
| `event_type` | text | `checkout.session.completed` 等 |
| `user_id` | uuid (FK, nullable) | 対応する Supabase ユーザー |
| `payload` | jsonb | イベント全体 (デバッグ用) |
| `processed_at` | timestamptz | 処理完了日時 |
| `created_at` | timestamptz | デフォルト `now()` |

**冪等性:** `stripe_event_id` の UNIQUE 制約により、同一イベントの二重処理を防止。

---

## 5. API 設計

### 5.1 新規エンドポイント

#### `POST /api/billing/checkout`

Stripe Checkout Session を作成してリダイレクト URL を返す。

**リクエスト:**
```json
{
  "price_id": "price_xxxxx"
}
```

**処理フロー:**
1. 認証チェック → 未認証なら 401
2. `price_id` がアプリ定義の有効な Price ID か検証
3. ユーザーの `stripe_customer_id` を取得 (なければ Stripe Customer を新規作成)
4. 既存のアクティブなサブスクリプションがある場合 → 409 (Customer Portal を案内)
5. Checkout Session 作成
6. `{ url: session.url }` を返却

**レスポンス:**
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_xxx" }
```

#### `POST /api/billing/portal`

Stripe Customer Portal のセッション URL を返す。

**リクエスト:** なし (認証情報から取得)

**処理フロー:**
1. 認証チェック → 未認証なら 401
2. `stripe_customer_id` を取得 → なければ 404
3. Portal Session 作成
4. `{ url: portalSession.url }` を返却

#### `POST /api/billing/webhook`

Stripe Webhook エンドポイント。

**処理フロー:**
1. 署名検証 (失敗なら 400)
2. `stripe_event_id` で冪等性チェック (処理済みなら 200 を即返却)
3. イベントタイプに応じた処理
4. `subscription_events` にログ記録
5. 200 返却

### 5.2 既存 API の変更

#### `POST /api/suggest` (変更)

レート制限のロジックを `subscription_tier` に基づいて動的に変更する。

**変更箇所: `src/lib/ai/env.ts`**

```typescript
// 既存のハードコード値を tier ベースに変更
export function getAILimitsForTier(tier: SubscriptionTier) {
  const limits: Record<SubscriptionTier, { daily: number; monthly: number }> = {
    free:  { daily: 5,  monthly: 10  },
    go:    { daily: 10, monthly: 40  },
    plus:  { daily: 20, monthly: 100 },
    pro:   { daily: 30, monthly: 200 },
  };
  return limits[tier];
}
```

**変更箇所: `src/lib/ai/suggest.ts`**

```typescript
// reserveUsageSlot 内でユーザーの tier を参照して制限値を取得
const limits = getAILimitsForTier(profile.subscription_tier);
// limits.daily, limits.monthly を使ってチェック
```

### 5.3 既存 API の変更: 利用状況取得

#### `GET /api/billing/usage`

フロントエンドの利用状況表示用。

**レスポンス:**
```json
{
  "tier": "plus",
  "status": "active",
  "usage": {
    "used_this_month": 42,
    "limit_this_month": 100,
    "used_today": 3,
    "limit_today": 20,
    "reset_at": "2026-07-01T00:00:00Z"
  },
  "current_period_end": "2026-07-25T00:00:00Z"
}
```

---

## 6. 画面設計

### 6.1 料金プラン画面 (`/pricing`)

ランディングページまたはダッシュボードからアクセスする料金プラン選択画面。

| エリア | 内容 |
|--------|------|
| ヘッダー | 「プランを選択」 |
| プランカード (4列) | Free / Go / **Plus (BEST VALUE バッジ)** / Pro |
| 各カード内容 | プラン名、月額、AI提案回数、1回あたり単価、CTAボタン |
| Plus カード装飾 | ライムグリーンのボーダー + グロー効果 + 「BEST VALUE」バッジ |
| 現在のプラン表示 | 該当カードのボタンを「現在のプラン」に変更 (非活性) |

**Plus カードの視覚的差別化:**
- ボーダー: `border-color: #D4FF00` (ライムグリーン)
- グロー: `box-shadow: 0 0 24px #D4FF0033`
- バッジ: カード上部に「BEST VALUE」(ライムグリーン背景 + 黒文字)
- プラン名・価格・回数: ライムグリーンカラー
- CTAボタン: ライムグリーン背景のプライマリボタン

### 6.2 課金管理画面 (`/settings/billing`)

設定画面内の課金管理セクション。

| エリア | 内容 |
|--------|------|
| 現在のプラン | プラン名 + ステータスバッジ (Active / Past Due / Canceled) |
| AI利用状況 | 今月の利用回数 / 上限 (プログレスバー) |
| 次回請求日 | `current_period_end` の表示 |
| アクション | 「プランを変更」→ Customer Portal / 「解約」→ Customer Portal |
| 請求履歴 | Customer Portal へのリンク |

### 6.3 AI提案画面の変更 (`/suggest`)

| 変更箇所 | 内容 |
|---------|------|
| 残り回数表示 | `10/10 → 42/100` のようにプランに応じた上限を表示 |
| 上限到達時 | 「アップグレードして回数を増やす」リンクを `/pricing` へ表示 |
| Free ユーザー | 月10回の制限と、有料プランへの導線バナーを表示 |

### 6.4 ダッシュボードの変更

| 変更箇所 | 内容 |
|---------|------|
| AI提案カード | `ai_suggestion_enabled` の代わりに全ユーザーに表示 (Free プラン含む) |
| 利用状況サマリー | 残り回数の小さなバッジ表示 |

---

## 7. ビジネスロジック

### 7.1 サブスクリプションライフサイクル

```
[未課金] ──(Checkout完了)──→ [Active]
   ↑                           │
   │                    ┌──────┼──────┐
   │                    ↓      ↓      ↓
   │              [変更] [支払失敗] [解約]
   │                │      │        │
   │                │      ↓        │
   │                │  [Past Due]   │
   │                │      │        │
   │                ↓      ↓        ↓
   └──(期間終了)──── [Free に戻る] ←──┘
```

### 7.2 プラン変更ルール

| 操作 | 処理 |
|------|------|
| アップグレード (Go→Plus等) | 即時適用。差額は按分計算 (proration) |
| ダウングレード (Pro→Go等) | 現在の請求期間終了時に適用 |
| 解約 | 現在の請求期間終了時にサブスクリプション終了 → Free に戻る |

### 7.3 `ai_suggestion_enabled` フラグとの整合性

| 移行シナリオ | 処理 |
|-------------|------|
| Phase 1 で `ai_suggestion_enabled = true` のユーザー | `subscription_tier = 'free'` + `ai_suggestion_enabled = true` → 月10回利用可 |
| 新規有料ユーザー | Webhook が `subscription_tier` を更新 → `ai_suggestion_enabled` は常に `true` に |
| 解約ユーザー | `subscription_tier = 'free'` → 月10回に戻る (`ai_suggestion_enabled` は `true` のまま) |

**判定ロジック (suggest.ts 変更):**
```typescript
// 旧: ai_suggestion_enabled のみチェック
// 新: ai_suggestion_enabled = true なら tier に応じた制限を適用
//     ai_suggestion_enabled = false なら従来通り 403
```

### 7.4 利用回数のリセットタイミング

- **月次リセット**: 毎月1日 00:00 JST (UTC+9)
- **日次リセット**: 毎日 00:00 JST
- リセットは明示的な処理不要（`ai_suggestion_logs` の `created_at` 集計で判定）

---

## 8. 環境変数 (追加)

| キー | 例 | 説明 |
|------|----|------|
| `STRIPE_RESTRICTED_KEY` | `rk_live_xxx` | Stripe Restricted API Key (サーバー専用) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` | Webhook 署名検証用シークレット |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_xxx` | Stripe Publishable Key (Checkout リダイレクト型のため不要な場合は省略可) |
| `STRIPE_PRICE_GO` | `price_xxx` | Go プランの Stripe Price ID |
| `STRIPE_PRICE_PLUS` | `price_xxx` | Plus プランの Stripe Price ID |
| `STRIPE_PRICE_PRO` | `price_xxx` | Pro プランの Stripe Price ID |

---

## 9. セキュリティ

### 9.1 API キー

- **Restricted API Key (RAK)** を使用。Secret Key (`sk_`) は使用しない
- RAK には必要最小限の権限のみ付与
- Vercel 環境変数に保管。ソースコードにはコミットしない
- 本番用・テスト用で別々のキーを使用

### 9.2 Webhook

- **署名検証必須**: `stripe.webhooks.constructEvent()` で検証
- 冪等性保証: `stripe_event_id` の UNIQUE 制約で二重処理防止
- Raw Body での受信: Next.js App Router で `request.text()` を使用

### 9.3 課金データの保護

- `subscription_tier`, `stripe_customer_id` 等はユーザー本人からの直接更新を **RLS トリガーで禁止**
- 全ての課金状態変更は Webhook 経由 (Service Role) でのみ実行
- フロントエンドから直接 Stripe API を呼ぶことはしない

---

## 10. 実装フェーズ

### Phase 1: 基盤構築

1. Stripe アカウントセットアップ
   - Product / Price の作成
   - Customer Portal の設定
   - Webhook エンドポイントの登録
   - Restricted API Key の発行と権限設定

2. データベースマイグレーション
   - `user_profiles` にカラム追加
   - `subscription_events` テーブル作成
   - RLS ポリシー追加

3. npm パッケージ追加
   - `stripe` (Node.js SDK)

### Phase 2: バックエンド実装

4. Stripe クライアント初期化 (`src/lib/stripe/client.ts`)
5. Webhook ハンドラ (`app/api/billing/webhook/route.ts`)
6. Checkout Session 作成 (`app/api/billing/checkout/route.ts`)
7. Customer Portal Session 作成 (`app/api/billing/portal/route.ts`)
8. 利用状況取得 (`app/api/billing/usage/route.ts`)
9. `suggest.ts` のレート制限ロジック変更

### Phase 3: フロントエンド実装

10. 料金プラン画面 (`/pricing`)
11. 課金管理画面 (`/settings/billing`)
12. AI提案画面の残り回数表示更新
13. ダッシュボードの導線追加
14. 上限到達時のアップグレード誘導UI

### Phase 4: テスト・リリース

15. Stripe テストモードでの E2E テスト
    - 新規購入フロー
    - アップグレード/ダウングレード
    - 解約フロー
    - 支払い失敗シミュレーション
    - Webhook の冪等性テスト
16. Go-Live チェックリスト確認 (Stripe Dashboard)
17. 本番デプロイ

---

## 11. 既存ユーザーの移行計画

| 対象 | 移行処理 |
|------|---------|
| `ai_suggestion_enabled = true` のユーザー | `subscription_tier = 'free'` のまま。月10回利用可 (従来通り) |
| `ai_suggestion_enabled = false` のユーザー | 変更なし。AI提案は利用不可 |
| マイグレーション実行時 | 全ユーザーに `subscription_tier = 'free'`, `subscription_status = 'none'` を設定 |

**リリース後の変更:**
- `ai_suggestion_enabled` フラグの用途を「AI提案機能自体の有効/無効」に限定
- 回数制限は `subscription_tier` で管理
- 将来的に全ユーザー `ai_suggestion_enabled = true` に移行し、フラグ自体を廃止可能

---

## 12. 監視・運用

### 12.1 監視ポイント

| 項目 | 方法 |
|------|------|
| 月間収益 (MRR) | Stripe Dashboard |
| プラン別ユーザー数 | `user_profiles` の `subscription_tier` 集計 |
| 解約率 (Churn Rate) | Stripe Dashboard + `subscription_events` |
| 支払い失敗率 | `invoice.payment_failed` イベント数 |
| AI利用回数 / プラン | `ai_suggestion_logs` × `user_profiles.subscription_tier` |

### 12.2 アラート

- 支払い失敗が一定数を超えた場合
- Webhook 処理のエラー率が上昇した場合
- グローバル AI コール数がキャップに近づいた場合

---

## 13. スコープ外 (将来検討)

- 年間プラン (年額割引)
- クーポン / プロモーションコード
- チーム / 法人プラン
- AI提案以外の有料機能 (プログレッショングラフ等)
- アプリ内課金 (iOS/Android)
- Stripe Tax (消費税の自動計算)
- admin ダッシュボード (収益・利用状況の可視化)
