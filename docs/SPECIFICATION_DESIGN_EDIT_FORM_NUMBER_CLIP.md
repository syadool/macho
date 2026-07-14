# 記録編集画面のセット数値クリップ対策 設計書

作成: luna（Codex, gpt-5.6-luna）/ 保存代行: Fable（Codexのファイル書き込みサンドボックスがこの環境で失敗したため、stdout出力を保存）

## 実装時の補正（Fable、2026-07-14）

luna 設計の `max-[399px]:grid-cols-1`（399px以下で縦積み、それ以上は横並び）は、実測すると成立しない。44pxタップターゲットのボタン4個＋68px（4.25rem）固定幅の数値input 2個を横並びさせるには、セット行の中央カラムに最低 336px（164px×2＋gap8px）、行全体では最低 444px 必要になる。実機スマホ幅（375〜430px）はもちろん、`edit-workout-form.tsx` のカード入れ子（-34px）を差し引くとさらに届かず、399pxを閾値にすると 400〜430px 幅で再びクリップまたは横方向スクロールが発生する計算になった。

そのため、閾値を独自の `max-[399px]` ではなく、既存コードベースで使われている Tailwind 標準の `sm`（640px）ブレークポイントに変更した。

```tsx
grid grid-cols-1 gap-2 sm:grid-cols-2
```

- 640px 未満（実機スマホ幅を含む全域）: kg / 回を常に縦積みにする。
- 640px 以上（`PhoneShell` がデスクトップ幅で「電話フレーム」表示に切り替わり、コンテンツ幅に余裕が生まれる場合）: 横並びにする。

この変更により、375〜430pxの実機スマホ幅で FR-1（数値がクリップされない）を数値計算で保証しつつ、デスクトップ幅では横並びの一覧性を維持する。`npm run lint` / `npm run build` はパス済み。

## 1. 文書情報

- 対象: トレーニング記録アプリの記録編集画面
- 対象不具合: セット行の kg / 回の数値入力欄が、狭い画面幅または flex/grid の縮小によってクリップされ、入力値の一部が隠れる
- 前提: Next.js + Tailwind CSS。既存の `WorkoutSets` と `Stepper` を共通部品として利用する
- 本設計の範囲: レイアウト、操作領域、レスポンシブ縮退、回帰確認
- 本設計の範囲外: 入力値のバリデーション、保存 API、セット追加・削除の業務ロジック

## 2. 設計方針

数値入力の見た目を縮小して問題を隠すのではなく、数値欄と加減ボタンを縮まない部品として扱う。2 つの数値欄を横並びにできない幅では、セット行の内部だけを縦積みに切り替える。これにより、入力値の可読性と 44px のタップターゲットを同時に維持する。

### 2.1 採用するレイアウト戦略

セット行は次の 2 層の grid とする。

1. 外側: セット番号、セット内容、削除操作の 3 列
2. 内側: kg と回の 2 列。十分な幅がない場合は 1 列に縮退

外側の概念的なクラスは以下とする。

```tsx
grid grid-cols-[2.25rem_minmax(0,1fr)_2.75rem] items-start gap-2
```

セット内容の内側は以下とする。

```tsx
grid min-w-0 grid-cols-2 gap-2 max-[399px]:grid-cols-1
```

`399px` 以下では kg と回を縦積みにする。390px 以下では最低幅を満たしにくいため縦積み、430px では横並びを維持する。

### 2.2 数値入力欄の最低幅保証

Stepper 内の入力要素には、以下を設定する。

```tsx
h-11 w-[4.25rem] min-w-[4.25rem] shrink-0 px-2 text-center tabular-nums
```

加減ボタンは以下とする。

```tsx
inline-flex min-h-11 min-w-11 size-11 shrink-0 items-center justify-center
```

入力欄の最低幅は 68px（4.25rem）とする。Stepper 全体に `min-w-0` を付ける場合でも、入力要素自身には `min-w-[4.25rem] shrink-0` を付ける。入力欄またはその親に `overflow-hidden` は指定しない。

