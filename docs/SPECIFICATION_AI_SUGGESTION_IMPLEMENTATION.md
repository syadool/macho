# MACHO - AIメニュー提案機能 実装手順書 (Codex 向け)

> 親仕様書: [SPECIFICATION_AI_SUGGESTION.md](./SPECIFICATION_AI_SUGGESTION.md)
> 本書は実装を 17 ステップに分解した手順書。**1ステップ = 1コミット相当**。

## 使い方

- 各ステップは独立して動作確認可能。**Step N の「Codexプロンプト」をコピペして Codex に投入**する。
- ステップは原則順番通り。前提となる Step を完了させてから次へ進む。
- 各プロンプトは「読むべき既存ファイル」「作成/編集するファイル」「完了条件」を明示。
- ファイルパスはリポジトリルートからの相対パス。

## 全体マップ

| Phase | Step | 内容 |
|-------|------|------|
| 準備 | 1 | パッケージ追加・環境変数 |
| DB | 2 | マイグレーション |
| 型 | 3 | TypeScript 型定義・定数 |
| プロフィール | 4 | データアクセス層 |
|  | 5 | オンボーディング画面 |
|  | 6 | 強制リダイレクト (`requireUser` 拡張) |
|  | 7 | プロフィール設定画面 |
| テンプレート | 8 | データアクセス層 |
|  | 9 | Server Actions (保存・削除) |
|  | 10 | 一覧画面 |
|  | 11 | 詳細画面 |
|  | 12 | 記録画面のテンプレ初期値対応 |
| AI提案 | 13 | OpenAI クライアント・プロンプト |
|  | 14 | サーバーロジック (rate limit + cache) |
|  | 15 | `/api/suggest` エンドポイント |
|  | 16 | AI提案画面 |
| 仕上げ | 17 | ダッシュボード動線 |

## 共通ルール（全ステップで遵守）

- **言語**: TypeScript。`any` 禁止。
- **Server Components 優先**: フォームとインタラクティブUIのみ `"use client"`。
- **データ取得**: Supabase クライアントは `@/lib/supabase/server` の `requireUser()` を使う。
- **Server Actions**: ファイル先頭に `"use server"`、`app/<feature>/actions.ts` パターン。
- **スタイル**: 既存の `@/components/ui` (`Card`, `Pill`, `PrimaryButton`, `OutlineButton`, `PageTitle`, `BottomNav`) と `@/components/phone-shell` を使う。色は `macho-lime`, `macho-card`, `macho-border`, `macho-muted`, `macho-text` 等の Tailwind カスタムカラー。
- **日本語UI**: 画面文言は日本語。
- **コメント**: 不要なコメントは書かない。

---

## Step 1: パッケージ追加・環境変数

### 目的
OpenAI SDK を依存に追加し、`.env.local.example` に新規環境変数を追記する。

### 作成・編集するファイル
- 編集: `package.json` (依存追加)
- 編集: `.env.local.example`

### 完了条件
- `npm install` が通る
- `npm run build` が通る
- `.env.local.example` に新環境変数が並んでいる

### Codexプロンプト

```
リポジトリ macho に「AIメニュー提案機能」を実装する。Step 1 として OpenAI SDK 依存と環境変数のテンプレートを追加してほしい。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md の「10. 環境変数」

タスク:
1. ルートで `npm install openai` を実行して `package.json` / `package-lock.json` を更新する。バージョン指定は最新安定版でよい。
2. `.env.local.example` の末尾に以下のキーを追記する（コメントは英語でよい）:
   - OPENAI_API_KEY
   - OPENAI_MODEL  (デフォルト値の例として "gpt-5-mini" を書いておく)
   - AI_RATE_LIMIT_PER_DAY=10
   - AI_RATE_LIMIT_PER_MONTH=100
   - MONTHLY_AI_CALL_LIMIT=3000
   - AI_CACHE_TTL_HOURS=1
   - AI_MAX_TOKENS=1000

完了条件:
- `npm install` がエラーなく通る
- `npm run build` が通る
- `.env.local.example` をテキストで開いて全キーが揃っている
```

---

## Step 2: マイグレーション (DB スキーマ)

### 目的
仕様書の「3. データモデル追加」に従い、4 テーブルと RLS、トリガを作成。

### 読むべき既存ファイル
- `supabase/migrations/202606230001_initial_schema.sql` (記法・命名規則の参考)
- `supabase/migrations/202606240002_cardio_records_and_workout_updates.sql` (最新マイグレーション)
- `docs/SPECIFICATION_AI_SUGGESTION.md` の §3, §4

### 作成・編集するファイル
- 新規: `supabase/migrations/202606250001_ai_suggestion_schema.sql`

### 完了条件
- `supabase db reset` (またはローカルのリセット手順) で適用できる
- RLS が全テーブルで有効
- `auth.users` への INSERT トリガで `user_profiles` 行が自動作成される

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 2: DB マイグレーションを作成する。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §3, §4
既存スタイル参考: supabase/migrations/202606230001_initial_schema.sql, supabase/migrations/202606240002_cardio_records_and_workout_updates.sql

タスク:
新規ファイル `supabase/migrations/202606250001_ai_suggestion_schema.sql` を作成し、以下を含める。

