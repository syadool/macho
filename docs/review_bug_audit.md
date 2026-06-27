# MACHO バグ監査レポート

## 方法論

本監査は multi-agent adversarial review 方式で実施した。各バグ候補について、独立した 3 つの検証レンズ (コード読解 / セキュリティ攻撃可能性 / 再現性) を別エージェントに割り当て、いずれも "isReal=true" と評価したもののみを採用した。全 34 件のバグがこの 3-lens 検証を通過している。

## サマリー

| Severity | 件数 |
|----------|------|
| High | 6 |
| Medium | 17 |
| Low | 11 |
| **Total** | **34** |

## 最優先で対応すべき 5 件

1. **[high] Unbounded Array.from allocation による Node プロセスクラッシュ (DoS)** — 認証チェック前に走るため未認証でも 1 リクエストでサーバ全体を落とせる。
2. **[high] getMasterData() の DB エラー握りつぶし** — AI suggestion 検証がハードコード定数にサイレントフォールバックし、FK 違反や不整合データを誘発。
3. **[high] AI 利用枠の TOCTOU レース** — 並列リクエストで daily/monthly/global の OpenAI コスト上限を突破可能。
4. **[high] OAuth callback の open redirect** — `next=@evil.com` で正規 OAuth 直後にフィッシングサイトへ誘導可能。
5. **[high] App Router にエラーバウンダリ皆無** — Supabase の瞬間障害が dashboard/history/templates の全クラッシュに直結。

## 領域別の詳細

### Security / Auth

#### [high] OAuth callback の `next` パラメータ未検証による open redirect / phishing
- **File**: `app/auth/callback/route.ts:7`
- **説明**: `searchParams.get("next")` を検証せず `${origin}${next}` を `NextResponse.redirect` に渡す。`next=@evil.com` で `https://macho.app@evil.com` が `evil.com` の userinfo `macho.app` としてパースされる。
- **影響**: 正規の OAuth フロー完了直後に攻撃者ドメインへ遷移するため、極めて説得力のあるフィッシングが可能。
- **再現**: `/auth/callback?code=<valid>&next=@evil.com` を踏ませる。`exchangeCodeForSession` 成功後そのまま evil.com へ遷移。
- **修正案**: `next` を `/^\/(?!\/)/` の相対パスのみ許可、もしくは内部ルートの allow-list で検証してフォールバックする。

#### [medium] OAuth code exchange エラーを握り潰しログイン成功扱いで redirect
- **File**: `app/auth/callback/route.ts:11`
- **説明**: `await supabase.auth.exchangeCodeForSession(code)` の `{ data, error }` を破棄。失敗時もセッション未確立のまま `next` (既定 `/dashboard`) へ無条件に redirect。
- **影響**: 期限切れ / 二重クリック / メールスキャナの先読みなど一般的な失敗が完全にサイレント化し、`/dashboard` → `requireUser` → `/` のバウンスループに陥る。ログにも出ない。
- **再現**: 既消費 code で `/auth/callback?code=<used>` を叩く。
- **修正案**: `const { error } = await ...` で捕捉し、エラー時はログ出力のうえ `/?error=auth_failed` 等のエラーページへ redirect。

#### [medium] OpenAPI servers.url が Host ヘッダを無条件信頼
- **File**: `app/api/gpt/openapi.json/route.ts:6`
- **説明**: `new URL(req.url).origin` を OpenAPI の servers.url にそのまま埋め込む。`app/settings/api-keys/page.tsx:15-17` も `host` / `x-forwarded-proto` を未検証で表示。Billing 経路 (checkout/portal) は `NEXT_PUBLIC_APP_URL` を優先する pattern を持つのに、こちらだけ未適用。
- **影響**: Host spoofing が成立する状況下では、ユーザが ChatGPT Custom GPT Actions にコピペした URL が攻撃者ドメインに向き、長期 Bearer API キーが流出。
- **再現**: `GET /api/gpt/openapi.json -H 'Host: evil.example.com'` で servers[0].url が evil ドメインに。
- **修正案**: Billing routes 同様 `process.env.NEXT_PUBLIC_APP_URL ?? ... ?? new URL(req.url).origin` のチェーンに統一。

