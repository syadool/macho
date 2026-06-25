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
| デプロイ | Vercel |

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
| `AI_RATE_LIMIT_PER_DAY` / `AI_RATE_LIMIT_PER_MONTH` / `MONTHLY_AI_CALL_LIMIT` / `AI_CACHE_TTL_HOURS` / `AI_MAX_TOKENS` | AI利用のレート制限・キャッシュ設定 |
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
npm run build   # 本番ビルド
npm run start   # 本番サーバー起動
npm run lint    # ESLint実行
```

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