1. テーブル4つ (PK は uuid, default gen_random_uuid()):
   - public.user_profiles (PK = user_id, FK -> auth.users(id) on delete cascade)
     カラム: user_id, training_goal text, experience_level text, weekly_frequency int, focus_muscle_group_ids uuid[] default '{}', ai_suggestion_enabled boolean default false, onboarding_completed boolean default false, created_at, updated_at
     check: training_goal in ('hypertrophy','strength','fat_loss','maintenance') or null
     check: experience_level in ('beginner','intermediate','advanced') or null
     check: weekly_frequency between 1 and 7 or null
   - public.workout_templates
     カラム: id, user_id (FK auth.users on delete cascade), name text not null, source text not null check (source in ('ai_suggestion','manual')), source_log_id uuid, created_at
   - public.template_exercises
     カラム: id, template_id (FK workout_templates on delete cascade), exercise_name text not null, muscle_group_id uuid (FK muscle_groups), muscle_sub_group_id uuid (FK muscle_sub_groups, nullable), equipment_id uuid (FK equipment, nullable), target_sets int, target_reps int, target_weight_kg decimal(7,2), notes text, sort_order int not null default 1
   - public.ai_suggestion_logs
     カラム: id, user_id (FK auth.users on delete cascade), input_hash text not null, request_payload jsonb not null, response_payload jsonb, prompt_tokens int, completion_tokens int, total_tokens int, cost_usd decimal(10,6), status text not null check (status in ('success','cached','rate_limited','forbidden','error')), error_message text, created_at timestamptz not null default now()

2. インデックス:
   - ai_suggestion_logs(user_id, created_at desc)
   - ai_suggestion_logs(input_hash, created_at desc)
   - workout_templates(user_id, created_at desc)
   - template_exercises(template_id, sort_order)

3. updated_at トリガ: user_profiles 用に既存の public.set_updated_at() を流用。

4. auth.users への INSERT トリガで public.user_profiles に空行を作る関数とトリガ:
   - 関数名: public.handle_new_user()
   - trigger 名: on_auth_user_created (after insert on auth.users for each row)

5. RLS を全 4 テーブルで有効化。ポリシー:
   - user_profiles: select / update は self (auth.uid() = user_id) のみ。insert はトリガで作るので不要だが、念のため self insert を許可。
   - workout_templates: self CRUD
   - template_exercises: template 経由で self CRUD (workout_templates との join で auth.uid() 一致)
   - ai_suggestion_logs: self select のみ。insert / update はクライアントから不可（API Route から Service Role キーで書く）

完了条件:
- ファイルが既存マイグレーションと同じ書式（小文字、create table if not exists、drop policy if exists ... create policy ...）で書かれている
- すべての RLS ポリシーが drop if exists -> create で冪等
- supabase db reset 相当の再適用が可能
```

---

## Step 3: TypeScript 型定義と定数の追加

### 読むべき既存ファイル
- `src/lib/types.ts`
- `src/lib/constants.ts`

### 作成・編集するファイル
- 編集: `src/lib/types.ts`
- 編集: `src/lib/constants.ts`

### 完了条件
- `npm run build` が通る
- 新規型がエクスポートされている

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 3: TypeScript 型と定数を追加する。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §3
既存スタイル参考: src/lib/types.ts, src/lib/constants.ts

タスク:
1. `src/lib/types.ts` に以下の型を追加（既存型と同じスタイル）:
   - export type TrainingGoal = "hypertrophy" | "strength" | "fat_loss" | "maintenance";
   - export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
   - export type UserProfile = {
       user_id: string;
       training_goal: TrainingGoal | null;
       experience_level: ExperienceLevel | null;
       weekly_frequency: number | null;
       focus_muscle_group_ids: string[];
       ai_suggestion_enabled: boolean;
       onboarding_completed: boolean;
     };
   - export type TemplateSource = "ai_suggestion" | "manual";
   - export type TemplateExercise = {
       id: string;
       exercise_name: string;
       muscle_group_id: string | null;
       muscle_sub_group_id: string | null;
       equipment_id: string | null;
       target_sets: number | null;
       target_reps: number | null;
       target_weight_kg: number | null;
       notes: string | null;
       sort_order: number;
     };
   - export type WorkoutTemplate = {
       id: string;
       name: string;
       source: TemplateSource;
       source_log_id: string | null;
       created_at: string;
       template_exercises: TemplateExercise[];
     };
   - export type SuggestionExercise = Omit<TemplateExercise, "id" | "sort_order"> & { muscle_group_id: string; };
   - export type SuggestionResult = {
       suggestion_id: string;
       overall_comment: string;
       exercises: SuggestionExercise[];
       usage: { remaining_today: number; remaining_this_month: number };
     };

2. `src/lib/constants.ts` に以下を追加:
   - export const TRAINING_GOAL_LABELS: Record<TrainingGoal, string> = { hypertrophy: "筋肥大", strength: "筋力向上", fat_loss: "減量", maintenance: "健康維持" };
   - export const EXPERIENCE_LEVEL_LABELS: Record<ExperienceLevel, string> = { beginner: "初心者", intermediate: "中級者", advanced: "上級者" };
   - 必要なら import { TrainingGoal, ExperienceLevel } from "@/lib/types" を追加。

完了条件:
- `npm run build` がエラーなく通る
- 既存の他ファイルからの import が壊れていない
```

