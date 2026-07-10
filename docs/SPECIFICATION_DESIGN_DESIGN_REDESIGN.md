# デザイン刷新 基本設計・詳細設計

対象: MACHO（Next.js 15 / React 19 / Tailwind CSS v4 / Supabase）  
対象要件: `SPECIFICATION_REQUIREMENTS_DESIGN_REDESIGN.md` の R1〜R14（P1〜P4）  
前提: デザイン原則、トークン値、モーション値は `SPECIFICATION_DESIGN_REDESIGN.md` を正とする。

## 1. 設計方針

- 「ジムで片手・30秒で記録」の既存フロー、ダーク+ライム+Bebas Neue のブランド、サーバー側の認証・データ取得・保存処理を維持する。今回の変更は表示、局所的なクライアント状態、操作フィードバックに限定する。
- 依存追加は `motion` のみとし、クライアントコンポーネントでは `motion/react` を使用する。CSS `transition` は hover・focus 等の非ジェスチャ状態に残し、motion 化したタップ対象は `whileTap={{ scale: 0.97 }}` に統一する。
- P5 の Sheet、ドラッグ、ラバーバンド、スワイプ削除、P6 の数値カウントアップ・チャート伸長・保存演出、履歴カードの展開は OUT である。本書では設計・実装対象に含めない。
- URL は `/dashboard?range=`、`/history?muscle=` の現在の値と省略時の意味を維持する。未知値は現状どおり dashboard は `today`、history は全件として扱う。

## 2. 基本設計

### 2.1 変更対象と責務

| 区分 | ファイル | 変更内容・責務 |
| --- | --- | --- |
| 基盤 | `package.json` / lockfile | `motion` だけを追加する。ほかの依存は追加しない。 |
| 基盤 | `app/globals.css` | 色・形状・タイプスケールの CSS カスタムプロパティ、Tailwind v4 の theme 公開、マテリアル、3種のアクセシビリティ媒体クエリ、fine pointer 用スクロールバーを定義する。 |
| 基盤 | `src/lib/motion.ts`（新規） | 今回使用する標準 spring 定数と reduced-motion 用の variants/transition を一元化する。Sheet/flick 用の未使用定数は置かない。 |
| 基盤 | `src/lib/design-filters.ts`（新規） | dashboard の range と history の muscle を URL 値から正規化する純粋関数・型を、RSC と Client Component の共通実装として提供する。 |
| 共通 | `src/components/ui.tsx` | `Card`、`Pill`、`PageTitle`、ボタン、`BottomNav` にトークンを適用する。`BottomNav` はクライアント部品へ分離して motion を使う。 |
| 共通 | `src/components/toast.tsx`（新規） | ToastProvider、`useToast()`、Toast viewport を提供する。完了・エラー・Undo の表示、タイムアウト、復元コールバックを管理する。 |
| 共通 | `app/layout.tsx` | `ToastProvider` を body 直下で children を包む。RSC レイアウトからクライアント Provider をレンダリングするだけであり、全ページをクライアント化しない。 |
| 共通 | `src/components/phone-shell.tsx` | スクロールコンテナがナビの下まで伸びる構成に調整し、コンテンツ終端の padding と safe area を確保する。 |
| dashboard | `app/dashboard/page.tsx` | 認証・`getAllWorkouts()`・直リンクの range 正規化を RSC に残し、計算に必要な全 workout をクライアント部品へ渡す。表示状態の導出は client 側で同じ正規化関数を使う。 |
| dashboard | `app/dashboard/dashboard-client.tsx`（新規） | 期間タブ、クライアント側フィルタ、URL 同期、共有レイアウト選択背景、統計・週間チャート描画を担当する。 |
| history | `app/history/page.tsx` | 認証・`getMasterData()`・`getWorkouts(50)`・直リンクの muscle 正規化を RSC に残し、groups、workouts をクライアント部品へ渡す。表示状態の導出は client 側で同じ正規化関数を使う。 |
| history | `app/history/history-client.tsx`（新規） | フィルタ Pill、クライアント側フィルタ、URL 同期、カードの layout / exit 表示、44px 編集ボタンを担当する。 |
| record | `app/record/record-form.tsx` | Toast による検証・保存通知、Undo 対応の exercise 削除、サジェストの pointer-down 選択とアンカー出現、Stepper の共通化を行う。保存 Server Action は変更しない。 |
| record/edit 共通 | `src/components/workout-sets.tsx` | `SetRowsEditor` の set 削除を Undo 化できるコールバック契約へ変更し、`MiniStepper` を長押し対応の共通部品へ置換する。 |
| record/edit 共通 | `src/components/stepper.tsx`（新規） | 通常/mini の双方に使う `PressAndHoldStepperButton`、値パルスを提供する。 |
| edit | `app/history/[id]/edit/edit-workout-form.tsx` | record と同じサジェスト、Toast、Undo、Stepper、44px ターゲットを適用する。更新 Server Action と全記録削除の既存確認導線は変えない。 |