### 2.3 44px タップターゲットとの両立

- `-` ボタン、入力欄、`+` ボタンは高さ 44px 以上とする。
- button 要素自体を `size-11 min-h-11 min-w-11` とする。
- 数値欄は `h-11` とする。
- ボタンを 40px 以下へ縮小する `scale-*` や負の margin は使用しない。

### 2.4 狭幅時の縮退方針

- 430px: kg / 回を横並びにする。
- 390px: kg / 回をセット内容列内で縦積みにする。
- 375px: 390px と同じ縦積みとする。
- いずれの幅でもページ全体の横スクロールを発生させない。
- 入力順、ラベル、値、キーボード操作順は変更しない。

## 3. 基本設計

### 3.1 コンポーネント責務

| コンポーネント | 責務 | 今回の設計上の扱い |
| --- | --- | --- |
| `WorkoutSets` | セット行、kg / 回の配置、セット操作 | 行と内側 grid の縮退を定義 |
| `Stepper` | 数値入力と `-` / `+` 操作 | 最低幅・操作領域を保証 |
| `edit-workout-form` | 編集フォームとセット一覧 | 親による縮小・クリップを防止 |
| `record-form` | 新規記録画面 | 回帰確認対象 |
| `ui.tsx` | 共通 UI / class name ユーティリティ | 原則変更しない |
| `globals.css` | 全体 CSS | 原則変更しない |

### 3.2 レイアウトの不変条件

1. 数値の文字列を省略・切り抜きしない。
2. Stepper の `-` / `+` / 数値入力は 44px × 44px 以上とする。
3. 375 / 390 / 430px で body の横スクロールを発生させない。
4. 狭幅時は数値欄を縮小せず、kg / 回を縦積みにする。
5. 編集画面と新規記録画面の入力挙動を変えない。

## 4. 詳細設計

### 4.1 `src/components/workout-sets.tsx`

- セット行を、セット番号・セット内容・削除操作の 3 列 grid に整理する。
- セット内容 wrapper に `min-w-0` を付ける。
- kg / 回 wrapper に以下を適用する。

```tsx
grid min-w-0 grid-cols-2 gap-2 max-[399px]:grid-cols-1
```

- セット行の外側に `overflow-hidden` がある場合は除去する。
- 入力とフォーカスリングを含む領域には `overflow-visible` を使う。
- 既存の state、`onChange`、削除 callback は変更しない。
- ラベル側に `min-w-0`、Stepper 側に `shrink-0` を付ける。

### 4.2 `src/components/stepper.tsx`

Stepper の最外 wrapper:

```tsx
inline-flex min-w-0 items-center gap-1
```

`-` / `+` button:

```tsx
inline-flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center
```

数値 input:

```tsx
h-11 w-[4.25rem] min-w-[4.25rem] shrink-0 px-2 text-center tabular-nums
```

- `overflow-hidden`、`truncate`、`text-ellipsis`、`max-w-*` は使用しない。
- 既存の `w-full` がある場合は `w-[4.25rem]` を優先する。
- `type`、`min`、`max`、`step`、`value`、`onChange` は変更しない。
- `aria-label`、disabled 状態、フォーカスリングは維持する。

### 4.3 `app/history/[id]/edit/edit-workout-form.tsx`

- セット一覧 wrapper に `w-full min-w-0` を付ける。
- 編集フォームまたはカードに `overflow-hidden` がある場合は、セット一覧だけ `overflow-visible` にする。
- `WorkoutSets` の props、state、submit 処理、エラー表示は変更しない。
- `w-max` / `min-w-max` は使用しない。
- 390px 以下で `WorkoutSets` 内側が 1 列へ縮退できる構造を確保する。

### 4.4 `app/record/record-form.tsx`

- `WorkoutSets` を同じレイアウト契約で利用できることを確認する。
- wrapper に `overflow-hidden` または `min-w-max` がある場合は、`min-w-0 overflow-visible` へ寄せる。
- 初期化・追加・保存処理は変更しない。
- 共通 `WorkoutSets` の修正で足りる場合、record form の JSX は変更しない。