---

## Step 4: プロフィールのデータアクセス層

### 読むべき既存ファイル
- `src/lib/data.ts` (パターン)
- `src/lib/supabase/server.ts` (`requireUser`)

### 作成・編集するファイル
- 新規: `src/lib/profile.ts`

### 完了条件
- `npm run build` が通る

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 4: プロフィールのデータアクセス層を作る。

参照: src/lib/data.ts (Supabase 呼び出しスタイル), src/lib/supabase/server.ts (requireUser)

タスク:
新規ファイル `src/lib/profile.ts` を作る。`UserProfile` 型は `@/lib/types` から import。

エクスポートする関数:

1. `getUserProfile(): Promise<UserProfile | null>`
   - requireUser() で supabase, user を取得
   - user_profiles から user_id = user.id の行を SELECT
   - 行がなければ null を返す（トリガで作られているはずだが防御的に）

2. `upsertUserProfile(input: Partial<Omit<UserProfile, "user_id">>): Promise<void>`
   - requireUser() を使う
   - user_profiles を user_id = user.id で update (なければ insert)
   - ai_suggestion_enabled は本関数では更新しない（管理者のみ変更可能 → input から除外する）

3. `markOnboardingCompleted(): Promise<void>`
   - onboarding_completed = true を user_profiles に書き込む

注意:
- `any` 禁止。Supabase の戻り値型は明示する。
- 各関数の冒頭で型を絞る。
- error が発生したら throw new Error(error.message)。

完了条件:
- `npm run build` が通る
```

---

## Step 5: オンボーディング画面

### 読むべき既存ファイル
- `app/record/page.tsx`, `app/record/record-form.tsx`, `app/record/actions.ts` (Server Action + Client Form パターン)
- `src/components/phone-shell.tsx`, `src/components/ui.tsx`

### 作成・編集するファイル
- 新規: `app/onboarding/page.tsx`
- 新規: `app/onboarding/onboarding-form.tsx`
- 新規: `app/onboarding/actions.ts`

### 完了条件
- 4ステップウィザードが動く
- 完了時に `user_profiles` が更新され、`/dashboard` へ遷移

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 5: オンボーディング画面を作る。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §5
参照コード:
- app/record/page.tsx, app/record/record-form.tsx, app/record/actions.ts (Server Action + Client Form の組み合わせ方の参考)
- src/components/ui.tsx (PageTitle, Card, Pill, PrimaryButton, OutlineButton)
- src/components/phone-shell.tsx (PhoneShell でラップ)
- src/lib/profile.ts (Step 4 で作成済み)
- src/lib/constants.ts の TRAINING_GOAL_LABELS, EXPERIENCE_LEVEL_LABELS

タスク:

1. `app/onboarding/actions.ts` (Server Action):
   "use server"
   export type SaveOnboardingState = { ok: boolean; message?: string };
   export async function saveOnboarding(input: {
     training_goal: TrainingGoal;
     experience_level: ExperienceLevel;
     weekly_frequency: number;
     focus_muscle_group_ids: string[];
   }): Promise<SaveOnboardingState>
   - 入力検証: training_goal は4択のいずれか / experience_level は3択 / weekly_frequency は1〜7
   - upsertUserProfile + markOnboardingCompleted を呼ぶ
   - 成功時 revalidatePath("/dashboard")

2. `app/onboarding/page.tsx` (Server Component):
   - requireUser() で認証
   - getUserProfile() を呼び、onboarding_completed === true なら redirect("/dashboard")
   - getMasterData() (既存 src/lib/data.ts) で muscleGroups を取得
   - <PhoneShell> で OnboardingForm にプロファイル初期値と muscleGroups を渡す
   - export const dynamic = "force-dynamic"

3. `app/onboarding/onboarding-form.tsx` (Client Component, "use client"):
   - 状態: currentStep (1〜4), 各ステップの入力値
   - Step 1: 4枚のカードで TrainingGoal 選択
   - Step 2: 3枚のカードで ExperienceLevel 選択
   - Step 3: 1〜7 をボタンで選択
   - Step 4: muscleGroups からマルチセレクト Pill (スキップ可)
   - 各ステップに「次へ」/「戻る」、最終ステップで「はじめる」
   - 「はじめる」で saveOnboarding をコールし、成功で router.push("/dashboard")
   - 各ステップで上部に「STEP n/4」のインジケータ

UIスタイル:
- 既存の Card/Pill/PrimaryButton/OutlineButton を再利用
- アクセントは macho-lime
- 選択中のカードは border-macho-lime + bg-macho-lime/10

完了条件:
- `npm run build` が通る
- ブラウザで /onboarding にアクセスすると 4 ステップ進めて保存できる
```

---

## Step 6: `requireUser` を拡張してオンボーディング強制リダイレクト

### 読むべき既存ファイル
- `src/lib/supabase/server.ts`
- `app/dashboard/page.tsx`, `app/record/page.tsx`, `app/history/page.tsx` (現在の `requireUser` 利用箇所)

### 作成・編集するファイル
- 編集: `src/lib/supabase/server.ts`
- 編集: 認証が必要なページ全部（`requireUser` 呼び出し箇所）