#### [medium] Stripe checkout/portal の return URL が `req.url` origin にフォールバック
- **File**: `app/api/billing/checkout/route.ts:102`
- **説明**: `getBaseUrl()` は env var が両方未設定だと `new URL(req.url).origin` (Host ヘッダ由来) を返す。middleware による正規化は存在せず、env 未設定の preview / self-hosted で攻撃者ホストで `success_url` / `cancel_url` / `return_url` が生成される。
- **影響**: 決済完了直後に攻撃者サイトへ Stripe 経由で誘導する高説得力フィッシング。
- **再現**: env 未設定の deploy で `Host: evil.example` を付与した直 POST を行う。
- **修正案**: `NEXT_PUBLIC_APP_URL` が無ければ fail-closed (500)。`req.url` の origin を第三者 redirect の trust anchor にしない。

### Resource Exhaustion / DoS

#### [high] Unbounded `Array.from({length: exercise.sets})` でサーバプロセスクラッシュ
- **File**: `src/lib/workout-input.ts:113`
- **説明**: `normalizeStrengthSets` が `workout_sets` 空時に未検証の `exercise.sets` を `Array.from({length})` に渡す。`MAX_SETS=20` チェックは確保後。Server Actions `saveWorkout`/`updateWorkout` は `requireOnboardedUser()` よりも先に `validateWorkoutInput` を呼ぶため、認証前に走る。
- **影響**: 1 リクエスト (`sets:100000000`) で Node の heap を使い切り全ユーザのサービス停止。Node v24 で `FATAL ERROR: ... heap out of memory` 再現済み。
- **再現**: Server Action endpoint へ `exercises:[{sets:1e8, workout_sets:[], ...}]` を POST。
- **修正案**: `Array.from` の前に `Number.isInteger && 1 <= sets <= MAX_SETS` を検証し、範囲外は早期 reject。

#### [medium] `create_workout_with_details` RPC が exercises 件数上限なし
- **File**: `supabase/migrations/202606240002_cardio_records_and_workout_updates.sql:20`
- **説明**: SQL 関数は `security invoker` + `grant execute to authenticated`。Next.js 層の `MAX_EXERCISES=30` を経由せず supabase-js で直接 RPC を叩けば、`p_exercises` の長さに DB 上限がない。
- **影響**: 認証ユーザが単一ワークアウトに数万 exercise を流し込み、ストレージ / インデックス / 集計クエリのコストを膨張させる。
- **再現**: `supabase.rpc('create_workout_with_details', { p_exercises: Array.from({length: 50000}, ...) })` を devtools から実行。
- **修正案**: 関数頭で `jsonb_array_length(p_exercises) > 30` ならば `raise exception`、もしくは constraint trigger 追加。

#### [medium] 全 `/api/gpt/*` ルートにレート制限なし (admin client で RLS bypass)
- **File**: `app/api/gpt/stats/route.ts:9`
- **説明**: 4 つの GPT Actions ルートが `authenticateGptRequest` 直後に admin client クエリ。middleware も rate-limit ヘルパも無い。`getAllGptWorkouts` は pageSize=1000 で総行数 cap 無しの `.range()` ループ。
- **影響**: 流出した `macho_` キー 1 個で RLS bypass の admin クエリを無制限頻度で投入され、Supabase の負荷 / コスト DoS が成立。
- **再現**: `/api/gpt/stats?days=365` を delay 無しで連射 → 429 が返らず毎回フルページング。
- **修正案**: `key_hash` / `user_id` 単位のトークンバケットを `authenticateGptRequest` 内か共通 middleware で適用。`getAllGptWorkouts` に total rows hard cap。