`app/history/[id]/edit/edit-workout-form.tsx` は R9/R10/R11/R12 の同じ記録編集体験に含まれるため、上記の共通部品を再利用する。テンプレート・設定・料金画面はトークンの波及のみで、個別の再設計は行わない。

### 2.2 RSC / クライアント境界

```text
DashboardPage (RSC)
  requireOnboardedUser + getAllWorkouts + searchParams の共通正規化
  └ DashboardClient (Client: initialWorkouts)
       URL導出フィルタ、表示用集計、history.replaceState、motion

HistoryPage (RSC)
  requireOnboardedUser + getMasterData + getWorkouts(50) + searchParams の共通正規化
  └ HistoryClient (Client: initialWorkouts, muscleGroups)
       URL導出フィルタ、ローカルフィルタ、history.replaceState、motion

RootLayout (RSC)
  └ ToastProvider (Client)
       └ 各 RSC / Client page
```

- dashboard/history の取得関数は RSC に残す。`src/lib/design-filters.ts` の同じ正規化関数を RSC と client から使用し、直リンク・更新時も同じ結果になる。
- `DashboardClient`/`HistoryClient` は fetch、Server Action、`router.refresh()` をフィルタ切替で実行しない。初期 props から純粋関数で再集計/再絞り込みする。
- フィルタの正は URL とする。client は `useSearchParams()` から `parseDashboardRange(searchParams.get("range") ?? undefined)` / `parseHistoryMuscle(searchParams.get("muscle") ?? undefined)` を都度導出し、独自の `useState` と同期用 `useEffect` は持たない。クリック時は `window.history.replaceState(null, "", path)` のみを実行する。Next.js Native History API により `useSearchParams()` は同期し、`force-dynamic` な RSC のサーバー往復を発生させない。
- ToastProvider は context と viewport だけを client boundary にし、RSC のデータ取得境界を広げない。Toast の発火元は `useToast()` を使える既存 client form とする。

### 2.3 新規コンポーネントの公開契約

| コンポーネント/モジュール | 主要 API |
| --- | --- |
| `src/lib/motion.ts` | `SPRING_STANDARD = { type: "spring", bounce: 0, duration: 0.35 }`、`reducedMotionTransition`、`getMotionProps(reduced)`。P5 実装時に限り、sheet/flick は stiffness / damping / mass / velocity を使う物理ベースの別設計を行う。 |
| `ToastProvider` | `ToastProvider({ children })`。画面下部・BottomNav 上端に viewport を固定表示する。 |
| `useToast()` | `show({ kind: "success" \| "error" \| "undo", message, durationMs?, onUndo? }): string` は toastId を返す。`dismiss(id): void` は現在表示中の Toast と ID が一致する場合だけ閉じる。`undo` の既定期限は 5,000ms。 |
| `src/lib/design-filters.ts` | `DashboardRange`、`HistoryMuscle`、`parseDashboardRange(value)`、`parseHistoryMuscle(value)`。RSC/client 双方で同じ URL 正規化結果を得る。 |
| `DashboardClient` | `{ initialWorkouts }`。`useSearchParams()` と `parseDashboardRange` から range を導出し、range filter・週間集計を計算する。 |
| `HistoryClient` | `{ initialWorkouts, muscleGroups }`。`useSearchParams()` と `parseHistoryMuscle` から muscle を導出する。 |
| `PressAndHoldStepperButton` | `{ direction, onStep, disabled?, ariaLabel }`。通常 click と pointer 長押しを一箇所に実装する。 |

## 3. 詳細設計（R1〜R14）

### R1 デザイントークン刷新

