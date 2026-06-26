レビュー結果サマリー（GPT Actions連携機能）

対象: app/api/gpt/, app/settings/api-keys/, src/lib/gpt/, supabase/migrations/202606260001_api_keys.sql
仕様: docs/SPECIFICATION_GPT_ACTIONS.md
統計: 3観点（セキュリティ/API正確性/UI）でレビュー → 7件確定（High 2 / Medium 5）
ステータス: **未修正**（Codexへの修正依頼タスクがハングして停止、ファイルは一切変更されていない）

🟠 High（2件）

1. `last_used_at` が永久に更新されない
File: src/lib/gpt/auth.ts:23
```ts
void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", keyHash);
```
問題: `@supabase/postgrest-js` の実装では、実際の `fetch()` 呼び出しは builder の `then()` メソッド内でのみトリガーされる（`node_modules/@supabase/postgrest-js/dist/index.cjs:327` の `executeWithRetry()` は `then()` 内でしか呼ばれない）。`void` は式を評価するだけで `.then()` を呼ばないため、このUPDATEリクエストは実際には送信されない。設定画面の「最終利用」は永久に「なし」と表示される。
修正: `await` するか、`.then(() => {})` を追記して実際にリクエストを発火させる。

2. APIキー発行・失効後にリストが更新されない
File: app/settings/api-keys/api-key-manager.tsx（issueKey 16-28行目, revokeKey 30-36行目）
問題: `issueGptApiKey`/`deleteGptApiKey` を `startTransition` 内で呼ぶが `router.refresh()` を呼んでいない。`revalidatePath`（actions.ts内）はサーバー側キャッシュの無効化のみで、`<form action>` 経由でない呼び出しではマウント済みのクライアントツリーは自動再フェッチされない。同種の処理を行う `app/settings/profile/profile-form.tsx:42` や `app/templates/[id]/template-actions.tsx:19-20` は必ず `router.refresh()` を呼んでおり、ここだけパターンが欠落している。結果: キーを失効しても画面に残り続け、新規発行したキーもリストに反映されない。
修正: `next/navigation` の `useRouter` を import し、issueKey/revokeKey成功後に `router.refresh()` を呼ぶ（profile-form.tsxの既存パターンに合わせる）。

🟡 Medium（5件）

3. `api_keys` のRLSポリシーが `FOR ALL` で、エンドユーザーがUPDATE可能（Codexが追加発見）
File: supabase/migrations/202606260001_api_keys.sql:16-20
```sql
create policy "Users manage own api keys"
on public.api_keys for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```
問題: `last_used_at` の更新はservice roleクライアント（auth.ts）が行うため、通常クライアント（anon/authenticated）には本来 SELECT/INSERT/DELETE のみで十分なはず。`FOR ALL` だと自分の行をUPDATEする権限まで与えてしまい、最小権限の原則に反する（ユーザーが自分の `last_used_at` や `key_hash` を直接書き換えられてしまう）。
修正: ポリシーを SELECT/INSERT/DELETE のみに絞る（UPDATEは付与しない）。

4. `avg_sessions_per_week` が新規ユーザーで過小評価される
File: src/lib/gpt/serialize.ts:78
```ts
round((workouts.length / Math.max(days, 1)) * 7, 1)
```
問題: 分母がリクエストされた期間（例: 30日）固定で、実際の利用履歴の長さを見ていない。登録10日目で8回トレーニングしたユーザーは「週1.9回」と算出される（実際は直近10日では週5.6回相当）。新規ユーザーほど頻度が低く表示される系統的な偏り。
修正: 分母を「実際に返ってきたワークアウトの最古日からの日数」と`days`の小さい方にする（ワークアウトが0件の場合は現状のロジックにフォールバック）。

5. `/api/gpt/stats` が1000件超のセッションを無言で切り捨てる
File: app/api/gpt/stats/route.ts:17
```ts
const workouts = await getGptWorkouts(userId, { days, limit: 1000 });
```
問題: `days`は最大365まで指定可能。1日2-3回ログを取るような重ユーザーが年間1000件を超えると、最新1000件のみが集計対象になり、期間内の古いセッションが黙って切り捨てられる。レスポンスにその旨を示すフィールドがない。
修正: limitを安全な範囲で上げる、または `truncated: boolean` のようなフィールドをstatsレスポンスに追加する。

6. OpenAPIスキーマが `/workouts` と `/stats` のレスポンス構造を未記載
File: app/api/gpt/openapi.json/route.ts（91-95行目、110-114行目）
問題: `/api/gpt/profile` には完全な `content`/`schema` があるが、`/api/gpt/workouts` と `/api/gpt/stats` は `{ description: "..." }` のみでスキーマがない。ChatGPTのCustom GPT Actionsインポート時に、最も重要な入れ子構造（`workouts[].exercises[].sets[]`、statsの複数セクション）の手がかりがGPTに渡らず、解析精度が落ちる。
修正: `serializeGptWorkouts`（src/lib/gpt/serialize.ts）と `buildGptStats`（同ファイル）が実際に生成する形に対応する完全な `content`/`schema` を追加する。

7. `getGptMasterData` のフォールバックが既存実装と不一致
File: src/lib/gpt/data.ts:56-57
問題: 既存の `getMasterData()`（src/lib/data.ts）はSupabaseクエリがnullを返した場合、ハードコードされた `MUSCLE_GROUPS`/`EQUIPMENT`（@/lib/constants）にフォールバックする。新設の `getGptMasterData()` は `[]` を返すだけで、意図的な差分には見えない。マスタデータ取得が失敗した場合、`/api/gpt/exercises` と `/api/gpt/profile` だけが空のマスタデータを返してしまう。
修正: 同じ `MUSCLE_GROUPS`/`EQUIPMENT` フォールバックを再利用して統一する（意図的にそうしている理由がなければ）。

---
補足: Codexへ上記7件の修正を依頼したタスク（task-mqu7f0rg-icbdoq）はログが00:42:53で停止し、プロセス自体が終了していた（ハング/クラッシュ）。`git status` 確認時点で対象ファイルへの変更は一切加えられていない。再実行が必要。