#### [low] checkout/portal にも rate limit が無く Stripe API quota を浪費可能
- **File**: `app/api/billing/checkout/route.ts:10`
- **説明**: `/api/billing/checkout` と `/api/billing/portal` は認証以外の throttle なし。1 リクエストあたり `subscriptions.list` / `checkout.sessions.list` を実行。
- **影響**: 認証ユーザがスクリプトで連射し Stripe 共有レート制限の枯渇とコスト膨張を誘発。
- **再現**: onboarded ユーザで `/api/billing/checkout` を無遅延で POST し続ける。
- **修正案**: AI suggestion と同様の per-user limiter を適用。

#### [low] API キー発行に枚数上限・rate limit が無い
- **File**: `src/lib/gpt/api-keys.ts:25`
- **説明**: `createGptApiKey` は既存キー数を見ずに `api_keys` に insert。`issueGptApiKey` server action も throttle 無し。
- **影響**: 単一アカウントで `api_keys` を無制限に膨張させ、(user_id, created_at) index・設定ページ・`authenticateGptRequest` のハッシュ照合を劣化させる。
- **再現**: server action `issueGptApiKey` をループで叩く。
- **修正案**: 1 ユーザあたり最大 N 件で reject、もしくは古いキーの revoke を必須化、加えて action へ rate limit。

### Concurrency / Race Conditions

#### [high] AI 利用枠予約の TOCTOU で並列リクエストが上限を突破
- **File**: `src/lib/ai/suggest.ts:182`
- **説明**: `reserveUsageSlot` は pending row を insert したあと、別 HTTP で `Promise.all([dailyCount, monthlyCount, globalCount])` を取得。advisory lock / unique 制約 / トランザクションのいずれも無い。
- **影響**: Free (5/day, 10/月) を含む全 tier、および global `MONTHLY_AI_CALL_LIMIT` を並列リクエストで突破でき、課金 OpenAI コストが無制限に流出。
- **再現**: 残 1 枠の状態で `/api/suggest` を 5 並列 POST → 全件が OpenAI に到達。
- **修正案**: `INSERT ... ON CONFLICT DO UPDATE` でカウンタを原子インクリメント、もしくは `pg_advisory_xact_lock(user_id)` でシリアライズ。

#### [medium] AI 利用枠チェックのもう一つの並列バイパス (重複報告)
- **File**: `src/lib/ai/suggest.ts:182`
- **説明**: 上記と本質は同一の TOCTOU。pending を含めて count するが insert と count が別 HTTP 往復のため互いの insert を見ない並列ウィンドウが残る。
- **影響**: 並列リクエストで Free 枠を超える OpenAI 呼び出しが admit され、サブスク段階 enforcement の根幹が崩れる。
- **再現**: 同じく `/api/suggest` を並列実行。
- **修正案**: 1 トランザクション + `SERIALIZABLE` / `SELECT ... FOR UPDATE` 化、もしくは Postgres function に集約。

#### [low] Stripe webhook の event 処理が atomic claim 不在
- **File**: `app/api/billing/webhook/route.ts:25`
- **説明**: `upsert(ignoreDuplicates) → SELECT processed_at → processBillingEvent → UPDATE processed_at` の 4 ステップが個別 HTTP。`UPDATE ... WHERE processed_at IS NULL RETURNING id` が無い。
- **影響**: 同 event 並列配送で `subscriptions.retrieve` 等の Stripe API 重複コール。現在は冪等な書き込みのみだが非冪等 handler (メール送信 / クレジット付与) を後から追加すると重大化。
- **再現**: 同 `stripe_event_id` の署名付き POST を同時に 2 本送る。
- **修正案**: 「`UPDATE ... WHERE processed_at IS NULL RETURNING id`」で row を atomic claim し、claim 成功時のみ処理。