`globals.css` の `:root` に、既存色を残したうえで `--color-macho-danger: #ff6b6b`、`--color-macho-scrim: rgba(0,0,0,.5)`、`--material-nav: rgba(17,17,20,.72)`、`--material-sheet`、`--radius-s: 10px`、`--radius-m: 14px`、`--radius-l: 28px` を追加する。`@theme inline` に色・角丸・フォントサイズを公開し、ユーティリティは `bg-macho-danger`、`rounded-macho-s` 等の意味名を使う。DB 由来の部位色の淡色背景は、文字列への `1f` 連結ではなく `color-mix(in srgb, var(--muscle-color) 12%, transparent)` を使う局所 CSS 変数方式にする。

タイプスケールは Tailwind v4 の分離構文で定義する。すなわち `--text-display-xl: 2.125rem; --text-display-xl--line-height: 1; --text-display-xl--letter-spacing: .04em;`、`--text-display-num: 2rem; --text-display-num--line-height: 1; --text-display-num--letter-spacing: .02em;`、`--text-title: 1rem; --text-title--line-height: 1.3; --text-title--letter-spacing: -.01em;`、`--text-body: .875rem; --text-body--line-height: 1.5; --text-body--letter-spacing: 0;`、`--text-caption: .75rem; --text-caption--line-height: 1.4; --text-caption--letter-spacing: .01em;`、`--text-label: .6875rem; --text-label--line-height: 1.3; --text-label--letter-spacing: .02em;` とする。Tailwind の arbitrary px を、`text-display-xl` 等の token utility 又は意味を表す共通コンポーネントへ段階的に置換する。Bebas は display だけに適用し、日本語を含む title/body は Outfit とする。`html` の font-size は固定せず、input/select/textarea は iOS Safari の自動ズームを防ぐため常に 1rem 以上とする。

### R2 motion 導入とスプリング標準

`npm install motion` 後、`src/lib/motion.ts` を唯一の spring 値定義元とする。通常の表示、layout、タブ背景、Toast、サジェストは `SPRING_STANDARD` を使う。P5 は未実施のため `SPRING_SHEET`/`SPRING_FLICK` は今回定義しない。将来 P5 を実装する際は、stiffness / damping / mass / velocity を用いる物理ベースの設計を別途行う。固定 duration の CSS keyframes や motion transition は新設しない。

motion は `AnimatePresence`、`motion.div`、`motion.button`、`layout`、`layoutId` に限定する。アニメーション中の state 更新を遮断せず、同じ `layoutId` を持つ選択背景は現在位置から再ターゲットする。hover/focus の色・border だけは既存 CSS transition を維持する。

### R3 アクセシビリティ 3メディアクエリ

`globals.css` に次を追加する。

- `@media (prefers-reduced-motion: reduce)`: CSS の装飾 transition を実質無効化し、motion は各 client component の `const reduced = useReducedMotion()` を使う。reduced 時は transform/layout の初期・exit を指定せず、opacity だけを 200ms の cross-fade にするか、状態を即時表示する。
- `@media (prefers-reduced-transparency: reduce)`: `.bottom-nav` の background を `var(--color-macho-base)` に、`backdrop-filter` と `-webkit-backdrop-filter` を `none` にする。将来の material も同じクラスに従わせる。
- `@media (prefers-contrast: more)`: Card、ボタン、input、BottomNav の境界をより明るい不透明な 1px 線にする。ライム文字だけで状態を区別せず border / aria-current も保持する。
- `@media (pointer: fine)`: 隠している `::-webkit-scrollbar` を width/height 8px、thumb を muted 色で復活させる。通常のタッチ環境では現状の非表示を維持する。

### R4 半透明 BottomNav

`BottomNav` は `usePathname()` と motion を用いるため client component とする（`ui.tsx` 内に `"use client"` を置くか、`bottom-nav.tsx` に分離する）。nav は PhoneShell 内で常に下端に固定し、`.bottom-nav` に `background: var(--material-nav)`、`backdrop-filter: blur(20px) saturate(180%)` と webkit prefix、半透明 border を設定する。ラベルは「ホーム」から「ダッシュボード」へ変更する。

PhoneShell は nav の分だけコンテンツ領域を縮めない。外側は `relative`、スクロール領域は flex-1 のまま、nav を `absolute inset-x-0 bottom-0 z-10` にする。スクロール領域の `padding-bottom` は nav 高 + `env(safe-area-inset-bottom)` + 余白を確保し、最後の操作要素だけがナビ下に隠れないようにする。中央記録ボタンの突き出し分も含める。アクティブ NavItem は icon wrapper を `motion.span` にし、active 時 `scale: 1.08`、非 active 時 `scale: 1` を standard spring で遷移する。Link 自体は `whileTap` を持つ motion link 相当のラッパーで scale 0.97 にする。

