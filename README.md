# MACHO

筋トレ記録Webアプリ。ジムでスマホから筋トレ内容を記録し、ダッシュボードで進捗を確認できる個人開発プロジェクトです。AIによるメニュー提案とサブスクリプション課金（Stripe）に対応しています。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 15 (App Router) + TypeScript |
| スタイリング | Tailwind CSS v4 |
| バックエンド/DB | Supabase (PostgreSQL, Auth) |
| 認証 | Supabase Auth (Google OAuth) |
| AI提案 | OpenAI API |
| 課金 | Stripe |
| デプロイ | Cloudflare Workers ([OpenNext](https://opennext.js.org/cloudflare)) |

詳細な仕様は [docs/SPECIFICATION.md](docs/SPECIFICATION.md) を参照してください。

## セットアップ

```bash
npm install
```

`.env.local.example` を `.env.local` にコピーし、各値を設定してください。

```bash
cp .env.local.example .env.local
```

主な環境変数:

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabaseクライアント接続 |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバーサイド処理（Service Role） |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AIメニュー提案 |
| `MONTHLY_AI_CALL_LIMIT` / `AI_CACHE_TTL_HOURS` / `AI_PENDING_RESERVATION_TTL_MINUTES` / `AI_MAX_TOKENS` | AI利用の全体上限・キャッシュ・予約TTL設定 |
| `STRIPE_RESTRICTED_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe決済 |
| `STRIPE_PRICE_GO` / `STRIPE_PRICE_PLUS` / `STRIPE_PRICE_PRO` | サブスクリプションプランの価格ID |

Google OAuthは Supabase Dashboard > Authentication > Providers > Google で設定し、リダイレクトURIに `https://<your-project>.supabase.co/auth/v1/callback` を登録してください。

DBスキーマは `supabase/migrations` 配下のSQLを Supabase プロジェクトに適用してください。

## 開発

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できます。

## その他のコマンド

```bash
npm run build      # Next.js本番ビルド
npm run lint       # ESLint実行
npm run preview    # Workersランタイム(workerd)でローカル確認
npm run deploy     # Cloudflare Workersへデプロイ
npm run cf-typegen # wrangler.jsonc から cloudflare-env.d.ts を再生成
```

## デプロイ (Cloudflare Workers)

1. `npx wrangler login`
2. シークレットを登録（`.dev.vars.example` の各キー）:
   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```
   公開してよい設定値（`OPENAI_MODEL` やAI上限など）は `wrangler.jsonc` の `vars` にあります。
3. `NEXT_PUBLIC_*` はビルド時に埋め込まれるため、`npm run deploy` を実行する環境の `.env.local`（Workers Buildsを使う場合はビルド変数）に設定してください。`NEXT_PUBLIC_APP_URL` は本番URLにします。
4. `npm run deploy`
5. デプロイ後に外部サービス側を更新:
   - Supabase Dashboard > Authentication > URL Configuration の Site URL / Redirect URLs に `https://<本番ドメイン>/auth/callback` を追加
   - Stripe Webhook のエンドポイントを `https://<本番ドメイン>/api/billing/webhook` に変更（署名シークレットが変わったら `STRIPE_WEBHOOK_SECRET` も更新）

ローカルでWorkersランタイムを試す場合は `.dev.vars.example` を `.dev.vars` にコピーしてから `npm run preview` を実行します。

## ディレクトリ構成

```
app/
├── api/          # APIルート（billing, suggest 等）
├── auth/         # 認証コールバック
├── dashboard/    # ダッシュボード
├── record/       # ワークアウト記録
├── history/      # 履歴
├── suggest/      # AIメニュー提案
├── templates/    # テンプレート
├── settings/     # 設定（プロフィール, 課金）
├── onboarding/   # 初回オンボーディング
└── pricing/      # 料金プラン

docs/             # 仕様書
supabase/         # マイグレーションSQL
```

## デプロイ

[Vercel](https://vercel.com) でのデプロイを前提としています。環境変数をVercelプロジェクトに設定し、main/masterブランチへのpushで自動デプロイされます。