#### [low] テンプレ作成は 2 段 insert + ロールバック削除エラー無視
- **File**: `src/lib/templates.ts:83`
- **説明**: `workout_templates` insert → `template_exercises` insert (失敗時に補償 delete) という 2 ステップ。補償 delete の `{ error }` を destructure せず捕捉なし。DB 側にも子行 0 件を禁止する制約は無い。
- **影響**: 二重障害ウィンドウで子無しの孤立 `workout_templates` 行が残り、UI 側の前提を破る。
- **再現**: 2 回目 insert と補償 delete を共に失敗させる。
- **修正案**: `create_workout_with_details` のような atomic PL/pgSQL 関数に統一。

#### [low] `update_workout_with_details` に楽観排他制御なし
- **File**: `supabase/migrations/202606240002_cardio_records_and_workout_updates.sql:157`
- **説明**: workout_exercises を全 delete → 再 insert。`updated_at` 列はあるが比較されず、期待 version パラメータも無い。
- **影響**: 2 タブ / 2 デバイスの同時編集で 2 回目の保存が 1 回目をサイレント上書き、警告なくデータ消失。
- **再現**: 同 workout を 2 タブで開き編集 → A 保存後に B 保存。
- **修正案**: `p_expected_updated_at` 引数追加、不一致なら conflict エラー化。

### Cost / Quota Accounting

#### [medium] OpenAI 課金済みリクエストが validation 失敗時に利用枠・コストから消える
- **File**: `src/lib/ai/suggest.ts:123`
- **説明**: 課金後の `validateSuggestionPayload` 失敗で catch に飛び、`updateLog` が `status:error` のみで `cost_usd` / token を null 上書き。`countLogs` は 'error' をカウントしない。
- **影響**: トークン課金は発生したのに `cost_usd` 不明、利用枠未消費、`MONTHLY_AI_CALL_LIMIT` も無視。検証失敗を量産すれば無制限コスト消費。
- **再現**: schema strict に通るが allow-list 外の muscle_group_id が返るような target で叩き続ける。
- **修正案**: error path でも `response.usage` から token / cost を保存。global 上限カウントに「課金成立した error」を含める。

#### [high] success 直後の `updateLog` / `getRemainingUsage` 失敗が成功行を error で全上書き
- **File**: `src/lib/ai/suggest.ts:152`
- **説明**: `updateLog` は full overwrite。catch 内では response_payload / token / cost を渡さず null で上書き。`getRemainingUsage` 内の `countLogs` も throw し得る。
- **影響**: OpenAI 課金済みのサジェストが消失し、`cost_usd` / token も null 化。ユーザは error 画面でリトライ → 二重課金。findCachedSuggestion は success のみ参照するためキャッシュ復旧もできない。
- **再現**: 成功 `updateLog` 直後の `countLogs` を一時失敗させる。
- **修正案**: `updateLog` を partial patch 化。`getRemainingUsage` 失敗を non-fatal にして既生成の success payload を返す。

#### [low] AI suggestion の regenerate がキャッシュ TTL 内は同じ結果を返しつつ枠を消費
- **File**: `app/suggest/suggest-form.tsx:38`
- **説明**: `再生成` ボタンが `generate(true)` を呼ぶも request body は初回と同一で `inputHash` 一致。`findCachedSuggestion` がヒットし OpenAI を呼ばずに同一 payload を返却。`cached` 行は枠を消費する。
- **影響**: 「利用回数を消費します」と警告しつつ同じ結果を出す、UX と仕様の乖離。
- **再現**: 同じ target で連続再生成。
- **修正案**: `force_regenerate` フラグを route / `generateSuggestion` まで配線、もしくは hash 入力に nonce を混ぜる。

### Business Logic / Data Integrity