### R5 ダッシュボード期間タブのクライアント化

RSC の `DashboardPage` は `getAllWorkouts()` で取得した全 workouts を `DashboardClient` に渡し、`searchParams` を同じ `parseDashboardRange` で正規化して直リンク値の妥当性を判断する。client は `useSearchParams()` の `searchParams.get("range") ?? undefined` から同関数で active range を導出し、現在 page にある `filterWorkoutsByRange`、統計値、`getWeeklyVolumes` を `useMemo` で計算する。初期取得済み配列だけを使うため切替は即時である。

RangeTabs は button 群（Link ではない）とし、クリック時に `window.history.replaceState(null, "", next === "today" ? "/dashboard" : "/dashboard?range=" + next)` を実行する。`useSearchParams()` が更新されれば active range は自動的に再導出される。選択背景は tab コンテナ内の `motion.div layoutId="dashboard-range-indicator"` を active button 内へ描画し、ラベルは z-index を上げる。`aria-current="page"` と `aria-pressed` を維持する。`useReducedMotion()` 時は layoutId を使わず、選択色を即時切替にする。

### R6 履歴フィルタのクライアント化

RSC の `HistoryPage` は現行と同じ `getMasterData()` と `getWorkouts(50)` を実行し、全件と groups を `HistoryClient` に渡す。RSC では `searchParams` を同じ `parseHistoryMuscle` で正規化して直リンク値の妥当性を判断する。client は `useSearchParams()` の `searchParams.get("muscle") ?? undefined` から同関数で active muscle を導出し、`useMemo` で cardio、group id、all の既存条件を再現する。`?muscle=all` を読んだ場合も全てとして表示するため互換性を維持する。

Pill は Link 内 button の入れ子を廃止し、`HistoryFilterPills` 内の button にする。クリックでは `window.history.replaceState(null, "", next === "all" ? "/history" : "/history?muscle=" + encodeURIComponent(next))` を呼ぶ。`useSearchParams()` が更新されれば active muscle は自動的に再導出される。選択背景は `layoutId="history-muscle-indicator"` を使う。カードリストは `AnimatePresence mode="popLayout"` と各カードの `layout` を使い、退出は reduced で即時、通常時は opacity と scale 0.98 の standard spring とする。編集 Link は視覚サイズを維持しても `min-h-11 min-w-11`（44px）に拡大する。

### R7 週間チャートの意味ある符号化

`getWeeklyVolumes` の各要素に JST の日付 key を持たせ、`toJstDateInputValue()` と比較する。bar の色は `key === today` をライム実色、そうでなく `volume > 0` をライム 40%、`volume === 0` をライム 10% とする。現行の index 偶奇判定を完全に削除する。高さの計算・チャート構造は維持し、P6 の伸長アニメーションは追加しない。

### R8 Toast コンポーネント

Toast state は Provider 内の `ToastItem | null`（`id`, `kind`, `message`, `durationMs`, `onUndo`）で管理する。一度に表示するのは最新1件とし、新規 show は既存タイマーを解除して置換する。`success`/`error` の既定表示は 3,000ms、`undo` は 5,000ms とする。viewport は `fixed inset-x-0 bottom-[calc(nav-height+env(safe-area-inset-bottom)+.75rem)] z-50` とし、画面幅内で PhoneShell と同等の max-width に合わせる。

通常時の entry は下方 `y: 12, opacity: 0` から `y: 0, opacity: 1` に standard spring、exit は同じ経路を逆にする。reduced 時は transform を使わない opacity cross-fade にする。error は `role="alert"`、成功は `role="status"`、Undo ボタンは 44px 以上、明確な「元に戻す」ラベルにする。

### R9 Undo 付き削除

対象は record-form と edit-workout-form のエクササイズ削除、SetRowsEditor 経由のセット削除である。記録全体の削除確認は既存仕様を維持し、確認なし削除への拡張はしない。

