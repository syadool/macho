# 技術選定書: 編集画面と新規作成画面のUI統一

- 作成日: 2026-07-13
- 作成者: Fable(sol との対話により決定)
- ステータス: 確定
- 参照: `docs/SPECIFICATION_REQUIREMENTS_EDIT_FORM_UI_UNIFICATION.md`、`docs/SPECIFICATION_DESIGN_EDIT_FORM_UI_UNIFICATION.md`

## 決定事項

### 1. 共有コンポーネントの配置: 単一ファイル `src/components/workout-form.tsx` を維持

- 4コンポーネント(ModeButton / MuscleGroupGrid / ExerciseSuggestionList / DurationStepper)は同じフォーム領域・同じ2画面から使われる凝集した単位(約150行)であり、単一ファイルが探索コスト最小。
- **不採用**: コンポーネントごとのファイル分割(この規模では過剰)。
- **不採用**: `src/components/ui.tsx` への統合(ui.tsx は汎用UI用。`MuscleGroup` や `ExerciseHistoryEntry` などワークアウトドメイン型に依存する部品を入れるべきではない)。

### 2. モーション: motion/react + useReducedMotion を継続

- コードベース全体で motion/react を使用済みのため、部分的な CSS `active:scale` 置き換えは依存削減にならず一貫性を損なう。
- **追加決定(K-02)**: `PressAndHoldStepperButton`(`src/components/stepper.tsx`)の `whileTap` をコンポーネント内部で `useReducedMotion` により無効化する。DurationStepper から prop で渡す案は不採用。ステッパー自身が押下モーションの責務を持ち、共通部品側の一括対応で `SetRowsEditor` の MiniStepper など全利用箇所に漏れなく適用されるため。通常ユーザーへの見た目の変化はなし。

### 3. hover色のトークン化(K-01): `macho-border-hover` を定義し4箇所を一括置換

- Tailwind v4 構成のため、`app/globals.css` の `@theme inline` に `--color-macho-border-hover: #555555;` を追加する(tailwind.config は使わない)。
- `hover:border-[#555]` の4箇所すべてを `hover:border-macho-border-hover` に機械置換する:
  - `src/components/workout-form.tsx`(MuscleGroupGrid)
  - `src/components/ui.tsx`(Pill)
  - `app/templates/page.tsx`
  - `app/onboarding/onboarding-form.tsx`
- **不採用**: 共有コンポーネントのみ置換(トークン導入後に同じリテラルが残るとスタイルの管理元が二重になる)。
- **不採用**: `macho-border` への単純置換(hover フィードバックが消える)。
- 注: `app/page.tsx` の `text-[#555]` はテキスト色でhover用途ではないため対象外。
- スコープ注記: `ui.tsx` 等も変更対象になるが、「既存の `#555` を意味的トークンへ機械置換する範囲」に限定した無変化のリファクタであり、要件定義書の対象外規定(BottomNav差分等)とは別扱いとする。

### 4. aria-pressed(K-04): 本テーマ内で追加

- `ModeButton` に `aria-pressed={active}` を付与する。既存の `active` prop をそのまま使え、API変更・挙動リスクがほぼゼロのため、共有化のタイミングで対応する。

### 5. テスト基盤: Vitest / React Testing Library の導入は見送り

- 本テーマの主目的は視覚統一と既存フロー維持であり、RTL では見た目の一致を保証できない。個人開発では導入・保守コストが便益を上回る。
- 検証は `npx tsc --noEmit`、`npm run lint`、`git diff --check`、および390px幅でのブラウザ手動確認(モード切替、候補選択、長押しステッパー、Undo、保存、reduced-motion、aria-pressed)で行う。
- 将来自動化する場合は、Vitest より先に主要保存フローのブラウザE2Eを検討する方が効果的。

## セッション記録

- luna セッション: `019f5938-d7a8-7801-bc76-621acbd9c727`
- sol セッション: `019f5942-d8a1-7092-a03a-84dc9273967a`(対話1往復で合意)