#### [high] Dashboard の期間フィルタが server 局所時刻で計算され JST off-by-one
- **File**: `app/dashboard/page.tsx:222`
- **説明**: `filterWorkoutsByRange` / `getWeeklyVolumes` が `new Date()` + `toDateInputValue` (local TZ) で「今日」「今週」「今年」を計算。Vercel 既定は UTC、ワークアウト日付は client (JST) で書かれる。`getJstUsageWindow` という正解パターンが同リポ内にあるのに未利用。
- **影響**: 00:00-08:59 JST に開いたページで「今日」ログが見えず、週バー / 年集計が誤バケット。
- **再現**: UTC server で 00:30 JST にワークアウト記録 → `/dashboard?range=today` でログ未表示。
- **修正案**: `getJstUsageWindow` 同等のヘルパで境界計算、もしくは `TZ=Asia/Tokyo` を強制する。

#### [medium] 未来日付のワークアウトを許容し累計を恒久的に水増し
- **File**: `src/lib/workout-input.ts:30`
- **説明**: `validateWorkoutInput` の date チェックは format のみ。`<input type="date">` に `max` 無し、`filterWorkoutsByRange` の `year` は年プレフィックスのみ、`all` は無フィルタ。
- **影響**: タップミスや意図的入力で累計 volume / sets を恒久水増しでき、ダッシュボードの信頼性が崩れる。
- **再現**: `/record` で来月の日付保存 → `/dashboard?range=all` で集計に含まれる。
- **修正案**: 入力に `max={toDateInputValue()}` を付与しサーバ側でも「今日」を上回る日付を reject。

#### [medium] `ai_suggestion_enabled` が全 subscription webhook で問答無用に true 化
- **File**: `src/lib/billing/stripe-sync.ts:29`
- **説明**: `syncStripeSubscription` / `markSubscriptionDeleted` で常に `ai_suggestion_enabled:true` を upsert。`prevent_ai_suggestion_enabled_self_change` トリガは service-role を制限しない。
- **影響**: 不正利用などの理由で運営が `false` に落とした有料ユーザでも、ルーチン webhook (支払方法変更 etc.) で即時に `true` へ戻り、モデレーションが無効化される。
- **再現**: false 化されたアクティブ会員に subscription.updated event が届く。
- **修正案**: payload から `ai_suggestion_enabled` を削除、もしくは「無料 → 有料への初昇格時のみ」に限定する。

#### [medium] `incomplete_expired` を `isDeleted` 判定に含めず subscription_id が幽霊参照に
- **File**: `src/lib/billing/stripe-sync.ts:18`
- **説明**: `isDeleted = subscription.status === "canceled"` のみ。`getSubscriptionStatus` は `canceled` と `incomplete_expired` の両方を app status `canceled` に map しているのに、`isDeleted` 分岐の文字列比較が同期していない。
- **影響**: 初回決済失敗で `incomplete_expired` になった subscription で、`subscription_status='canceled'` の一方 `subscription_id` と `current_period_end` がスケスケ参照のまま残る。
- **再現**: 3DS 中断などで `incomplete_expired` 化させ webhook を受ける。
- **修正案**: `isDeleted` 判定を mapped status (`status === "canceled"`) に統一。

### Data Access / DB Schema

#### [medium] Server Component で Supabase セッション cookie が更新されない (middleware 不在)
- **File**: `src/lib/supabase/server.ts:14`
- **説明**: `middleware.ts` が無く、Server Component から `getUser()` 時の refresh トークンを書き戻す術がない。`setAll` の `catch` で握り潰し。
- **影響**: アクセストークン期限切れ前後で `/history` `/templates` 等にナビするとサイレントに `/` に戻されるなど、断続的な再ログイン要求が発生。
- **再現**: ログイン後タブを長時間放置 → 期限間際で Server Component-only ページに遷移。
- **修正案**: `@supabase/ssr` 公式パターンで `middleware.ts` を追加し、毎リクエスト `NextResponse` に refresh 後 cookie を書き戻す。

