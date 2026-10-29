# MACHO

筋トレ記録Webアプリ。ジムでスマホから筋トレ内容を記録し、ダッシュボードで進捗を確認できる個人開発プロジェクトです。AIによるメニュー提案とサブスクリプション課金（Stripe）に対応しています。

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 15 (App Router) + TypeScript |
| スタイリング | Tailwind CSS v4 |
| DB | Cloudflare D1 (SQLite) |
| 認証 | [Better Auth](https://www.better-auth.com/) (Google OAuth) |
| AI提案 | OpenAI API |
| 課金 | Stripe |
| デプロイ | Cloudflare Workers ([OpenNext](https://opennext.js.org/cloudflare)) |

詳細な仕様は [docs/SPECIFICATION.md](docs/SPECIFICATION.md) を参照してください。

## セットアップ

```bash
npm install
cp .env.local.example .env.local
npm run db:migrate:local   # ローカルD1にスキーマとマスタデータを作成
```

主な環境変数:

| 変数 | 用途 |
|------|------|
| `BETTER_AUTH_SECRET` | セッション署名用の秘密鍵（`openssl rand -base64 32`） |
| `BETTER_AUTH_URL` | アプリの公開URL（OAuthのコールバックURLの基準） |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuthクライアント |
| `NEXT_PUBLIC_APP_URL` | アプリの公開URL（Stripeの戻り先など。ビルド時に埋め込み） |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | AIメニュー提案 |
| `MONTHLY_AI_CALL_LIMIT` / `AI_CACHE_TTL_HOURS` / `AI_PENDING_RESERVATION_TTL_MINUTES` / `AI_MAX_TOKENS` | AI利用の全体上限・キャッシュ・予約TTL設定 |
| `STRIPE_RESTRICTED_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe決済 |
| `STRIPE_PRICE_GO` / `STRIPE_PRICE_PLUS` / `STRIPE_PRICE_PRO` | サブスクリプションプランの価格ID |

Google OAuthは Google Cloud Console > APIとサービス > 認証情報 で OAuth クライアントID（ウェブアプリケーション）を作成し、承認済みのリダイレクトURIに `<アプリのURL>/api/auth/callback/google` を登録してください（ローカルは `http://localhost:3000/api/auth/callback/google`）。

DBスキーマは `migrations/` 配下のSQLです。変更するときは新しい番号のファイルを追加し、`npm run db:migrate:local` / `npm run db:migrate:remote` で適用します。

## 開発

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) で確認できます。`next dev` でもローカルD1（`.wrangler/state`）にアクセスできます。

## その他のコマンド

```bash
npm run build             # Next.js本番ビルド
npm run lint              # ESLint実行
npm run preview           # Workersランタイム(workerd)でローカル確認
npm run deploy            # Cloudflare Workersへデプロイ
npm run cf-typegen        # wrangler.jsonc から cloudflare-env.d.ts を再生成
npm run db:migrate:local  # ローカルD1にマイグレーション適用
npm run db:migrate:remote # 本番D1にマイグレーション適用
```

## デプロイ (Cloudflare Workers)

1. `npx wrangler login`
2. D1を作成し、出力された `database_id` を `wrangler.jsonc` の `d1_databases` に設定:
   ```bash
   npx wrangler d1 create macho
   ```
3. `npm run db:migrate:remote`
4. シークレットを登録（`.dev.vars.example` の各キー。`BETTER_AUTH_URL` は本番URL）:
   ```bash
   npx wrangler secret put BETTER_AUTH_SECRET
   ```
   公開してよい設定値（`OPENAI_MODEL` やAI上限など）は `wrangler.jsonc` の `vars` にあります。
5. `NEXT_PUBLIC_*` はビルド時に埋め込まれるため、`npm run deploy` を実行する環境の `.env.local`（Workers Buildsを使う場合はビルド変数）に設定してください。`NEXT_PUBLIC_APP_URL` は本番URLにします。
6. `npm run deploy`
7. 外部サービス側を更新:
   - Google OAuthクライアントの承認済みリダイレクトURIに `https://<本番ドメイン>/api/auth/callback/google` を追加
   - Stripe Webhook のエンドポイントを `https://<本番ドメイン>/api/billing/webhook` に変更（署名シークレットが変わったら `STRIPE_WEBHOOK_SECRET` も更新）

ローカルでWorkersランタイムを試す場合は `.dev.vars.example` を `.dev.vars` にコピーしてから `npm run preview` を実行します。

## Supabaseからのデータ移行

`scripts/migrate-from-supabase.mjs` がSupabaseのPostgresを直接読み、D1用のINSERT文を書き出します。ユーザーIDはそのまま引き継ぎ、GoogleアカウントもBetter Authのaccountに紐づけるので、既存ユーザーは同じGoogleアカウントで再ログインするだけで元のデータを使えます（セッションは引き継がないため、全員1回だけ再ログインが必要です）。

1. 移行中に書き込みが入らないよう、旧環境をメンテナンス状態にする
2. Supabase Dashboard > Connect から Session pooler の接続文字列を取得して書き出し:
   ```bash
   SUPABASE_DB_URL="postgresql://..." node scripts/migrate-from-supabase.mjs migration-data.sql
   ```
3. マイグレーション済み・空の本番D1に投入:
   ```bash
   npx wrangler d1 execute macho --remote --file migration-data.sql
   ```
4. `migration-data.sql` には個人データが含まれるため、投入後は削除する

## ディレクトリ構成

```
app/
├── api/          # APIルート（auth, billing, gpt）
├── dashboard/    # ダッシュボード
├── record/       # ワークアウト記録
├── history/      # 履歴
├── templates/    # テンプレート
├── settings/     # 設定（プロフィール, 課金, APIキー）
├── onboarding/   # 初回オンボーディング
└── pricing/      # 料金プラン

src/lib/
├── auth/         # Better Auth の設定とセッション取得（requireUser など）
└── db/           # D1へのクエリ。ユーザーデータは必ず user_id で絞り込む（旧RLSの代わり）

migrations/       # D1マイグレーションSQL
scripts/          # Supabaseからのデータ移行スクリプト
docs/             # 仕様書
```
