# MACHO - 筋トレ記録Webアプリ 仕様書

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| アプリ名 | MACHO |
| 種別 | 筋トレ記録Webアプリ |
| 対象ユーザー | 個人（認証あり・複数ユーザー対応） |
| 主な利用シーン | ジムでスマホから記録 |

## 2. 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | Next.js 15 (App Router) + TypeScript |
| スタイリング | Tailwind CSS v4 |
| バックエンド/DB | Supabase (PostgreSQL) |
| 認証 | Supabase Auth (Google OAuth) |
| デプロイ | Vercel |
| フォント | Bebas Neue (見出し), Outfit (本文) |

## 3. デザイン方針

- **テーマ**: ダーク系モダンUI
- **アクセントカラー**: ライムグリーン `#D4FF00`
- **背景色**: `#0A0A0B` (最深), `#141416` (サーフェス), `#1A1A1E` (カード)
- **ボーダー**: `#2A2A30`
- **テキスト**: `#F0F0F0` (プライマリ), `#6B6B75` (セカンダリ)
- **モバイルファースト**: 375px基準、レスポンシブ対応
- **部位カラーコード**:
  - 胸: `#FF6B6B` (コーラル)
  - 背中: `#4ECDC4` (ティール)
  - 肩: `#A78BFA` (パープル)
  - 腕: `#F59E0B` (アンバー)
  - 脚: `#34D399` (グリーン)
  - 腹: `#60A5FA` (ブルー)

## 4. 画面構成

### 4.1 ログイン画面
- MACHOロゴ（Bebas Neue 64px, ライムグリーン）
- アプリアイコン（バーベルアイコン）
- 「WORKOUT TRACKER」サブタイトル
- キャッチコピー
- **Googleログインボタン**（白背景, Google公式ロゴ）
- バージョン表記

### 4.2 ダッシュボード
- **ヘッダー**: 日付 + 「今日のワークアウト」
- **統計カード (3列)**:
  - エクササイズ数
  - セット数
  - ボリューム（トン表記）
- **週間アクティビティチャート**: 月〜日の棒グラフ（ワークアウトボリューム）
- **最近の記録リスト**: 
  - 部位カラーアイコン + 部位名
  - エクササイズ概要
  - 日付 + セット数
- **ボトムナビゲーション**: ホーム / 記録(FABボタン) / 履歴

> 旧仕様にあった「AIメニュー提案カード」は廃止済み（詳細は [SPECIFICATION_AI_SUGGESTION.md](./SPECIFICATION_AI_SUGGESTION.md) 参照）。

### 4.3 記録画面（詳細は [SPECIFICATION_RECORD_V2.md](./SPECIFICATION_RECORD_V2.md) 参照）
- **ヘッダー**: 「新規記録」
- **日付選択**: 今日をデフォルト表示
- **筋トレ/有酸素タブ**
- **エクササイズ名入力**: テキスト入力 + **履歴サジェスト**（過去の `workout_exercises` から頻度順/直近順に候補表示。テンプレートからの読み込みも継続利用可能）。候補タップで部位・前回のセット内容を自動セット
- **部位選択グリッド (3x2)**（筋トレ時のみ）:
  - 漢字アイコン + 英語ラベル
  - 選択時: ライムグリーンボーダー + 背景ハイライト
  - サブカテゴリ・器具の選択UIは廃止（DBマスタ・カラムは温存し、将来の再導入に備える）
- **セット入力（セット単位）**: セット番号ごとに行を分け、行ごとに重量(kg)・回数を個別入力可能（セットごとに重量を変えられる）
  - 「+ セット追加」で直前セットの値をコピーして行を追加、行削除も可能（最低1行）
- **有酸素入力**: エクササイズ名 + 時間（分）のみ。距離・カロリーの入力は廃止（DB列は温存、保存時は null）
- **追加済みエクササイズリスト**: 部位カラーバー + 詳細（セットごとに重量が異なる場合は「60kg×10, 65kg×8, 70kg×6」形式で表示）
- **アクションボタン**:
  - 「エクササイズを追加」（アウトラインボタン）
  - 「ワークアウトを保存」（プライマリボタン）

### 4.4 履歴画面
- **ヘッダー**: 「トレーニング履歴」
- **フィルタ**: ピル型ボタン（全て/胸/背中/肩/腕/脚/腹）横スクロール対応
- **日付別ワークアウトカード**:
  - 日付ラベル
  - 部位カラードット + トレーニング名
  - エクササイズ詳細（タイムライン表示）:
    - エクササイズ名（筋トレ時はセットごとの重量×回数、有酸素時は時間のみを表示。器具バッジ・距離・カロリーは表示しない）
    - 重量 x 回数 x セット数（ライムグリーン）
  - フッター: 合計セット数 + 総ボリューム

## 5. データモデル

### 5.1 テーブル構成

#### `muscle_groups` (部位マスタ)
| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| name | text | 胸, 背中, 肩, 腕, 脚, 腹 |
| name_en | text | Chest, Back, Shoulder, Arms, Legs, Abs |
| color | text | カラーコード |
| sort_order | int | 表示順 |

#### `muscle_sub_groups` (サブカテゴリマスタ・**選択UIは廃止**)
| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| muscle_group_id | uuid (FK) | 親部位 |
| name | text | 大胸筋上部, 広背筋 等 |
| sort_order | int | 表示順 |

> 記録画面からサブカテゴリ選択UIは廃止した。テーブル・データは温存し、将来の再導入に備える。