#### [medium] `getWorkoutById` が全 DB エラーを `null` に潰して 404 化
- **File**: `src/lib/data.ts:123`
- **説明**: `.single()` の `if (error) return null;` が PGRST116 以外の error も飲み込む。legacy fallback 分岐も同じ pattern。ログ出力も無い。
- **影響**: 一時障害 / RLS 設定ミスが「ワークアウト不存在 (404)」と同一視され、本番の障害シグナルが消える。
- **再現**: `select` 権限を一時的に外し `/history/[id]/edit` を開く。
- **修正案**: PGRST116 のみ null、その他は `console.error` してから throw or エラー UI へ。

#### [medium] App Router 全域に `error.tsx` が皆無
- **File**: `app/layout.tsx`
- **説明**: `error.tsx` / `global-error.tsx` が一切なく、Server Component で発生した throw は Next 既定 (素の) エラーページに直結。
- **影響**: 一過性の Supabase 障害でダッシュボード等が無味な crash 画面になり、リカバリ UI が無い。
- **再現**: Supabase 接続を切って `/dashboard` を開く。
- **修正案**: 最低限のルート `app/error.tsx` と、主要 segment 毎の `error.tsx` を追加し `reset()` UI を提供。

#### [medium] `workout_sets` に `(workout_exercise_id, set_number)` の UNIQUE 制約なし
- **File**: `supabase/migrations/202606230001_initial_schema.sql:58`
- **説明**: 同列の index は plain index。`create_workout_with_details` / `update_workout_with_details` は `set_number` を caller JSON のまま insert、`security invoker` で `authenticated` に付与済み。
- **影響**: 直 RPC で `set_number=1` が複数行同居でき、編集 / 集計ロジックの暗黙前提が崩れる。
- **再現**: 直 supabase-js で `sets:[{set_number:1,...},{set_number:1,...}]` を送る。
- **修正案**: `create unique index ... on workout_sets(workout_exercise_id, set_number)` を追加し RPC 内で事前 distinct チェック。

#### [medium] `muscle_groups` / `muscle_sub_groups` 参照の ON DELETE が不整合で partial-cascade
- **File**: `supabase/migrations/202606240001_multi_sub_groups_and_zero_reps.sql:3`
- **説明**: `workout_exercise_sub_groups.muscle_sub_group_id` は CASCADE、一方 `workout_exercises.muscle_sub_group_id` / `template_exercises.*` は NO ACTION。多重 sub group 機能では 2 番目以降の sub group が join table のみに存在。
- **影響**: master 行を削除すると、サブ参照のみのデータは silently 消える / 直参照があれば FK violation で失敗、と分岐する操作上の地雷。
- **再現**: 直参照がない sub group を `delete` → join 行が silent に消える。
- **修正案**: 全 FK を RESTRICT に統一、または CASCADE / SET NULL を明示。

#### [low] `ai_suggestion_logs` の hot-path クエリに適合する複合 index 無し
- **File**: `supabase/migrations/202606250001_ai_suggestion_schema.sql:58`
- **説明**: index は `(user_id, created_at desc)` と `(input_hash, created_at desc)` のみ。`findCachedSuggestion` の絞り込みは `user_id + input_hash + status='success' + created_at` 範囲。
- **影響**: 行数増加に伴いキャッシュチェッククエリが遅延、毎 AI リクエストに乗る。
- **再現**: 大量ログ後に該当 SELECT で EXPLAIN。
- **修正案**: `create index ... on ai_suggestion_logs(user_id, input_hash, created_at desc) where status='success';`

### Input Validation / Type Safety

#### [low] LLM プロンプトに `exercise_name` / `theme` が未エスケープで埋め込まれる
- **File**: `src/lib/ai/suggest.ts:382`
- **説明**: `buildRecentWorkoutsSummary` / `buildUserPrompt` で生文字列を template literal 直挿入。schema 検証と React の素テキスト描画で実害は限定的だが prompt-injection 面は開いている。
- **影響**: 出力品質 / コスト劣化のおそれ。XSS や越境はない。
- **再現**: 80 字以内に instruction 風文字列を含む exercise 名で記録 → `/api/suggest` 呼び出し。
- **修正案**: ユーザ入力をデリミタで囲み「データとして扱え」と明示。制御文字や instruction 接頭辞を strip。