削除操作では対象と元 index を snapshot し、表示配列から即時除去する。各 form は `pendingDeletionRef` に `{ token, toastId, expiresAt: Date.now() + 5000, restore }` を保持する。`show({ kind: "undo", message: "…を削除しました", onUndo })` が返す toastId をこの ref に記録する。onUndo は、token が一致し、かつ `Date.now() < expiresAt` の両方を満たす場合だけ `splice(Math.min(index, current.length), 0, item)` で復元する。これはバックグラウンド時に iOS Safari のタイマーが遅延しても、期限切れの復元を防ぐ二重判定である。次の削除・保存・unmount で前の復元権を無効化する。タイムアウト満了は配列が既に削除済みなので追加の DB 操作をしない。保存時は現在配列のみを Server Action に渡し、期限切れ後の削除がそこで確定する。したがって既存 RPC/API の変更は不要で、保存前の入力保持も満たす。

成功/エラー Toast は Root Layout の Provider に属するためページ遷移後も表示を維持する。一方、フォーム内削除の Undo は遷移をまたがない。form の cleanup で token を無効化したうえで、保持した toastId を `dismiss(toastId)` に渡す。dismiss は現在表示中の Toast と ID が一致する場合だけ閉じるため、古い cleanup が新しい Toast を誤って消す競合を防ぎ、無効な「元に戻す」ボタンを遷移先へ残さない。保存時・新しい削除時も前の復元権を無効化する。

セットは最低1行の既存制約を先に判定し、1行だけなら削除操作を disabled のままにする。Undo 復元時は `sets` と `workout_sets` の長さ・先頭 weight/reps の整合を再計算する。リスト要素の key は index ではなく、各 set に client-only `local_key` を導入するか、削除/復元に耐える安定 key を用意して motion の誤対応付けを防ぐ。

### R10 サジェストリストのアンカー出現

record/edit のサジェストを共通 `ExerciseSuggestionList`（新規ファイルに分ける場合は `src/components/exercise-suggestion-list.tsx`）へ抽出する。props は `{ open, suggestions, onChoose, onDismiss, inputId }` とする。input を含む relative wrapper の下端に absolute 配置し、list の `transform-origin: top`、通常時 `initial={{ opacity: 0, scale: .96 }}` → `animate={{ opacity: 1, scale: 1 }}`、exit は逆値、transition は standard spring とする。reduced 時は opacity のみとする。

120ms の blur timeout と `onMouseDown` は削除する。候補 button の `onPointerDown` で `event.preventDefault()` して input の focus 喪失を防ぎ、同イベントで `onChoose(entry)` と close を実行する。input の blur では `event.relatedTarget` がサジェストリストを含むコンポーネント内要素かを判定し、内部なら閉じず、コンポーネント外へフォーカスが移った場合だけ close する。これにより候補 button 自体へ Tab 移動し Enter で選択できる。`Escape` で close、候補リストには `role="listbox"`、候補には `role="option"` を付与する。

### R11 保存フローのフィードバック

`RecordForm`/`EditWorkoutForm` の `message` state はフォーム必須項目の即時エラー表示には使用せず、`show({ kind: "error" })` に置換する。`isPending` 中は既存どおりボタンを disabled にし「保存中…/更新中…」を表示する。成功時は `show({ kind: "success", message: "ワークアウトを保存しました" })` の後、同一 client transition 内で `router.push("/dashboard")`（編集は `/history`）と `router.refresh()` を行う。ToastProvider が layout にあるため遷移後も表示が残る。

失敗時は `router.push`、フォーム state、入力値、保留していない削除以外を変更せず、error Toast を出す。save/update Server Action の返却形式、`revalidatePath`、Supabase RPC は変更しない。

### R12 Stepper 長押し連続増減

`PressAndHoldStepperButton` は `onPointerDown` で即時 `onStep()` を1回実行し、同一 pointer を capture する。300ms 後に 120ms 間隔で繰り返し、1,000ms 経過後は 60ms 間隔へ加速する。`onPointerUp`、`onPointerCancel`、`onPointerLeave`、window blur、unmount でタイマーを必ず解除する。マウス・タッチ・ペンを同じ pointer event で扱い、keyboard の Enter/Space は通常 click 1回だけにする。

値は parent の単一 state を正とし、min/max clamp は `onStep` 呼出し側で既存どおり行う。表示数値は `motion.span key={value}` または value 変化時の controls で scale `1 → 1.06 → 1` を standard spring でパルスさせる。reduced 時はパルスを描画しない。record の Stepper、edit の Stepper、`MiniStepper` はこの共通ボタンを使い、現在 44px 未満の edit Stepper ボタンは 44px に拡大する。