#### `equipment` (器具マスタ・**選択UIは廃止**)
| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| name | text | バーベル, ダンベル 等 |
| sort_order | int | 表示順 |

> 記録画面から器具選択UIは廃止した。テーブル・データは温存し、将来の再導入に備える。

#### `workouts` (ワークアウト記録)
| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| user_id | uuid (FK) | auth.users |
| date | date | ワークアウト日 |
| created_at | timestamptz | 作成日時 |
| updated_at | timestamptz | 更新日時 |

#### `workout_exercises` (エクササイズ記録)
| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| workout_id | uuid (FK) | workouts.id |
| exercise_name | text | エクササイズ名 |
| muscle_group_id | uuid (FK) | 部位 |
| muscle_sub_group_id | uuid (FK, nullable) | サブカテゴリ（**UIからは廃止、列は温存**） |
| equipment_id | uuid (FK, nullable) | 器具（**UIからは廃止、列は温存**） |
| sort_order | int | 表示順 |

> 有酸素種目の `distance_km` / `calories` に相当する列は `workouts`/`workout_exercises` 側ではなく後述のカーディオ用カラムで管理。UIからの入力は廃止したが列自体は温存し、保存時は null。

#### `workout_sets` (セット記録)
| カラム | 型 | 説明 |
|--------|------|------|
| id | uuid (PK) | |
| workout_exercise_id | uuid (FK) | workout_exercises.id |
| set_number | int | セット番号 |
| weight_kg | decimal | 重量 (kg)。**セットごとに異なる値を保存可能** |
| reps | int | 回数 |
| created_at | timestamptz | 作成日時 |

> 記録画面はこのテーブルの粒度（セットごとの重量・回数）にそのまま対応する形で作り直した。マイグレーションは不要。

### 5.2 RLS (Row Level Security)
- `workouts`: ユーザーは自分のデータのみCRUD可能
- `workout_exercises`: workout経由で同様に制限
- `workout_sets`: workout_exercise経由で同様に制限
- マスタテーブル: 全ユーザー読み取り可能、書き込み不可（管理者のみ）

### 5.3 初期データ

**部位マスタ:**
| name | name_en | サブカテゴリ |
|------|---------|-------------|
| 胸 | Chest | 大胸筋上部, 大胸筋中部, 大胸筋下部 |
| 背中 | Back | 広背筋, 僧帽筋, 脊柱起立筋 |
| 肩 | Shoulder | 三角筋前部, 三角筋中部, 三角筋後部 |
| 腕 | Arms | 上腕二頭筋, 上腕三頭筋, 前腕 |
| 脚 | Legs | 大腿四頭筋, ハムストリング, 臀筋, ふくらはぎ |
| 腹 | Abs | 腹直筋, 腹斜筋 |

**器具マスタ:**
バーベル, ダンベル, マシン, ケーブル, 自重, EZバー, スミスマシン

## 6. 認証フロー

1. ログイン画面で「Googleでログイン」をタップ
2. Supabase Auth → Google OAuth リダイレクト
3. 認証成功 → ダッシュボードへ遷移
4. セッション管理: Supabase クライアントライブラリが自動管理
5. 未認証でのアクセス → ログイン画面にリダイレクト

## 7. API設計 (Next.js App Router)

### ページルーティング
```
app/
├── page.tsx              # ログイン画面
├── dashboard/
│   └── page.tsx          # ダッシュボード
├── record/
│   └── page.tsx          # 記録画面
├── history/
│   └── page.tsx          # 履歴画面
└── api/
    └── gpt/              # ChatGPT Custom GPT Actions 用エクスポートAPI
        └── ...
```

### Supabase クエリ例
- ダッシュボード: 今日のワークアウト + 直近7日の集計
- 記録: INSERT workout → INSERT exercises → INSERT sets (トランザクション)
- 履歴: 日付降順でワークアウト一覧 + フィルタ

## 8. 現行機能・将来拡張

### ChatGPT Custom GPT Actions 連携（現行機能）
詳細仕様は [SPECIFICATION_GPT_ACTIONS.md](./SPECIFICATION_GPT_ACTIONS.md) を参照。

顧客が普段使っているChatGPT（Custom GPT）からMACHOのトレーニングデータを自動取得・分析できるようにするエクスポート機能。`app/api/gpt/*` のREST APIとOpenAPIスキーマで実装。セット単位の重量・回数をそのままシリアライズしてエクスポートする。

### AIメニュー提案機能（廃止済み）
自前でChatGPT (OpenAI API) にメニュー提案をさせる機能は**廃止した**。旧仕様は [SPECIFICATION_AI_SUGGESTION.md](./SPECIFICATION_AI_SUGGESTION.md) を参照（冒頭に廃止注記あり）。課金基盤（Stripe, `app/pricing/`, `app/settings/billing/`, `app/api/billing/`）はコードを温存しており、AI利用に紐づかない形で運用中。プロフィール（目標・レベル・頻度）自体はGPT Actionsエクスポートが利用するため残している。

### その他の拡張候補
- プログレッショントラッキング（重量推移グラフ）
- タイマー機能（インターバル計測）
- エクスポート機能（CSV出力）

## 9. 非機能要件

| 項目 | 要件 |
|------|------|
| レスポンス | 画面遷移 200ms以内 |
| オフライン | 将来検討（PWA対応） |
| アクセシビリティ | WCAG 2.1 AA準拠を目指す |
| ブラウザ | Chrome, Safari (iOS/Android), Edge |
| セキュリティ | Supabase RLS, HTTPS必須 |