#### [low] UUID 正規表現が case-insensitive だが Set / 比較は exact-string
- **File**: `src/lib/profile-validation.ts:29`
- **説明**: `UUID_PATTERN` は `/i`、入力をそのまま `new Set` / `validIds.has(id)`。DB は小文字。
- **影響**: 大文字 UUID を送ると重複除去失敗 + `重点部位の指定が不正です。` の誤拒否。Web UI からは起きないが Server Action は直 POST 可能。
- **再現**: `saveOnboarding` を upper-case UUID で叩く。
- **修正案**: フィルタ段階で `id.toLowerCase()` し比較対象も小文字化。

#### [low] `EditableProfileInput` の `Omit` に `onboarding_completed` が含まれず
- **File**: `src/lib/profile.ts:4`
- **説明**: subscription / ai_suggestion 系は除外されているのに `onboarding_completed` だけ抜けている。現状の caller は安全だが、汎用 `upsertUserProfile` に紛れ込んでも型で気付けない。
- **影響**: 将来のリファクタで onboarding 制約の中央集権 (markOnboardingCompleted) が bypass される潜在リスク。
- **再現**: `upsertUserProfile({ onboarding_completed: true })` を書いてもコンパイル成功。
- **修正案**: `Omit` リストに `onboarding_completed` を追加。

### UX / Frontend

#### [medium] Client component の `useState(toDateInputValue())` で SSR/CSR hydration mismatch
- **File**: `app/record/record-form.tsx:24`
- **説明**: 親は `force-dynamic` の Server Component、`useState` 初期化は server (UTC) と client (JST) で別の日付文字列を返し得る。
- **影響**: JST 0:00-9:00 に開くとデフォルト日が 1 日ズレ、React の hydration mismatch 警告も出る。
- **再現**: UTC server + JST ブラウザで 00:30 JST に `/record` を開く。
- **修正案**: 初期値を `useEffect` 後に算出、もしくは Server から prop 経由で JST 日付を渡す。

#### [low] Google ログインボタンがエラーを surfacing せず loading 状態で固着
- **File**: `src/components/login-button.tsx:10`
- **説明**: `signInWithOAuth` の戻り値を捨て、`setLoading(false)` も `try/finally` も無し。
- **影響**: provider 設定ミス / ネットワーク失敗時に「接続中…」のままリロードしないと復帰不可。
- **再現**: Google provider を無効化してログインボタンを押下。
- **修正案**: `{ error }` を捕捉、try/catch/finally で loading 解除しエラー表示。

## 全体所感

全体として、MACHO のサーバ側は「冪等な書き込みと RLS による所有権保証」で確かに最低限の boundary は守れているものの、(1) 並列・並行性に対する楽観想定、(2) 認証チェックよりも先に走る重い処理 (validateWorkoutInput, GPT Actions, Stripe webhook) における入力上限の欠如、(3) DB エラー / 外部 API エラーの sub-silent な握り潰し、(4) 「アプリ層と DB 層で同じ業務制約を二重に持つ際の片側だけ」というアンチパターン、が横断的な弱点パターンとして繰り返し現れている。とりわけ AI suggestion と Stripe webhook 周辺は、コスト直結のクリティカルパスでありながら TOCTOU / partial overwrite / 状態 mapping ずれといった accounting バグが集中しており、ここを atomic な PL/pgSQL 関数 + advisory lock + partial update で再設計すれば多くの high/medium 件が一括で潰せる。加えて middleware と error boundary が共に空であることが「セッション更新失敗 / Server Component throw」のような JST ユーザ起点の障害をユーザに見える形で増幅しており、運用品質の底上げのためにもこの 2 つは早期に整備する価値が高い。
