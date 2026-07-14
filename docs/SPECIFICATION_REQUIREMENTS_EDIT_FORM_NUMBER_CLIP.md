# 要件定義: 記録編集画面でセットの数値（kg / 回）が隠れる不具合の修正

作成: 2026-07-14 / 作成者: Fable（メインセッション）

## 1. 不具合の概要

- 記録の**新規作成画面**（`/record`）ではセット行の「kg」「回」の数字が正常に表示される。
- 記録の**編集画面**（`/history/[id]/edit`）では同じセット行の数字がクリップされて（左右が隠れて）読めない。
- 対象は狭いビューポート（実機スマホ幅 約390〜430px）。デスクトップ幅では再現しない。

## 2. 原因（コード調査により確定）

両画面とも共通コンポーネント `SetRowsEditor` / `MiniStepper`（`src/components/workout-sets.tsx`）を使用しているが、**配置されるコンテナが異なる**。

- 新規作成: `app/record/record-form.tsx` L286-289 — ページ直下の `div.mt-3.5` に配置。利用可能幅 = コンテンツ幅そのまま。
- 編集: `app/history/[id]/edit/edit-workout-form.tsx` L337-342 — 種目カード `<Card className="space-y-3">`（`p-4` + border）の**内側**に配置。利用可能幅がカードの左右パディング＋ボーダー分（約34px）狭い。

セット行（`SetRowInput`）は固定幅要素が多い:

| 要素 | 幅 |
|---|---|
| セット番号 span | `w-7` = 28px |
| ステッパー±ボタン ×4（`PressAndHoldStepperButton`） | `min-w-11` = 44px × 4 = 176px |
| 削除ボタン | `w-11` = 44px |
| 行の gap-2 ×3 + MiniStepper 内 gap-1 ×4 | 40px |
| 行 Card の `p-2.5` | 20px |

固定分の合計が約310px あり、数値 `input`（`min-w-0 w-full`、`font-display text-display-num` = 2rem Bebas Neue）は**残り幅**しか得られない。例: ビューポート430px（コンテンツ390px）の場合、新規作成では input ≈ 41px（2桁が収まる）だが、編集ではカード入れ子の -34px により input ≈ 24px となり、2桁の数字（約27px）がクリップされる。390px 端末では新規作成側もほぼ限界（≈21px）で、潜在的に同じ問題を抱えている。

つまり根本原因は「**セット行のレイアウトが固定幅要素で幅を使い切り、数値入力欄に最低幅の保証がない**」ことであり、編集画面はカード入れ子の分だけ先に閾値を割った、という構図。

## 3. 修正要件

### 機能要件

- FR-1: 編集画面のセット行で、weight_kg / reps の数値が実機スマホ幅（375px〜430px）で欠けずに表示されること。少なくとも 3桁 + 小数（例 `102.5`）が読めること。
- FR-2: 新規作成画面でも同一コンポーネントの表示が退行しないこと（むしろ 375px での潜在クリップも同時に解消されるのが望ましい）。
- FR-3: ステッパー（±長押し連打含む）、セット削除、セット追加、値の直接入力の既存挙動を変えないこと。

### 非機能要件・制約

- NFR-1: 修正は共通コンポーネント（`src/components/workout-sets.tsx`）側で行い、両画面が同じ見た目・挙動を保つこと（直近コミット「Unify workout form UI components」の方針を維持）。編集画面固有のレイアウト調整（例: カードパディングの打ち消し）を併用する場合も、共通側の最低幅保証を優先する。
- NFR-2: タップターゲットは Apple HIG 準拠の 44px（`min-h-11 min-w-11`）を原則維持する。どうしても幅が足りない場合の縮小はデザイン上の判断を設計書に明記すること。
- NFR-3: 数値のフォント（`font-display text-display-num text-macho-lime`）とトーンは維持する。フォントサイズの段階的縮小（例: 狭幅時のみ）を使う場合は設計書に明記。
- NFR-4: 既存のデザイントークン / Tailwind ユーティリティの範囲で実装する。新規ライブラリ追加は不可。

### 検証要件

- `npm run lint` / `npm run build` がパスすること。
- ユニットテスト or コンポーネントテストが既存に存在する場合はパスさせる。存在しない場合、レイアウト崩れは自動テストで担保しづらいため、375px / 390px / 430px 相当の幅で数値が表示されることの確認方法（手動確認手順 or Playwright 等既存基盤があればそれ）を実装報告に含めること。

## 4. 関連ファイル

- `src/components/workout-sets.tsx` — `SetRowsEditor` / `SetRowInput` / `MiniStepper`（修正の中心）
- `src/components/stepper.tsx` — `PressAndHoldStepperButton`
- `app/history/[id]/edit/edit-workout-form.tsx` — 編集フォーム（L337 で Card 内に SetRowsEditor を配置）
- `app/record/record-form.tsx` — 新規作成フォーム（L288）
- `src/components/ui.tsx` — `Card`（`p-4`）
- `docs/SPECIFICATION_DESIGN_EDIT_FORM_UI_UNIFICATION.md` — 直近の UI 統一の設計書（方針の前提）
