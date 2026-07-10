# 技術選定書 — デザイン刷新（Apple Design 原則の適用）

対象: MACHO デザイン刷新（要件: [SPECIFICATION_REQUIREMENTS_DESIGN_REDESIGN.md](./SPECIFICATION_REQUIREMENTS_DESIGN_REDESIGN.md) / 設計: [SPECIFICATION_DESIGN_DESIGN_REDESIGN.md](./SPECIFICATION_DESIGN_DESIGN_REDESIGN.md)）
経緯: Fable × sol（gpt-5.6-sol）の対話 2 往復で合意。作成: Fable / 2026-07-11

---

## 1. アニメーションライブラリ: `motion`（旧 Framer Motion）を採用

- **結論**: `motion` 単体パッケージを採用。React 19 / Next.js 15 App Router と互換で、今回必要な `layoutId`（共有レイアウト）、exit、`whileTap`、`useReducedMotion` を素直に扱える。
- **運用上の注意**: motion を使う部品は Client Component に閉じる。App Router のページ遷移をまたぐ exit 演出は期待しない（今回のタブ・カード・Toast 内の演出には影響なし）。
- **バンドルサイズ**: `LazyMotion` + `m.*` は今回は不採用。`layout`/`layoutId` に `domMax` が必要で構成が増えるため、まず通常の `motion/react` で実装し、本番バンドル計測で影響が見えた場合に `LazyMotion strict` + `m.*` + `domMax` へ移行する。
- **不採用案**: react-spring（layoutId 相当の共有レイアウトがない）、Web Animations API / CSS spring 近似（中断可能性・velocity 引き継ぎの実装コストが高い）、sonner 等のトーストライブラリ（下記 §2 のとおり自前で十分）。
- **YAGNI**: P5（Sheet / flick）が今回スコープ外のため、`SPRING_SHEET` / `SPRING_FLICK` 定数は**今回定義しない**。`SPRING_STANDARD` のみ導入する。将来 P5 実装時に、duration ベースではなく物理ベース（stiffness / damping / mass / velocity）で設計する（未使用の duration 定数を先に置くと速度継承のない実装に流用されやすいため）。

## 2. Toast / Undo の状態管理: React Context + 自前実装

- **結論**: 外部ライブラリ不使用。ToastProvider（Context）+ `ToastItem | null`（同時表示は最新 1 件のため配列でなく単一値）。
- **Undo の堅牢化**: `{ token, expiresAt: Date.now() + 5000, restore }` を保持し、Undo 押下時に token 一致 **かつ** `Date.now() < expiresAt` を再確認する（iOS Safari はバックグラウンドで setTimeout が遅延しうるため、タイマーだけを期限判定の正としない）。
- **遷移との関係を明確に区別する**:
  - 成功/エラー Toast → Root Layout の Provider に residing、ページ遷移をまたいで表示が残る。
  - フォーム内削除の Undo → 遷移をまたがない。フォーム unmount 時に token 無効化 + Undo トーストを dismiss する（押しても何も起きない Undo ボタンを残さない）。保存時・新しい削除時も前の復元権を無効化する。

## 3. クライアントフィルタ化と URL 同期

- **結論**: データ取得・認証・直リンク解釈は RSC に残し、シリアライズ可能な初期データを Client Component に props で渡す（terra 設計どおり）。
- **URL 同期は `router.replace` ではなく `window.history.replaceState`（Next.js Native History API）を採用**。dashboard / history は `force-dynamic` のため、`router.replace` だと URL 変更ごとにバックグラウンドで Server Component Payload 生成（サーバー往復）が発生し、受け入れ基準「サーバー往復なし」と矛盾するため。`replaceState` は Next.js Router と統合されており `usePathname` / `useSearchParams` に同期される。
- **状態は URL を正とする導出型**: クライアント側に `useState` を持たず、`useSearchParams()` から `parseDashboardRange(searchParams.get("range"))` で導出する。クリック時は `history.replaceState` のみ実行。戻る/進むでも自動的に再導出され、二重 state が消える（terra 設計の「useEffect で initialRange を同期」は不要になる）。
- **既知のリスク（許容）**: history のフィルタ対象は現状どおり「直近 50 件内」。全件をクライアントへ渡すため将来データ増で転送量が増える（現状規模では問題なし）。URL 正規化関数は RSC / クライアントで同一のものを共有する。

## 4. デザイントークン実装（Tailwind v4）

- **結論**: `:root` に意味トークン、`@theme inline` で Tailwind utility へ公開する現行方式を踏襲。
- **文字トークンの構文修正（terra 設計書の要修正点）**: `--text-display-xl: 2.125rem/1` のような slash 構文は不可。Tailwind v4 の分離構文を使う:

  ```css
  @theme {
    --text-display-xl: 2.125rem;
    --text-display-xl--line-height: 1;
    --text-display-xl--letter-spacing: 0.04em;
  }
  ```

- **rem 移行の注意**: `html { font-size }` を固定しない。input/select/textarea は 1rem 以上（iOS Safari のフォーム自動ズーム回避）。検証は 125% に加え 200%・320px 幅・日本語折返しも確認。44px ヒットターゲットは `min-h-11 min-w-11` 相当で文字拡大時も縮めない。BottomNav・Toast の固定オフセットは共有 CSS 変数から算出する。
- **backdrop-filter**: `-webkit-backdrop-filter` 併記。非対応環境向けに不透明度高めの背景を基本 fallback とする。blur の適用面積は BottomNav 内に限定（iPhone の GPU 負荷対策）。`prefers-reduced-transparency: reduce` で blur 除去+完全不透明。

## 5. terra 設計書への反映事項（Phase 4 レビューで修正指示）

1. URL 同期を `router.replace(scroll:false)` → `window.history.replaceState` + `useSearchParams` 導出型に変更（§3）。
2. 文字トークンを Tailwind v4 分離構文に修正（§4）。
3. `SPRING_SHEET` / `SPRING_FLICK` を削除し `SPRING_STANDARD` のみ定義（§1）。
4. Undo に `expiresAt` 二重判定を追加し、「Toast は遷移をまたぐ / Undo はまたがない」を明記（§2）。