### 4.5 `src/components/ui.tsx`

- 共通 `Input` 全体へ `min-w-[4.25rem]` を追加しない。
- Stepper が共通 Input を使う場合は、数値用途の className を局所追加する。
- Tailwind の class merge により `w-[4.25rem] min-w-[4.25rem]` が消えないことを確認する。

### 4.6 `app/globals.css`

- 原則として新規 CSS は追加しない。
- `max-[399px]:grid-cols-1` の Tailwind class を優先する。
- arbitrary breakpoint が使えない場合のみ、以下の scoped CSS を追加する。

```css
@media (max-width: 399px) {
  .workout-set-fields {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

## 5. 変更ファイル一覧

### 実装変更の第一候補

- `src/components/workout-sets.tsx`
  - セット行と kg / 回 wrapper の grid
  - `min-w-0`
  - 399px 以下の 1 列化
- `src/components/stepper.tsx`
  - 数値 input の最低幅
  - button / input の 44px 高さ
  - shrink / overflow の抑制
- `app/history/[id]/edit/edit-workout-form.tsx`
  - セット一覧 wrapper の `w-full min-w-0`
  - clip 防止

### 確認し、必要な場合だけ変更するファイル

- `app/record/record-form.tsx`
  - 共通部品利用箇所の回帰確認
- `src/components/ui.tsx`
  - class merge の確認
- `app/globals.css`
  - arbitrary breakpoint が使えない場合のみ scoped media query を追加

## 6. 代替案と不採用理由

| 代替案 | 不採用理由 |
| --- | --- |
| input に `w-full` だけを設定 | 親 flex の shrink で再び縮小する可能性がある |
| `overflow-x-auto` | 問題を横スクロール操作へ置き換えるだけで、一覧性を損なう |
| font-size や transform を小さくする | 可読性と操作性が低下する |
| すべての画面で 1 列表示 | 430px 以上での一覧性を失う |
| `min-w-0` だけを追加 | 数値欄の最低表示幅を保証できない |
| 全共通 Input に固定最低幅を追加 | 他の入力欄へ副作用が及ぶ |
| 44px 未満のボタンへ縮小 | タップターゲット要件を満たさない |

## 7. 検証方法

### 7.1 静的検証

実装後、リポジトリルートで以下を実行する。

```bash
npm run lint
npm run build
```

### 7.2 手動表示確認

1. `npm run dev` で開発サーバーを起動する。
2. kg に `1`, `10`, `100`, `1000`、回に `1`, `10`, `100` を含む複数セットを用意する。
3. `/history/{id}/edit` を開く。
4. Responsive / Device toolbar で CSS viewport を `375px`, `390px`, `430px` に設定する。
5. 各幅で以下を確認する。

- 数値が末尾まで読める。
- `1000` の最後の `0` がクリップされない。
- 375px / 390px では kg と回が縦積みになる。
- 430px では kg と回が横並びになる。
- `-`、数値欄、`+`、削除ボタンが 44px 以上である。
- ページ全体の横スクロールが発生しない。
- focus ring が切れない。
- キーボード入力、削除、`+` / `-` 操作が従来どおり動く。
- `/record` でも同じ 3 幅を確認する。

### 7.3 完了条件

- 指定 3 幅で数値がクリップされない。
- 375 / 390px では縦積み、430px では横並びになる。
- 数値欄と加減ボタンが 44px タップターゲットを満たす。
- lint と build が成功する。
- 編集画面の保存処理と新規記録画面の既存挙動に変更がない。

## 8. 実装時の注意

- 入力欄では `w-[4.25rem] min-w-[4.25rem] shrink-0` を一組で扱う。
- `truncate` は数値入力とその親に付けない。
- 399px の breakpoint は、44px ボタン、68px の入力欄、ラベル、左右余白を同時に成立させるための境界とする。
- 変更は `WorkoutSets` / `Stepper` に閉じ込め、編集画面のデータ処理へ波及させない。