### R13 44px ヒットターゲット

対象を `rg` で全走査し、最小44×44pxを次に保証する。history の編集 Link は `min-h-11 min-w-11`、record の exercise X は見た目16pxのまま wrapper `min-h-11 min-w-11`、edit のゴミ箱は `min-h-11 min-w-11`、全 Stepper ± は `min-h-11 min-w-11` とする。設定等の今回スコープ外ページはトークン波及以外を変更しない。ただし共通 `PrimaryButton`/`OutlineButton` と BottomNav は現在の高さ以上を維持する。狭幅で横並びが破綻する場合は icon 視覚サイズを変えず gap/余白を縮め、タップ領域を優先する。

### R14 タップフィードバックの motion 化

motion を導入した `Pill`、RangeTabs、NavItem、中央記録ボタン、ModeButton、部位選択、サジェスト候補、Toast Undo、Stepper、削除ボタンは `whileTap={{ scale: 0.97 }}` を使用する。既存の `active:scale-*`/`group-active:*` は当該要素から除去し二重適用を防ぐ。motion を必要としない Link、input、カード、hover 色変化は CSS transition のままとする。disabled の操作要素には `whileTap` を付与しない。

## 4. 実装順序と検証

| 手順 | 実装内容 | 主な確認 |
| --- | --- | --- |
| 1 | `motion` 追加、`globals.css` のトークン・媒体クエリ、`src/lib/motion.ts` を追加する。 | `npm run lint`。主要画面を125%・200%文字サイズ、320px幅、日本語折返し、reduced motion/transparency/contrast、fine pointer で確認する。input/select/textarea が1rem以上で iOS Safari の自動ズームを起こさないことも確認する。 |
| 2 | `ui.tsx`、`phone-shell.tsx`、BottomNav を改修する。 | BottomNav の半透明/blur、ラベル、コンテンツの背面スクロール、最後の操作要素と safe area、文字拡大時にも `min-h-11 min-w-11` 相当を保つ44px タップを実機幅で確認。 |
| 3 | ToastProvider と Toast を layout に組み込み、record/edit の保存成功・失敗通知を置換する。 | 成功Toastが遷移後も表示されること、失敗時に入力が残ること、screen reader role、timeoutを確認。 |
| 4 | DashboardClient を追加して RSC から移譲する。 | 各 range がサーバー往復なしで即時に替わること、`/dashboard?range=week` の直リンク/更新、unknown range、週間3値着色を確認。 |
| 5 | HistoryClient を追加して RSC から移譲する。 | `/history?muscle=cardio` と group ID の直リンク/更新、all、省略、unknown値、カードlayout、編集リンク44pxを確認。 |
| 6 | 共通 Stepper・サジェストを導入し、record/edit に R9〜R12/R14 を適用する。 | pointer長押しの即時1回+加速+解除、候補を指で選んでも閉じないこと、Escape、set/exercise Undoが5秒内に元indexへ戻ること、期限後は復元しないこと、保存/遷移/unmount 時に Undo Toast を dismiss すること、保存後の削除確定を確認。 |
| 7 | px直書き、旧 danger、旧 radius、`active:scale` の残存を走査して対象範囲を整理する。 | `rg` で対象コンポーネントに旧指定が残らないことを確認し、`npm run lint` と `npm run build` を実行する。 |

最終機械検証は `npm run lint` と `npm run build` の成功とする。build が環境上の `next/font/google` 取得だけで失敗する場合は、その外部取得エラーを記録したうえで lint と `npx tsc --noEmit` を補助確認に用いる。目視受け入れは要件定義書の受け入れ基準1〜9を、iOS Safari相当の狭幅と各アクセシビリティ設定で実施する。

## 5. 回帰防止条件

- dashboard/history の RSC にある `requireOnboardedUser`、データ取得件数、searchParams の初期解釈を維持する。
- record/edit の Server Action、入力検証、`revalidatePath`、Supabase RPC の引数・戻り値は変更しない。
- テンプレートからの初期種目、筋トレ/有酸素、日付入力、既存の最低1セット制約、編集画面の更新フローを維持する。
- URL はフィルタ選択の表現だけであり、フィルタのための新規 API、DB、スキーマ変更は行わない。
