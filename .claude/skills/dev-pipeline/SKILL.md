---
name: dev-pipeline
description: 要件定義→基本/詳細設計→技術選定→レビュー→実装のマルチモデル開発パイプラインを一括実行する。引数に開発対象の概要を渡す。
---

# マルチモデル開発パイプライン

引数（$ARGUMENTS）で渡された開発対象について、以下のパイプラインを順に実行する。

## モデル割り当て（ここを編集すれば変更可能）

| 役割 | 呼び名 | 実行方法 |
|------|--------|----------|
| 要件定義・レビュー・進行管理 | Fable | メインセッション（自分） |
| 設計・修正・実装 | terra | Codex CLI: `codex exec -m gpt-5.6-terra` |
| 技術選定の対話相手・最終チェック | sol | Codex CLI: `codex exec -m gpt-5.6-sol` |

terra / sol は OpenAI の GPT-5.6 系モデルで、ローカルの Codex CLI（`codex exec`）経由で呼び出す。

## Codex CLI の呼び出し方

- 新規セッション開始: `codex exec -m <model> --sandbox workspace-write "<プロンプト>"`（設計書の保存や実装でファイル書き込みが必要なため workspace-write を付ける）
- 出力に表示される **session id を必ず控える**。
- 同じエージェントへの追加依頼（対話の継続・修正・実装）は `codex exec resume <session-id> "<プロンプト>"` で行う。terra と sol のセッションは別々に管理する。
- 実行前に使用枠を確認: usage limit エラーが出た場合はリセット時刻をユーザーに伝えて中断する。

## 重要な進行ルール

- **エージェントの継続性**: terra と sol はそれぞれ最初に1回だけ `codex exec` で起動し、以降の依頼（修正・実装・再チェック）はすべて `codex exec resume <session-id>` で同じセッションに送る。毎回新規起動するとコンテキストが失われるので禁止。
- **検証サイクルの上限**（ユーザーのグローバル方針）:
  - Fable レビュー → terra 修正 は最大1往復。
  - sol 最終チェック → 差し戻し も最大1回。
  - 同じ指摘を複数エージェントで重複検証しない。確信度が低い指摘は再検証せず、低確信である旨を添えて報告する。
- 各フェーズの成果物はファイルに保存してから次フェーズに進む（パスを次のエージェントに渡す）。

## Phase 1: 要件定義（Fable）

1. $ARGUMENTS の内容をもとに、Fable（メインセッション）自身が要件定義を行う。
2. 既存コード・docs/ 配下の関連仕様を確認し、前提を把握する。
3. 要件が曖昧な場合のみ、ユーザーに要点を確認する（AskUserQuestion）。
4. 成果物: `docs/SPECIFICATION_REQUIREMENTS_<テーマ>.md`

## Phase 2: 基本設計・詳細設計（terra）

1. `codex exec -m gpt-5.6-terra` で terra セッションを開始。要件定義書のパスと「基本設計と詳細設計を作成し、指定のパスに保存せよ」という自己完結した指示を渡す。session id を控える。
2. 成果物: `docs/SPECIFICATION_DESIGN_<テーマ>.md`（基本設計・詳細設計を含む）

## Phase 3: 技術選定（Fable × sol の対話）

1. `codex exec -m gpt-5.6-sol` で sol セッションを開始。設計書のパスを渡し、技術選定の論点（ライブラリ、アーキテクチャ、データモデル等）について意見を求める。session id を控える。
2. Fable は sol の意見に対して自分の見解をぶつけ、`codex exec resume <sol-session-id>` で対話を継続する（最大3往復）。
3. 合意した結論を Fable が `docs/SPECIFICATION_TECH_<テーマ>.md` にまとめる。判断理由と不採用案も簡潔に記録する。

## Phase 4: レビューと修正（Fable → terra）

1. Fable が設計書と技術選定書をインラインでレビューする（整合性、実現可能性、既存コードとの矛盾）。
2. 指摘があれば `codex exec resume <terra-session-id>` で terra に修正一覧を送り、設計書を修正させる（最大1往復）。指摘がなければスキップ。

## Phase 5: 最終チェック（sol）

1. `codex exec resume <sol-session-id>` で sol に最終版の設計書・技術選定書のパスを送り、実装に進んでよいかの最終チェックを依頼する。
2. 重大な問題（ブロッカー）のみ terra に差し戻す（1回まで）。軽微な指摘は実装時の注意点として terra への実装指示に含める。

## Phase 6: 実装（terra）

1. `codex exec resume <terra-session-id>` で terra に実装を指示する。設計書・技術選定書のパス、sol の注意点、検証方法（lint / build / 既存テスト）を含める。
2. terra の完了報告を受けたら、Fable が差分と検証結果を確認する。
3. ユーザーに、作成した文書一覧・実装内容・検証結果をまとめて報告する。コミットはユーザーの指示があるまで行わない。