### 完了条件
- `onboarding_completed = false` のユーザーがどのページに飛んでも `/onboarding` にリダイレクトされる
- `/onboarding` 自体は除外

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 6: オンボーディング強制リダイレクトを追加する。

参照: src/lib/supabase/server.ts, src/lib/profile.ts (Step 4)

タスク:

1. `src/lib/supabase/server.ts` を編集:
   - 既存の requireUser() に加えて、新規関数 requireOnboardedUser() を追加:
     export async function requireOnboardedUser() {
       const result = await requireUser();
       const supabase = result.supabase;
       const userId = result.user.id;
       const { data: profile } = await supabase
         .from("user_profiles")
         .select("onboarding_completed")
         .eq("user_id", userId)
         .maybeSingle();
       if (!profile || !profile.onboarding_completed) {
         redirect("/onboarding");
       }
       return result;
     }
   - import { redirect } は既存。

2. 以下のページの `requireUser()` を `requireOnboardedUser()` に置き換える:
   - app/dashboard/page.tsx (getWorkouts 内で使われているので、getWorkouts 等のヘルパ側で置き換える必要があれば調整)
   - app/record/page.tsx
   - app/history/page.tsx
   - app/history/[id]/edit/page.tsx
   注意: `src/lib/data.ts` の `getMasterData`, `getWorkouts`, `getWorkoutById` で `requireUser` が使われている。これらはオンボーディング前のオンボーディング画面でも使われるため、変更しない（または既存のままにする）。代わりに各 page.tsx の先頭で `await requireOnboardedUser()` を実行してリダイレクトをかける形にする。
   - app/onboarding/page.tsx と app/auth/callback/route.ts は引き続き requireUser() のまま（または onboarding は requireUser のまま）。

3. ルート画面 app/page.tsx (ログイン画面) はそのまま。

