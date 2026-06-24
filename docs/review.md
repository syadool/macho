レビュー結果サマリー
統計: 6軸×30件 → 反証で19件確定 (Critical 1 / High 2 / Medium 5 / Low 7 / Nit 3)

軸	確定
server_logic	6 (Opusレビュー)
templates	3
ui_flow	3
types_constants	3
db_migration	2
profile_onboarding	2
🔴 Critical (1件)
1. saveSuggestionAsTemplateAction がクライアント送信の exercises をそのまま信用している
File: app/templates/actions.ts:7-27, app/suggest/suggest-form.tsx:63-68
Spec: §8.2, 実装計画 Step 9（"ai_suggestion_logs から suggestion_id の response_payload を取得（self の log のみ）"）
問題: 実装計画では「suggestion_id だけ受け取って、サーバー側で ai_suggestion_logs から response_payload を再取得して TemplateExercise に変換する」設計だが、現実装は { name, source_log_id, exercises } をクライアントから受け取って素通しで INSERT している。FK制約のおかげで「存在しないUUID挿入」は防げるが、他人の suggestion_id を source_log_id に貼り付ける/AI が提示していない muscle_group_id・equipment_id に差し替える/target_sets・notes に任意値を注入する が可能。AI生成結果のみテンプレ化を許可する設計意図が完全にバイパスされている。
修正: saveSuggestionAsTemplateAction(input: { suggestion_id, name }) シグネチャに戻し、ai_suggestion_logs を .eq("user_id", user.id) 付きで再取得して response_payload.exercises をサーバー側で変換。
🟠 High (2件)
2. 未認証/未オンボーディング時に 401/403 ではなく 307 リダイレクトを返す
File: src/lib/supabase/server.ts:33,46, src/lib/ai/suggest.ts:43, app/api/suggest/route.ts:25
Spec: §8.1-1（未認証なら 401）
問題: generateSuggestion が冒頭で requireOnboardedUser() を呼び、内部の redirect("/") / redirect("/onboarding") が Next の NEXT_REDIRECT 経由で 307 を返す。JSON API として壊れる。未オンボーディング時はサイレントに /onboarding 307。
修正: API用に 401/403 を JSON で返す別 helper を用意（requireApiUser 的なもの）。
3. レート上限チェックに TOCTOU レース（並列POSTで上限突破可能）
File: src/lib/ai/suggest.ts:139-179 （server_logic と ui_flow で重複指摘・同一問題）
Spec: §2.1 多層防御② / §8.1-3,4
問題: checkLimits は SELECT count するだけで pending 行を予約しない。OpenAI 呼び出し後に成功ログ insert なので、複数タブ/デバイスから残り1枠状態で同時 POST すれば両方 pass → 課金発生。グローバル月3000キャップも同様に突破可能。仕様書 §2.1 の「多層防御」「フロントのみのチェックは信用しない」原則に反する。
修正: pending ログを先取り INSERT → OpenAI 呼び出し → 成功/失敗で update、または Postgres advisory lock / RPC で原子化。
🟡 Medium (5件)
4. settings/profile の saveProfile に入力検証がない
File: app/settings/profile/actions.ts:7-21
Spec: §5.3 / saveOnboarding との非対称
問題: saveOnboarding はホワイトリスト＋範囲チェックを行うが、saveProfile は input を素通しで upsertUserProfile に渡す。DB の CHECK 制約で永続化は防げるが、生の Postgres エラー文言が error.message 経由でそのままユーザーに表示される。
修正: saveOnboarding の検証を共通関数に切り出して両方で使う。
5. 同じ saveSuggestionAsTemplateAction を別角度から：マスタ存在チェック・値域チェックなし
File: app/templates/actions.ts, src/lib/templates.ts:48-88
上記 Critical の修正と併せて、target_sets / target_reps / target_weight_kg / notes の範囲・型・長さチェックも入れる。
6. OpenAI 呼び出しに timeout / AbortController がない
File: src/lib/ai/client.ts:4-6, src/lib/ai/suggest.ts:79-87
問題: SDK デフォルトの 10 分タイムアウトのまま。Vercel function タイムアウトが先に効いても、AbortController を渡していないためバックエンド処理が中断されない。
修正: new OpenAI({ apiKey, timeout: 30_000, maxRetries: 1 })、もしくは AbortController を渡す。
7. /suggest ヘッダーに残り回数表示がない
File: app/suggest/page.tsx:16-26, app/suggest/suggest-form.tsx:79-110
Spec: §6.2（ヘッダー: "今日 7/10 回利用可"）
問題: 生成後の Card 内にしか usage が出ない。生成前にユーザーが残数を確認できず、429 で初めて気づく。
修正: page.tsx 側で当日/当月カウントを取得して SuggestForm に初期 usage として渡す。
8. （4と重複）settings/profile 軸の types_constants 側からの同一指摘
省略（指摘#4と同一）。

🟢 Low (7件)
#	問題	File
9	グローバル月次キャップ集計クエリに対応する index がない（status, created_at 複合 index 推奨）	supabase/migrations/202606250001_ai_suggestion_schema.sql:54-57
10	rate_limited / forbidden 経路の insertLog が throw すると外側 catch で 500 化（仕様の 403/429/503 が出なくなる）	src/lib/ai/suggest.ts:57,160,167,174
11	API 入力サイズ制限なし（target_muscle_group_ids 件数 / theme 長 / UUID 形式の検証なし、キャッシュ無効化攻撃の余地）	app/api/suggest/route.ts:7-28
12	estimateCost のレートが gpt-5-mini ハードコード。OPENAI_MODEL を env で差し替えても cost_usd が嘘になる	src/lib/ai/suggest.ts:338-341
13	cardio フォールバックで duration_minutes: 30, distance_km: 0, calories: 0 の決め打ち値が入る（実装計画は「null」と明記）。現状は dead code だが将来 cardio テンプレ実装時に偽データ表示	app/record/record-form.tsx:257-274
14	Number(process.env.X ?? デフォルト) パターンで env に空文字が入ると 0 になり、サービス全停止（全リクエスト rate_limited）に陥っても検知できない	src/lib/ai/env.ts:11-29
15	仕様§8.2-8.4 が要求する POST/GET/DELETE /api/templates ルートが存在せず Server Actions で代替。仕様§13 の完了マークは虚偽。許容するなら仕様書に注記が必要	app/templates/actions.ts
⚪ Nit (3件)
既存 auth.users へのバックフィルなし（自己修復されるので実害小）
focus_muscle_group_ids のマスタ存在検証なし（UI ズレ程度）
createTemplate のロールバック相当処理は 適切に実装済み（肯定的記録）
推奨対応順
Critical #1（テンプレ任意作成）— セキュリティ・設計意図のバイパス、即修正
High #2, #3（API レスポンス規約違反 / TOCTOU）— レート暴走に直結
Medium #4, #5（バリデーション欠落）— #1 と一括で
Medium #6, #7（timeout / UX）
残りは順次
反証で落ちた11件は誤検出または設計判断の好み（max_tokens再検証、キャッシュ再検証、3-5件チェックの厳しさ等）が主で、特に対応不要です。

詳細な反証ログは output file を参照。