完了条件:
- `npm run build` が通る
- onboarding 未完了ユーザーが /dashboard /record /history に飛ぶと /onboarding にリダイレクトされる
- /onboarding 自体には入れる
```

---

## Step 7: プロフィール設定画面

### 読むべき既存ファイル
- `app/onboarding/*` (Step 5 で作ったコンポーネント)
- `src/lib/profile.ts`

### 作成・編集するファイル
- 新規: `app/settings/profile/page.tsx`
- 新規: `app/settings/profile/profile-form.tsx`
- 新規: `app/settings/profile/actions.ts`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 7: プロフィール設定画面を作る。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §5.3
参照コード:
- app/onboarding/onboarding-form.tsx (UI部品を流用)
- src/lib/profile.ts
- src/lib/data.ts の getMasterData

タスク:

1. `app/settings/profile/actions.ts`:
   "use server"
   export async function saveProfile(input: { training_goal, experience_level, weekly_frequency, focus_muscle_group_ids }): Promise<{ ok: boolean; message?: string }>
   - upsertUserProfile を呼ぶ（ai_suggestion_enabled, onboarding_completed は触らない）
   - 成功時 revalidatePath("/settings/profile")

2. `app/settings/profile/page.tsx` (Server Component):
   - requireOnboardedUser()
   - getUserProfile() で現在値、getMasterData() で muscleGroups
   - PhoneShell で ProfileForm に初期値と muscleGroups を渡す
   - 上部に「プロフィール設定」見出し、戻るリンク (/dashboard)
   - export const dynamic = "force-dynamic"

3. `app/settings/profile/profile-form.tsx` ("use client"):
   - 1画面で4セクション (ウィザードではない):
     - トレーニングの目的 (4カードから単一選択)
     - レベル (3カードから単一選択)
     - 週の頻度 (1〜7 ボタン)
     - 重点部位 (Pill のマルチ選択)
   - 最下部に「保存」ボタン
   - 保存成功で「保存しました」をトースト的にCard内に表示 + router.refresh()

完了条件:
- `npm run build` が通る
- /settings/profile に入って値を編集し保存できる
```

---

## Step 8: テンプレートのデータアクセス層

### 読むべき既存ファイル
- `src/lib/data.ts`

### 作成・編集するファイル
- 新規: `src/lib/templates.ts`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 8: テンプレートのデータアクセス層を作る。

参照: src/lib/data.ts (normalize パターン), src/lib/types.ts (WorkoutTemplate, TemplateExercise)

タスク:
新規ファイル `src/lib/templates.ts` を作り、以下をエクスポート:

1. listTemplates(): Promise<WorkoutTemplate[]>
   - requireOnboardedUser()
   - workout_templates from(...) .select("id,name,source,source_log_id,created_at,template_exercises(*)")
     .eq("user_id", user.id)
     .order("created_at", { ascending: false })
   - template_exercises は sort_order asc

2. getTemplateById(id: string): Promise<WorkoutTemplate | null>
   - 同様。.eq("id", id).maybeSingle()

3. deleteTemplate(id: string): Promise<void>
   - workout_templates から user_id 一致のものを削除（RLSで防御済みだが念のため eq("user_id", user.id)）

4. createTemplate(input: { name: string; source: TemplateSource; source_log_id: string | null; exercises: Array<Omit<TemplateExercise, "id">>; }): Promise<string>
   - workout_templates insert → 戻り id を取得
   - template_exercises に exercises 配列を insert（template_id を埋める）
   - 戻り値はテンプレ id

型ガード:
- 各関数で any を使わない
- error は throw new Error

完了条件:
- `npm run build` が通る
```

---

## Step 9: テンプレート用 Server Actions

### 読むべき既存ファイル
- `app/record/actions.ts`, `app/history/actions.ts`
- `src/lib/templates.ts` (Step 8)

### 作成・編集するファイル
- 新規: `app/templates/actions.ts`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 9: テンプレートの Server Actions を作る。

参照: app/record/actions.ts, app/history/actions.ts (パターン)
依存: src/lib/templates.ts

タスク:
新規ファイル `app/templates/actions.ts`:
"use server"

export async function deleteTemplateAction(id: string): Promise<{ ok: boolean; message?: string }>
  - deleteTemplate(id) を呼ぶ
  - revalidatePath("/templates")
  - 成功で { ok: true }

export async function saveSuggestionAsTemplateAction(input: {
  suggestion_id: string;
  name: string;
}): Promise<{ ok: boolean; template_id?: string; message?: string }>
  - ai_suggestion_logs から suggestion_id の response_payload を取得（self の log のみ）
  - response_payload.exercises を TemplateExercise の形に変換
  - createTemplate({ name, source: "ai_suggestion", source_log_id: suggestion_id, exercises }) を呼ぶ
  - revalidatePath("/templates")
  - 戻り値に template_id

完了条件:
- `npm run build` が通る
```

---

## Step 10: テンプレート一覧画面

### 読むべき既存ファイル
- `app/history/page.tsx` (一覧UIパターン)
- `src/lib/templates.ts`

### 作成・編集するファイル
- 新規: `app/templates/page.tsx`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 10: テンプレート一覧画面を作る。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §7.1
参照コード: app/history/page.tsx (カード一覧UI), src/components/ui.tsx, src/components/phone-shell.tsx

タスク:
新規ファイル `app/templates/page.tsx` (Server Component):
- export const dynamic = "force-dynamic";
- requireOnboardedUser()
- listTemplates() で取得
- PhoneShell でラップ
- 上部にタイトル「テンプレート」
- 取得結果が空なら EmptyState (Card で「テンプレートはまだありません」)
- 各テンプレを Card で表示:
  - name
  - source バッジ (source === "ai_suggestion" ? "AI" : "手動")
  - 種目数 (`template_exercises.length`)
  - 作成日 (formatShortDate)
  - Card 全体が <Link href={`/templates/${id}`}> でラップ
- フィルタ: 一覧上部に Pill で 全て / AI提案 / 手動 (URL クエリ ?source=ai_suggestion 等で切り替え)
- (フィルタは Server Component 内で searchParams を読んで分岐する。Pill は <Link href="?source=ai"> 形式の Server-rendered リンクでよい)

完了条件:
- `npm run build` が通る
- /templates にアクセスするとテンプレ一覧が出る
```

---

## Step 11: テンプレート詳細画面

### 読むべき既存ファイル
- `app/history/[id]/edit/page.tsx` (動的ルートの参考)
- `src/lib/templates.ts`

### 作成・編集するファイル
- 新規: `app/templates/[id]/page.tsx`
- 新規: `app/templates/[id]/template-actions.tsx` (削除ボタン用 client component)

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 11: テンプレート詳細画面を作る。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §7.2
参照コード: app/history/[id]/edit/page.tsx (動的ルート), app/templates/actions.ts (Step 9)

タスク:

1. `app/templates/[id]/page.tsx` (Server Component, dynamic = "force-dynamic"):
   - requireOnboardedUser()
   - params の id で getTemplateById(id) を呼ぶ
   - 取れなければ notFound()
   - PhoneShell でラップ
   - 上部にタイトル「テンプレート詳細」、戻るリンク (/templates)
   - テンプレ名・作成日・source バッジを表示
   - 種目リスト (Card 内に sort_order 順):
     - 種目名 / muscle_group / equipment 名
     - target_sets x target_reps @ target_weight_kg
     - notes
   - アクション:
     - PrimaryButton「このメニューで記録開始」→ <Link href={`/record?template_id=${id}`}>
     - Step 11-2 の <TemplateActions /> client コンポーネントを下部に置く

2. `app/templates/[id]/template-actions.tsx` ("use client"):
   - props: { templateId: string }
   - OutlineButton「削除」→ confirm 後 deleteTemplateAction(templateId) を呼ぶ
   - 成功で router.push("/templates")

完了条件:
- `npm run build` が通る
- /templates/{id} に入って種目が見え、削除が動く
- 「このメニューで記録開始」が /record?template_id=... へ遷移する（実装は Step 12）
```

---

## Step 12: 記録画面のテンプレート初期値対応

### 読むべき既存ファイル
- `app/record/page.tsx`
- `app/record/record-form.tsx`
- `src/lib/templates.ts`

### 作成・編集するファイル
- 編集: `app/record/page.tsx`
- 編集: `app/record/record-form.tsx`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 12: 記録画面でテンプレート初期値を受け取れるようにする。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §7.3
参照コード: app/record/page.tsx, app/record/record-form.tsx (現状の実装)

タスク:

1. `app/record/page.tsx`:
   - props に `searchParams: Promise<{ template_id?: string }>` を追加 (Next 15 のシグネチャ)
   - searchParams.template_id があれば getTemplateById(template_id) を呼ぶ
   - 取得結果を RecordForm に initialExercises として渡す
   - 取れなかったり該当しなければ initialExercises は undefined

2. `app/record/record-form.tsx`:
   - 既存 props に optional `initialExercises?: WorkoutTemplate["template_exercises"]` を追加
   - 既存の state 初期化部分で initialExercises があれば、それを NewExercisePayload[] に変換して State の exercises 初期値とする:
     - exercise_type = muscle_group_id があれば "strength" / なければ "cardio" にフォールバック（テンプレはまず strength 想定）
     - muscle_sub_group_ids は muscle_sub_group_id を配列に
     - weight_kg = target_weight_kg ?? 0
     - reps = target_reps ?? 0
     - sets = target_sets ?? 1
     - duration_minutes / distance_km / calories = null
   - フォーム上部に「テンプレート「{name}」を読み込みました」のような通知 Card を1度だけ出す（initialExercises がある時のみ）

完了条件:
- `npm run build` が通る
- /record?template_id={id} に遷移すると種目入力欄が埋まった状態で表示される
- 「ワークアウトを保存」で通常通り保存できる
```

---

## Step 13: OpenAI クライアントとプロンプト構築

### 読むべき既存ファイル
- `src/lib/supabase/env.ts` (env 取得パターン)
- `docs/SPECIFICATION_AI_SUGGESTION.md` §9

### 作成・編集するファイル
- 新規: `src/lib/ai/env.ts`
- 新規: `src/lib/ai/client.ts`
- 新規: `src/lib/ai/prompt.ts`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 13: OpenAI クライアントとプロンプト構築モジュールを作る。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §9
参照コード: src/lib/supabase/env.ts (env helper パターン)

タスク:

1. `src/lib/ai/env.ts`:
   - export function getOpenAIApiKey(): string  -> process.env.OPENAI_API_KEY を返す。未設定なら throw。
   - export function getOpenAIModel(): string -> process.env.OPENAI_MODEL ?? "gpt-5-mini"
   - export function getAIRateLimitPerDay(): number -> Number(process.env.AI_RATE_LIMIT_PER_DAY ?? 10)
   - export function getAIRateLimitPerMonth(): number -> Number(process.env.AI_RATE_LIMIT_PER_MONTH ?? 100)
   - export function getMonthlyCallLimit(): number -> Number(process.env.MONTHLY_AI_CALL_LIMIT ?? 3000)
   - export function getCacheTtlHours(): number -> Number(process.env.AI_CACHE_TTL_HOURS ?? 1)
   - export function getAIMaxTokens(): number -> Number(process.env.AI_MAX_TOKENS ?? 1000)

2. `src/lib/ai/client.ts`:
   - import OpenAI from "openai"
   - export function getOpenAIClient(): OpenAI -> new OpenAI({ apiKey: getOpenAIApiKey() })

3. `src/lib/ai/prompt.ts`:
   - export type PromptInput = {
       profile: UserProfile;
       targetMuscleGroupIds: string[];
       theme: string | null;
       recentWorkoutsSummary: string;
       muscleGroups: MuscleGroup[];
       equipment: Equipment[];
     };
   - export function buildSystemPrompt(): string  -> 仕様書 §9 の System プロンプトを返す
   - export function buildUserPrompt(input: PromptInput): string -> §9 の User プロンプトテンプレを展開
     - target/focus muscle group は ID と一緒に「胸 (uuid:...)」のように両方提示
     - muscleGroups, equipment はマスタデータ一覧として ID 付きで埋め込む
   - export const SUGGESTION_RESPONSE_SCHEMA: 仕様書 §9 のレスポンスJSONスキーマを object として返せるよう定義

完了条件:
- `npm run build` が通る
- 各関数が単独で呼び出せる
```

---

## Step 14: AI提案サーバーロジック (rate limit + cache + call)

### 読むべき既存ファイル
- Step 13 の `src/lib/ai/*`
- `src/lib/data.ts` の `getWorkouts`

### 作成・編集するファイル
- 新規: `src/lib/ai/suggest.ts`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 14: AI提案のサーバーロジックを実装する。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §2, §8.1 のサーバー処理フロー
依存: Step 13 の src/lib/ai/*, src/lib/data.ts (getMasterData, getWorkouts), src/lib/profile.ts

タスク:
新規ファイル `src/lib/ai/suggest.ts` に、メインの関数 `generateSuggestion` を実装。
これは API Route から呼ばれる単一エントリポイント。

import crypto from "node:crypto";

エクスポート関数:
export type GenerateSuggestionInput = {
  targetMuscleGroupIds: string[];
  theme: string | null;
};

export type GenerateSuggestionResult =
  | { kind: "success"; payload: SuggestionResult }
  | { kind: "cached"; payload: SuggestionResult }
  | { kind: "forbidden" }
  | { kind: "rate_limited"; resetAt: string; scope: "daily" | "monthly" | "global" }
  | { kind: "error"; message: string };

export async function generateSuggestion(input: GenerateSuggestionInput): Promise<GenerateSuggestionResult>

処理フロー (仕様書 §8.1 通り):

1. requireOnboardedUser() で supabase, user
2. getUserProfile() で profile を取得。profile.ai_suggestion_enabled !== true なら ai_suggestion_logs に status=forbidden で1件insertして { kind: "forbidden" } を返す
3. 個別レート制限チェック:
   - 当日 (today 00:00 〜) の self log の status='success' or 'cached' 件数を count
   - 当月 (月初〜) の self log の同様カウント
   - 上限超過なら status=rate_limited で log insert し、{ kind: "rate_limited", resetAt, scope } を返す
4. グローバルキャップ:
   - 当月の全 user の status='success' 件数を count
   - 上限超過なら status=rate_limited(scope global) で log insert し返却
5. input_hash = sha256(`${user.id}:${[...targetMuscleGroupIds].sort().join(',')}:${theme ?? ''}`).digest('hex')
6. キャッシュ判定:
   - ai_suggestion_logs where user_id = self and input_hash = input_hash and status = 'success' and created_at >= now() - INTERVAL '{ttl} hour' order by created_at desc limit 1
   - あれば response_payload をパースして、status=cached のログを insert (cost 0)、{ kind: "cached", payload: response_payload }
7. getWorkouts(20) で直近2週間分のサマリ生成 (今日から14日前 createdAt > 14d ago)
   - recentWorkoutsSummary: 「2026-06-20: 胸 (ベンチプレス 60kg x 8 x 4set, ダンベルフライ ...)」のような複数行テキスト
8. getMasterData() で muscleGroups, equipment 取得
9. buildSystemPrompt() / buildUserPrompt() でプロンプト構築
10. getOpenAIClient().chat.completions.create({
      model: getOpenAIModel(),
      response_format: { type: "json_object" },
      max_tokens: getAIMaxTokens(),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    })
11. レスポンスをパース。SUGGESTION_RESPONSE_SCHEMA 形式の検証:
    - exercises 配列が3〜5
    - 各 exercise の muscle_group_id がマスタに存在
    - muscle_sub_group_id, equipment_id が存在チェック (null 可)
    - target_sets, target_reps が int >= 1
    - target_weight_kg は number or null
    検証失敗なら status=error で log insert、{ kind: "error", message } を返す
12. トークン数とコストを計算 (gpt-5-mini: input $0.25/1M, output $2.0/1M で概算):
    cost = (prompt_tokens * 0.25 + completion_tokens * 2.0) / 1_000_000
13. ai_suggestion_logs に status=success で insert (request_payload, response_payload, prompt_tokens, completion_tokens, total_tokens, cost_usd)
14. 直近の usage 件数を取り直して remaining_today / remaining_this_month を計算
15. SuggestionResult { suggestion_id (insertされたlogのid), overall_comment, exercises, usage } を返す

注意:
- ai_suggestion_logs への insert は Service Role キーで行う必要がある（RLS で client から書けないため）。
  → このため `src/lib/supabase/admin.ts` を新規作成して service role キーで作る serverClient を用意する。
  → SUPABASE_SERVICE_ROLE_KEY 環境変数を参照（.env.local.example にも追加すること）。
- count クエリは `supabase.from('ai_suggestion_logs').select('id', { count: 'exact', head: true })...` で。
- 例外は catch して status=error の log を作って返す。

完了条件:
- `npm run build` が通る
- 関数単体での import エラーなし
```

---

## Step 15: `/api/suggest` エンドポイント

### 読むべき既存ファイル
- `app/auth/callback/route.ts` (Next App Router の Route Handler パターン)
- Step 14 の `src/lib/ai/suggest.ts`

### 作成・編集するファイル
- 新規: `app/api/suggest/route.ts`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 15: /api/suggest の Route Handler を作る。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §8.1
参照コード: app/auth/callback/route.ts (Route Handler パターン)
依存: src/lib/ai/suggest.ts (Step 14)

タスク:
新規ファイル `app/api/suggest/route.ts`:

import { NextResponse } from "next/server";
import { generateSuggestion } from "@/lib/ai/suggest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const target_muscle_group_ids = Array.isArray(body?.target_muscle_group_ids) ? body.target_muscle_group_ids : [];
  const theme = typeof body?.theme === "string" ? body.theme : null;

  if (target_muscle_group_ids.length === 0) {
    return NextResponse.json({ error: "no_target" }, { status: 400 });
  }

  const result = await generateSuggestion({
    targetMuscleGroupIds: target_muscle_group_ids,
    theme,
  });

  switch (result.kind) {
    case "success":
    case "cached":
      return NextResponse.json(result.payload);
    case "forbidden":
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    case "rate_limited":
      return NextResponse.json(
        { error: "rate_limit_exceeded", scope: result.scope, reset_at: result.resetAt },
        { status: 429 },
      );
    case "error":
      return NextResponse.json({ error: "generation_failed", message: result.message }, { status: 500 });
  }
}

完了条件:
- `npm run build` が通る
- 認証済みかつ ai_suggestion_enabled=true のユーザーが POST /api/suggest にリクエストすると 200 が返る
- 未許可ユーザーは 403
- 過剰リクエストは 429
```

---

## Step 16: AI提案画面

### 読むべき既存ファイル
- `app/record/record-form.tsx` (Client Component の作法)
- Step 14, 15 のサーバー側

### 作成・編集するファイル
- 新規: `app/suggest/page.tsx`
- 新規: `app/suggest/suggest-form.tsx`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 16: AI提案画面を作る。

参照仕様: docs/SPECIFICATION_AI_SUGGESTION.md §6
参照コード: app/record/record-form.tsx (Client Form), src/components/ui.tsx
依存: app/templates/actions.ts (saveSuggestionAsTemplateAction)

タスク:

1. `app/suggest/page.tsx` (Server Component):
   - requireOnboardedUser()
   - getUserProfile() で profile を取得
   - profile.ai_suggestion_enabled !== true なら notFound() ではなく Card で「準備中」を出して終わる
   - getMasterData() で muscleGroups
   - PhoneShell で SuggestForm にプロファイルと muscleGroups を渡す
   - export const dynamic = "force-dynamic";

2. `app/suggest/suggest-form.tsx` ("use client"):
   - State: targetIds (デフォルトは profile.focus_muscle_group_ids), theme (string), loading, suggestion (SuggestionResult | null), error (string | null)
   - 上部に部位選択 (Pill マルチ), テーマ入力 (text)
   - PrimaryButton「提案を生成」→ fetch("/api/suggest", { method: "POST", body: JSON.stringify({ target_muscle_group_ids: targetIds, theme }) })
     - 429 / 403 / 500 はそれぞれ日本語メッセージにマッピング
   - 結果表示エリア (suggestion 非 null 時):
     - overall_comment を Card
     - exercises を Card で並べる: exercise_name, target_sets x target_reps @ target_weight_kg kg, notes
     - 使用状況「今日 X 回 / 月 Y 回 残り」
     - Action: OutlineButton「テンプレートとして保存」/ OutlineButton「再生成」/ PrimaryButton「閉じる」
   - 「テンプレートとして保存」: テンプレ名のプロンプト or 自動生成 (例: `AI提案 - {YYYY/MM/DD}`)、 saveSuggestionAsTemplateAction を呼ぶ → 成功で router.push(`/templates/${id}`)
   - 「再生成」は同じ条件で再 POST する。レート消費する旨の確認ダイアログ。

完了条件:
- `npm run build` が通る
- /suggest で部位を選んで「提案を生成」をクリックすると結果が表示される
- 「テンプレートとして保存」で /templates/{id} へ遷移する
```

---

## Step 17: ダッシュボード動線 / ナビゲーション

### 読むべき既存ファイル
- `app/dashboard/page.tsx`

### 作成・編集するファイル
- 編集: `app/dashboard/page.tsx`

### Codexプロンプト

```
リポジトリ macho の「AIメニュー提案機能」Step 17 (最終): ダッシュボードからの動線を整える。

参照: app/dashboard/page.tsx (現状), src/lib/profile.ts

タスク:

1. `app/dashboard/page.tsx`:
   - getUserProfile() を呼んで profile を取得
   - 既存の「AIメニュー提案」Card (現状 opacity-35 で coming soon):
     - profile?.ai_suggestion_enabled === true の場合:
       - <Link href="/suggest"> でラップ
       - opacity-35 を外す
       - サブテキストを「ChatGPTが次回メニューを提案」に変更
     - false の場合:
       - 現状の coming soon 表示のまま、リンクなし
   - 「最近の記録」セクションの上または下に「テンプレート」Card を追加:
     - <Link href="/templates"> で Card 全体ラップ
     - アイコン: lucide-react の "BookOpen" 等
     - タイトル「テンプレート」
     - サブテキスト「保存したメニューから記録を開始」
   - プロフィール設定への動線として、ヘッダー右上に小さい設定アイコン (Settings) を追加し /settings/profile へ
     - PhoneShell の構造に合わせて配置。難しければダッシュボード最下部 (最近の記録の下) に小さく追加でも可

完了条件:
- `npm run build` が通る
- ダッシュボードから /suggest, /templates, /settings/profile へ動線がある
- ai_suggestion_enabled が false の場合は /suggest カードは無効化表示
```

---

## 動作確認チェックリスト (全Step完了後)

- [ ] Supabase 管理画面で自分の `user_profiles.ai_suggestion_enabled` を `true` に設定済み
- [ ] `.env.local` に `OPENAI_API_KEY` と `SUPABASE_SERVICE_ROLE_KEY` を設定済み
- [ ] 新規ユーザーでログイン → `/onboarding` に強制リダイレクトされる
- [ ] オンボーディング完了 → ダッシュボードに着く
- [ ] `/settings/profile` で値を編集 → 保存される
- [ ] `/templates` でテンプレ一覧が見える（空でもエラーなし）
- [ ] `/suggest` で部位を選んで生成 → 結果が表示される
- [ ] 「テンプレートとして保存」→ `/templates/{id}` に遷移、種目が表示される
- [ ] 「このメニューで記録開始」→ `/record?template_id=...` に飛び、種目が事前入力されている
- [ ] レート上限を超えるリクエストが 429 で弾かれる
- [ ] 同一条件の再リクエストが「キャッシュ」として返ってくる（log の status=cached が増える）

## 既知の留意点

- `SUPABASE_SERVICE_ROLE_KEY` はサーバー専用。`NEXT_PUBLIC_` プレフィックスを付けないこと。
- `ai_suggestion_enabled` のトグルは管理者のみ。UI は提供しない。
- 仕様書 §12 の課金フェーズ（subscription_tier）は本フェーズの実装対象外。
