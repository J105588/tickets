# チケット管理システム v2.3

文化祭やイベント向けの座席予約・チェックイン・当日券発行・最高管理者機能を行う高度なWebアプリケーションシステムです。静的ホスティング可能なフロントエンド（HTML/CSS/JS）と、Google Apps Script（GAS）で構築されたバックエンドからなり、完全オフライン動作、PWA更新通知、強化監視システム、URL分散管理などの先進機能を搭載しています。

## 🆕 最新機能（v2.3）

### 重要な更新（2025-09）
- 【クラス別分析の精度向上】ダッシュボードのクラス別分析は、API の seatMap を用いて C 列「予約済」かつ E 列「済」を厳密に集計し、チェックイン率を算出するようになりました（推定値ではなく実データを優先）。
- 【フォールバック最小化】API が成功した場合は推定ロジックを使わず、seatMap ベースの分析結果のみを採用。API 失敗時のみ推定データにフォールバック。
- 【通信最適化】クラス別分析での seatMap 取得は順次実行（200ms 間隔）＋ JSONP タイムアウト 8s ＋ 最大 2 回リトライ。進行中はプログレス UI を表示。
- 【表示強化】クラス全体および公演別に「予約済み」「チェックイン済み」「チェックイン率」を表示。データソース種別（seatMap/fallback/error）と、API データ比率に基づく分析精度も明示。
- 【API 整理】GAS に存在しない `getClassPerformanceData` / `getAllClassesPerformanceData` をフロントエンドから削除し、不要な呼び出しによるエラーを解消。

開発者向けメモ（定義の再確認）
- 予約済み座席数: C 列が「予約済」または「確保」
- チェックイン済み座席数: C 列が「予約済」かつ E 列が「済」
- チェックイン率: 予約済み分母に対するチェックイン済みの割合（%）

### 強化座席監視システム（v2.3）
- **リアルタイム監視**: 15秒間隔で全公演の座席状況を監視
- **インテリジェント通知**: 容量レベル別の優先度通知システム
- **監視ダッシュボード**: リアルタイム表示と統計情報
- **重複防止**: クールダウン機能で重複通知を防止
- **見本演劇除外**: テスト用公演をメール通知対象から除外
- **詳細モーダル表示**: 各公演カードをクリックで詳細な座席分析データを表示
- **正確な演算システム**: 予約済み座席とチェックイン済み座席の正確な計算

### PWA更新通知システム（v2.3）
- **自動更新検知**: Service Workerが新しいデプロイを自動検知
- **美しい通知UI**: グラデーション背景のモダンな更新通知
- **ワンクリック更新**: 「今すぐ更新」ボタンで即座に最新版に更新
- **定期チェック**: 5分間隔での自動更新チェック
- **監査ログ**: 更新通知の表示・適用・却下を詳細記録

### パフォーマンス最適化システム（v2.2）
- **OptimizedLoader**: 依存関係を考慮した並列モジュール読み込み
- **APICache**: インテリジェントキャッシュシステム
- **UIOptimizer**: イベント処理とレンダリングの最適化
- **PerformanceMonitor**: リアルタイムパフォーマンス監視

## 📋 目次

- [🚀 主な機能](#-主な機能)
- [🏗️ システム構成](#️-システム構成)
- [🎯 動作モード](#-動作モード)
- [📱 画面構成](#-画面構成)
- [🔐 最高管理者モード](#-最高管理者モード)
- [🎫 当日券機能](#-当日券機能)
- [⚙️ セットアップ手順](#️-セットアップ手順)
- [🎮 使い方](#-使い方)
- [📖 当日運用マニュアル](#-当日運用マニュアル)
- [🔧 設定とカスタマイズ](#-設定とカスタマイズ)
- [🛡️ セキュリティ](#️-セキュリティ)
- [📊 アーキテクチャ](#-アーキテクチャ)
- [🔄 技術仕様](#-技術仕様)
- [📁 ファイル構成](#-ファイル構成)
- [🚨 トラブルシューティング](#-トラブルシューティング)
- [📚 使用例](#-使用例)
- [🔮 今後の拡張予定](#-今後の拡張予定)
- [⚡ システム最適化](#-システム最適化)
- [👨‍💼 管理者モード完全操作ガイド](#-管理者モード完全操作ガイド)
- [🌐 API URL分散設定ガイド](#-api-url分散設定ガイド)
- [🧪 DEMOモード](#-demoモード)

---

## 🚀 主な機能

### 基本機能
- **座席可視化と予約**（通常モード）
- **予約済/確保/チェックイン待ち/チェックイン済のステータス表示**
- **自動更新**（座席マップの定期リフレッシュ）と手動更新
- **URL管理システム**：複数API URLの自動ローテーションとフェイルオーバー

### 管理者機能
- **管理者モード**：予約済/確保席の複数席同時チェックイン
- **当日券モード**：空席の自動割当（1〜6枚）
- **最高管理者モード**：座席データのC、D、E列を自由に編集可能

### オフライン対応機能（v2.0）
- **完全オフライン動作**：インターネット接続なしでも全機能が利用可能
- **ローカル処理**：キャッシュされた座席データでの即座な操作
- **自動同期**：オンライン復帰時に操作を自動でサーバーに反映（バックグラウンド同期間隔: 約15秒）
- **当日券オフライン発行**：オフライン時でも当日券を発行・表示
- **Service Worker**：ページとアセットのオフラインキャッシュ

### PWA更新通知機能（v2.3）
- **自動更新検知**：新しいデプロイを自動検知
- **更新通知UI**：美しいグラデーション通知で更新を促す
- **ワンクリック更新**：「今すぐ更新」ボタンで即座に最新版に更新
- **定期チェック**：5分間隔での自動更新チェック
- **監査ログ**：更新通知の表示・適用・却下を記録

### URL管理・負荷分散機能（v2.1）
- **複数API URL対応**：使用数上限回避のための分散処理
- **自動ローテーション**：5分間隔でのURL自動切り替え
- **ランダム選択**：手動更新時の確実なURL変更
- **フェイルオーバー**：API呼び出し失敗時の自動切り替え
- **アニメーション通知**：URL変更時の視覚的フィードバック
- **URL情報表示**：現在使用中のAPI URLの表示

### モード管理
- **サイドバーからのモード切り替え**（通常/管理者/当日券/最高管理者）
- **パスワード認証**によるセキュリティ
- **リアルタイムモード表示**
  - URLパラメータでも指定可能: `?mode=<normal|admin|walkin|superadmin>&password=<パスワード>`

---

## 🏗️ システム構成

### フロントエンド（v2.3最適化版）
- **静的ファイル群**（HTML/CSS/ES Modules）。ビルド不要。
- **モジュラー設計**で機能別にファイルを分割
- **レスポンシブデザイン**対応
- **PWA対応**：Service Worker、マニフェスト、オフライン動作
- **最適化システム**：
  - **OptimizedLoader**：依存関係を考慮した並列モジュール読み込み
  - **APICache**：インテリジェントキャッシュシステム
  - **UIOptimizer**：イベント処理とレンダリングの最適化
  - **PerformanceMonitor**：リアルタイムパフォーマンス監視
- **オフライン同期システム（v2.0）**：完全オフライン動作を実現
- **強化監視システム**：リアルタイム座席状況監視と通知

### バックエンド（Google Apps Script）
- **API ルーター**：`doGet`/`doPost`によるJSONP通信処理
- **座席管理**：座席データ取得、予約、チェックイン機能
- **当日券機能**：空席自動割当、連続席確保
- **最高管理者機能**：座席データ直接編集
- **認証システム**：モード別パスワード認証
- **ログシステム**：操作監査とエラーログ
- **通知システム**：満席通知とステータス監視

### 通信層（最適化）
- **OptimizedGasAPI**：キャッシュ対応のAPI呼び出し
- **URL管理システム**：複数API URLの自動管理とローテーション
- **フェイルオーバー機能**：API呼び出し失敗時の自動切り替え
- **オフライン委譲機能**：オフライン時の操作をローカル処理に委譲
- **キャッシュ統合**：API呼び出しの重複排除と最適化

### データストア
- **Google スプレッドシート**：座席データ、ログデータ
- **ローカルストレージ**：オフラインキャッシュ、操作キュー
- **Service Worker キャッシュ**：静的アセットのオフライン保存
- **メモリキャッシュ**：リアルタイムデータの高速アクセス

### システム全体アーキテクチャ（v2.3）
```mermaid
graph TB
  subgraph "フロントエンド層"
    A[OptimizedLoader]
    B[HTML Pages]
    C[CSS Files]
    D[JavaScript Modules]
    E[Service Worker v2.3]
  end
  
  subgraph "最適化システム"
    F[APICache]
    G[UIOptimizer]
    H[PerformanceMonitor]
    I[OfflineSyncV2]
  end
  
  subgraph "通信・API層"
    J[OptimizedGasAPI]
    K[URL管理システム]
    L[フェイルオーバー]
    M[オフライン委譲]
  end
  
  subgraph "監視・通知システム"
    N[EnhancedStatusMonitor]
    O[MonitoringDashboard]
    P[PWA更新通知]
    Q[監査ログ]
  end
  
  subgraph "バックエンド（GAS）"
    R[Code.gs - API Router]
    S[SpreadsheetIds.gs]
    T[TimeSlotConfig.gs]
    U[system-setting.gs]
  end
  
  subgraph "データストア"
    V[Google Spreadsheet]
    W[Local Storage]
    X[Service Worker Cache]
    Y[Memory Cache]
  end
  
  A --> F
  A --> G
  A --> H
  A --> I
  F --> J
  G --> A
  H --> A
  I --> J
  J --> K
  J --> L
  J --> M
  K --> R
  L --> R
  M --> I
  N --> J
  O --> N
  P --> E
  Q --> J
  R --> S
  R --> T
  R --> U
  R --> V
  I --> W
  E --> X
  F --> Y
```

### 依存関係図（v2.3詳細版）
```mermaid
graph TD
  subgraph "最適化層"
    A[optimized-loader.js]
    B[api-cache.js]
    C[optimized-api.js]
    D[ui-optimizer.js]
    E[performance-monitor.js]
  end
  
  subgraph "設定・共通"
    F[config.js]
    G[styles.css]
    H[error-handler.js]
  end
  
  subgraph "オフライン同期"
    I[offline-sync-v2.js]
    J[offline-sync-v2.css]
    K[sw.js]
  end
  
  subgraph "監視・通知"
    L[enhanced-status-monitor.js]
    M[monitoring-dashboard.html]
    N[pwa-update.js]
  end
  
  subgraph "UI層"
    O[sidebar.js]
    P[sidebar.css]
    Q[pwa-install.js]
  end
  
  subgraph "ページ別JS"
    R[index-main.js]
    S[timeslot-main.js]
    T[seats-main.js]
    U[walkin-main.js]
    V[logs-main.js]
  end
  
  subgraph "ページ別CSS"
    W[seats.css]
    X[walkin.css]
    Y[logs.css]
  end
  
  subgraph "ページ別HTML"
    Z[index.html]
    AA[timeslot.html]
    BB[seats.html]
    CC[walkin.html]
    DD[logs.html]
  end
  
  A --> B
  A --> C
  A --> D
  A --> E
  A --> F
  A --> I
  A --> O
  B --> C
  C --> O
  C --> I
  D --> A
  E --> A
  F --> C
  H --> O
  I --> R
  I --> S
  I --> T
  I --> U
  I --> V
  L --> C
  M --> L
  N --> A
  O --> R
  O --> S
  O --> T
  O --> U
  O --> V
  G --> P
  G --> W
  G --> X
  G --> I
  P --> Z
  P --> AA
  P --> BB
  P --> CC
  P --> DD
  Q --> Z
  Q --> AA
  Q --> BB
  Q --> CC
  I --> Z
  I --> AA
  I --> BB
  I --> CC
  R --> Z
  S --> AA
  T --> BB
  U --> CC
  V --> DD
  W --> BB
  X --> CC
  K -.-> Z
  K -.-> AA
  K -.-> BB
  K -.-> CC
  K -.-> DD
```

---

## 🎯 動作モード（サイドバー > モード変更）

| モード | 権限 | 機能 | 認証 |
|--------|------|------|------|
| **通常モード** | 一般ユーザー | 座席予約が可能 | 不要 |
| **管理者モード** | 管理者 | チェックイン、座席名表示 | パスワード必要 |
| **当日券モード** | 当日券担当 | 空席自動割当、当日券発行 | パスワード必要 |
| **最高管理者モード** | 最高管理者 | 座席データ編集、当日券発行、全権限 | パスワード必要 |

---

## 📱 画面構成

### メインページ
- `index.html`: 組選択ページ
- `timeslot.html`: 時間帯選択ページ
- `seats.html`: 座席選択・予約ページ（通常/管理者/最高管理者/当日券）
- `walkin.html`: 当日券発行ページ（当日券/最高管理者）

### 共通レイアウト/部品
- `styles.css`: 全体スタイル
- `sidebar.js` / `sidebar.css`: サイドバー、モード切替モーダル、ナビゲーション

### 機能別ファイル
- `seats-main.js` / `seats.css`: 座席マップ表示・予約・チェックイン・最高管理者編集・当日券ナビゲーション
- `walkin-main.js` / `walkin.css`: 当日券発行、枚数選択（±ボタン対応）
- `timeslot-main.js` / `timeslot-schedules.js`: 時間帯選択（フロント固定データ）

### バックエンド（GAS）
- `Code.gs`: API ルーター（doGet/doPost/JSONP 応答含む）と座席・予約・チェックイン・当日券・最高管理者編集処理
- `TimeSlotConfig.gs`: 時間帯設定（GAS 側）
- `SpreadsheetIds.gs`: 各公演のスプレッドシート ID 管理
- `system-setting.gs`: パスワード設定ユーティリティ（最高管理者パスワード含む）

---

## 🔐 最高管理者モードの詳細機能

### 権限と表示
- 管理者モードと同様に座席に名前が表示される
- ヘッダーに「最高管理者モード」の表示（濃い赤色）
- 座席クリック時に視覚的フィードバック（濃い赤色で選択状態表示）

### 座席編集機能
- **任意の座席を選択可能**：ステータスに関係なく全ての座席をクリック可能
- **編集モーダル表示**：座席クリック時にC、D、E列の編集フォームが表示
- **列別編集**：
  - **C列**: ステータス（空、確保、予約済など）
  - **D列**: 予約名・備考
  - **E列**: チェックイン状態・その他
- **確認ダイアログ**：確定ボタンで「本当に変更しますか？」の確認
- **自動更新**：編集後は座席データが自動再読み込みされる

### セキュリティ
- `SUPERADMIN_PASSWORD`によるパスワード認証
- スプレッドシートの直接更新（C、D、E列のみ）

### 視覚的フィードバック
- 選択された座席は濃い赤色（#8B0000）で表示
- 白いボーダーと影で視認性を向上
- 単一選択（他の座席の選択は自動クリア）

---

## 🎫 当日券機能（オンライン/オフライン同等の席選定ロジック）

### アクセス制限
- **ページレベル制限**: 当日券ページ（`walkin.html`）は当日券モードまたは最高管理者モードでのみアクセス可能
- **自動リダイレクト**: 許可されていないモードでアクセスした場合、座席選択ページに自動リダイレクト
- **ボタンレベル制限**: 座席選択画面の当日券ボタンは、許可されたモードでのみ表示・有効化
- **リアルタイム制御**: サイドバーでモード変更時に即座にアクセス制限が適用される

### 発行方法（挙動の統一）
- **一緒（同一行の連続席で確保）**: 行優先 A→E、席番号昇順で同一行の連番を確保（オンライン/オフライン同一）。
- **どこでもよい**: 行優先 A→E、席番号昇順で先頭から必要数を確保（ランダムではなく決定的に統一）。

### 枚数選択
- 1〜6枚の範囲で選択可能
- ±ボタンによる直感的な操作
- 再入防止機能で誤操作を防止

### オフライン当日券発行（改善点）
- **ローカル処理**: オフライン時でもキャッシュされた座席データで当日券を発行
- **座席表示**: オフライン発行時も実際の座席番号を表示（例：`A1 / A2 (ローカル処理)`）
- **自動同期**: オンライン復帰時にローカル予約を当日券として正式登録（`updateSeatData` が一時失敗した場合はキューへ委譲）
- **重複防止**: ローカルで予約した座席をそのまま当日券として登録（新規座席割当なし）
- **当日券用空席データ**: 当日券モード時に約10秒間隔でプルし、ローカル座席キャッシュが空でも補完

---

## ⚙️ セットアップ手順

### 1. スプレッドシート準備
- 各公演（組/日/時間帯）に対応するスプレッドシートを用意
- 座席シート名は `Seats` に統一
- 列レイアウト（`Code.gs` の参照範囲に一致）
  - **A列**: 行ラベル（A〜E）
  - **B列**: 列番号（1〜12、E は 1〜6）
  - **C列**: ステータス（`空`/`確保`/`予約済`）
  - **D列**: 予約名（任意）
  - **E列**: チェックイン（`済` のみ使用）

### 2. GAS デプロイ
- Google Apps Script プロジェクトを作成
- `Code.gs` / `TimeSlotConfig.gs` / `SpreadsheetIds.gs` / `system-setting.gs` を貼り付け
- `SpreadsheetIds.gs` の `SEAT_SHEET_IDS` を公演ごとに正しい ID へ更新
- `system-setting.gs` の `setupPasswords()` を一度実行して、全パスワードを設定
- ウェブアプリとしてデプロイ
  - 実行する関数: `doGet`
  - アクセス権: 全員（匿名含む）/組織内など、運用ポリシーに合わせて設定
- デプロイ URL を控えておきます

### 3. フロント設定
- `config.js` の `GAS_API_URLS` 配列にデプロイ URL を設定
- 複数URLを設定することで負荷分散とフェイルオーバーが有効化
- ローカル開発時は、任意の静的サーバーで `index.html` を開いて動作確認

---

## 🎮 使い方

### 1. 組選択（`index.html`）
- 組を選ぶと `timeslot.html?group=1` のように遷移

### 2. 時間帯選択（`timeslot.html`）
- 組に紐づく時間帯を表示（`timeslot-schedules.js` を参照）
- 選択するとモードに応じてページ遷移：
  - 通常: `seats.html?group=1&day=1&timeslot=A`
  - 当日券: `walkin.html?group=1&day=1&timeslot=A`
  - URL に `admin=true` が付与されている場合は管理者コンテキストが引き継がれます

### 3. 座席ページ（`seats.html`）
- **通常モード**: 空席を選択し「この席で予約する」。予約後はステータスが更新されます
- **管理者モード**: 予約済/確保席が選択可能となり、複数選択して「チェックイン」を実行可能
- **最高管理者モード**: 任意の座席をクリックしてC、D、E列のデータを編集可能
- **当日券ボタン**: 当日券モードまたは最高管理者モードでのみ表示・有効
- **自動更新**: 約30秒ごと（ユーザー操作時は一時停止）。手動更新ボタンもあり
- **モーダル**: 編集モーダルは開閉アニメーション付きで表示されます

### 4. 当日券ページ（`walkin.html`）
- **アクセス制限**: 当日券モードまたは最高管理者モードでのみアクセス可能
- **自動リダイレクト**: 許可されていないモードでアクセスした場合、座席選択ページに自動リダイレクト
- **枚数選択**: 枚数（1〜6）を ± ボタンまたは入力で指定
- **発行方法選択**: 2つの発行方法から選択できます：
  - **一緒（同一行の連続席で確保）**: 指定した枚数を同じ行で連続した席として確保します（行をまたぐ並びは不可）
 - **どこでもよい**: 行優先 A→E、席番号昇順で先頭から必要数を確保します（決定的に同一のロジック）
- **発行結果表示**: 発行後、割当席（単数/複数）を画面表示します

---

## 🔄 オフライン同期システム（v2.0）

### 概要
完全なオフライン動作を実現する高度な同期システム。インターネット接続が不安定な環境でも、すべての機能を継続して利用できます。

### 主要機能

#### 1. ローカル処理
- **座席予約**: オフライン時でもキャッシュされた座席データで予約可能
- **チェックイン**: ローカルでチェックイン状態を更新
- **当日券発行**: オフライン時でも当日券を発行・座席表示
- **座席編集**: 最高管理者モードでの座席データ編集

#### 2. 自動同期
- **オンライン復帰検知**: ネットワーク接続復旧を自動検知
- **操作キュー**: オフライン中の操作を順序付きで保存
- **競合解決**: データ競合を自動で解決
- **リトライ機能**: 失敗した操作の自動再試行
- **バックグラウンド同期**: 約15秒おきにキュー同期/キャッシュ更新を実施

#### 3. キャッシュ管理
- **座席データキャッシュ**: 最新の座席情報をローカルに保存
- **有効性チェック**: キャッシュの有効期限と整合性を管理
- **自動更新**: オンライン時のデータ取得でキャッシュを更新

### オフライン動作フロー
```mermaid
sequenceDiagram
  participant U as ユーザー
  participant P as ページ
  participant O as OfflineSyncV2
  participant C as キャッシュ
  participant A as API
  participant G as GAS

  Note over U,G: オフライン時
  U->>P: 座席予約/当日券発行
  P->>O: 操作をキューに追加
  O->>C: ローカルキャッシュを更新
  O-->>P: ローカル処理完了
  P-->>U: 座席番号表示

  Note over U,G: オンライン復帰
  O->>O: 接続復旧を検知
  O->>A: キュー操作を順次送信
  A->>G: サーバーに反映
  G-->>A: 成功レスポンス
  A-->>O: 同期完了
  O->>C: キャッシュを更新
  O-->>P: 同期完了通知
```

### 当日券オフライン発行の詳細（最新フロー v2.3）
```mermaid
graph TD
  A[当日券発行要求] --> B{オンライン?}
  B -->|Yes| C[通常のGAS API呼び出し]
  B -->|No| D[ローカル処理]
  
  D --> E{キャッシュ有効?}
  E -->|Yes| F[座席をローカル予約]
  E -->|No| G[エラー: データ不足]
  
  F --> H[座席番号を表示]
  H --> I[操作をキューに保存]
  
  J[オンライン復帰] --> K[キューから操作を取得]
  K --> L[ローカル予約を当日券として登録（C=予約済 / D=当日券_日時 / E=空）]
  L --> M[キャッシュを更新]
  M --> N[同期完了]
```

### 設定とカスタマイズ

#### オフライン同期設定
- **同期間隔**: `OFFLINE_CONFIG.SYNC_INTERVAL` (デフォルト: 30秒)
- **リトライ回数**: `OFFLINE_CONFIG.MAX_RETRY_COUNT` (デフォルト: 3回)
- **キャッシュ有効期限**: `OFFLINE_CONFIG.CACHE_EXPIRY` (デフォルト: 24時間)
- **タイムアウト**: `OFFLINE_CONFIG.API_TIMEOUT` (デフォルト: 15秒)

#### デバッグ機能
```javascript
// ブラウザコンソールで利用可能
OfflineSyncV2.showQueueStatus()        // キュー状況表示
OfflineSyncV2.debugCacheData(group, day, timeslot)  // キャッシュ詳細
OfflineSyncV2.clearCacheForContext(group, day, timeslot)  // キャッシュクリア
```

---

## 🔄 URL管理システム（v2.1）

### 概要
複数のAPI URLを自動管理し、使用数上限回避と負荷分散を実現する高度なURL管理システム。

### 主要機能

#### 1. 自動ローテーション
- **定期切り替え**: 5分間隔で自動的にURLを切り替え
- **ランダム初期化**: 起動時にランダムなURLを選択
- **確実な変更**: 必ず現在のURLとは異なるURLを選択

#### 2. 手動URL変更
- **更新ボタン**: 右上の「更新」ボタンで即座にURL変更
- **アニメーション通知**: URL変更時に視覚的な通知を表示
- **URL情報表示**: 現在使用中のAPI URLを表示

#### 3. フェイルオーバー機能
- **自動切り替え**: API呼び出し失敗時に次のURLに自動切り替え
- **リトライ機能**: 複数URLでの再試行
- **エラー処理**: 詳細なエラーログとデバッグ情報

### URL管理フロー
```mermaid
graph TD
    A[API呼び出し] --> B{現在のURL}
    B --> C[API呼び出し実行]
    C --> D{成功?}
    D -->|成功| E[レスポンス返却]
    D -->|失敗| F[次のURL選択]
    F --> G[フェイルオーバー実行]
    G --> H{全URL試行済み?}
    H -->|No| C
    H -->|Yes| I[エラー返却]
    
    J[定期ローテーション] --> K[URL変更]
    K --> L[アニメーション通知]
    
    M[手動更新] --> N[ランダムURL選択]
    N --> O[URL変更]
    O --> P[アニメーション通知]
```

### 設定方法

#### 1. 基本設定
```javascript
// config.js
const GAS_API_URLS = [
  "https://script.google.com/macros/s/MAIN_DEPLOY_ID/exec",
  "https://script.google.com/macros/s/BACKUP_DEPLOY_ID/exec",
  "https://script.google.com/macros/s/THIRD_DEPLOY_ID/exec"
];
```

#### 2. ローテーション間隔の調整
```javascript
// config.js - APIUrlManager クラス内
this.rotationInterval = 5 * 60 * 1000; // 5分間隔（ミリ秒）
```

#### 3. デバッグ機能
```javascript
// ブラウザコンソールで利用可能
GasAPI.getUrlManagerInfo()     // 現在のURL情報を取得
GasAPI.selectRandomUrl()       // 手動でランダムURL選択
GasAPI.getAllUrls()           // 利用可能なURL一覧を取得
```

### アニメーション通知

#### 表示内容
- **ローテーション時**: ↻ アイコン + "API URL ローテーション"
- **ランダム選択時**: ⚡ アイコン + "API URL ランダム選択"
- **URL表示**: デプロイIDの最初の8文字を表示

#### アニメーション効果
- **スライドイン**: 上から下へ滑らかに表示
- **スライドアウト**: 下から上へ滑らかに非表示
- **自動消去**: 3秒後に自動で消える
- **クリック消去**: クリックで即座に消す

### トラブルシューティング

#### よくある問題
1. **URL変更されない**
   - `GAS_API_URLS` に複数のURLが設定されているか確認
   - ブラウザコンソールでエラーメッセージを確認

2. **アニメーションが表示されない**
   - `showUrlChangeAnimation` 関数がグローバルに公開されているか確認
   - ブラウザのJavaScriptエラーを確認

3. **フェイルオーバーが動作しない**
   - 各URLが正しくデプロイされているか確認
   - ネットワーク接続状況を確認

---

## 📊 ログシステム（サーバーログ vs クライアント監査）

### 用途の違い
- **OPERATION_LOGS（サーバーログ）**
  - GAS 側のAPI実行を記録（関数名・結果・例外）。サーバー挙動の監査・障害解析用。
- **CLIENT_AUDIT（クライアント監査）**
  - フロントから送られる操作監査。必ず「いつ・どの端末（UserAgent）・何を・変更前・変更後」を残す。
  - 予約/チェックイン/当日券発行などはサーバー内でbefore/afterを確定させて追記。

### 監査ログの保存先（スプレッドシート）
- スクリプトプロパティに設定（GAS側）
  - `LOG_SPREADSHEET_ID`: ログ保存用スプレッドシートID（必須）
  - `CLIENT_AUDIT_SHEET_NAME`: 監査シート名（省略時 `CLIENT_AUDIT`）
- `CLIENT_AUDIT` シートの列（自動作成）
  1. Timestamp
  2. EventType（例: api/ui/nav/error）
  3. Action（例: reserveSeats/checkInSeat/assignWalkInSeat/mode_change など）
  4. Metadata（JSON: before/after/対象座席/パラメータ など）
  5. SessionId
  6. UserId
  7. UserAgent
  8. IPAddress

### クライアント送信仕様
- まず `POST`（doPost）で送信し、失敗時は JSONP（doGet）に自動フォールバック。
- バッチは小さく分割して送信（URL長エラー回避）。
- API 呼び出し結果は自動で `type: 'api'` として記録。
- UI イベント（クリック/変更/モード変更/疎通テスト）は `type: 'ui'` で記録。

### ログ表示（logs.html）
- データソース: `getClientAuditLogs`, `getClientAuditStatistics`
- アクセス制御:
  - サイドバーから遷移時に `?auth=<token>` を付与（最高管理者専用）
  - `logs.html` 起動時に `auth === localStorage.superadminToken` を検証し、不一致なら赤字で「権限がありません」を表示

#### ログアクセス制御フロー（最新版）
```mermaid
sequenceDiagram
  participant U as ユーザー
  participant SB as sidebar.js
  participant L as logs.html
  participant LS as localStorage

  U->>SB: 操作ログメニューをクリック
  SB->>LS: superadminToken を取得（なければ生成）
  SB->>L: logs.html?auth=<token> に遷移
  L->>LS: superadminToken を取得
  L->>L: URLの auth と LS の token を比較
  alt 一致
    L-->>U: ログ一覧・統計を表示
  else 不一致
    L-->>U: 権限がありません（赤字表示）
  end
```

### セットアップ手順（監査ログ）
1) GAS エディタ > プロジェクトのプロパティ > スクリプトのプロパティ に以下を追加
   - `LOG_SPREADSHEET_ID` = 監査ログ用スプレッドシートのID
   - 任意 `CLIENT_AUDIT_SHEET_NAME` = `CLIENT_AUDIT`
2) Webアプリとしてデプロイ → デプロイURLを `config.js` の `GAS_API_URLS` に設定
3) フロントを再読み込みして、座席操作やモード変更を実行
4) スプレッドシートの `CLIENT_AUDIT` シートに行が追記されていることを確認

## 🔧 設定とカスタマイズ

### 基本設定
- **API エンドポイント**: `config.js` の `GAS_API_URLS` 配列
- **デバッグログ**: `config.js` の `DEBUG_MODE`
- **URL管理設定**: `config.js` の `APIUrlManager` クラス
- **ローテーション間隔**: デフォルト5分間隔（`rotationInterval`）

### 通知メール宛先の設定（重要）
- 宛先リストはフロント側の `config.js` にハードコードされています。
  - `FULL_CAPACITY_NOTIFICATION_EMAILS` を編集してください。
- クライアントは送信時にこのリストを必ず注入し、GAS には統合済みの `emails` 配列を渡します。
- GAS 側の `sendStatusNotificationEmail` は受け取った `emails` をそのまま送信に使用します。
  - そのため、宛先変更は原則「`config.js` のみ」で完結します。
  - 例外として、GAS 内で別の固定リストを参照する独自実装を残している場合は、そちらも合わせて更新してください。

---

## 🔍 強化座席監視システム（v2.3）

### 概要
リアルタイムで全公演の座席状況を監視し、容量レベルに応じたインテリジェント通知システムを提供する高度な監視システムです。テスト用公演（見本演劇）を自動的に除外し、実際の運用に必要な通知のみを送信します。

### 主要機能

#### 1. リアルタイム監視
- **頻繁なチェック**: デフォルト15秒間隔で全公演の座席状況を監視
- **状態変化検知**: 前回の状態と比較して変化を検出
- **容量レベル判定**: 正常・警告・緊急・満席の4段階で分類
- **見本演劇除外**: テスト用公演を自動的に監視対象から除外

#### 2. インテリジェント通知システム
- **優先度別通知**: 高・中・低の3段階で通知優先度を設定
- **重複防止**: クールダウン機能で同じ公演への重複通知を防止
- **詳細レポート**: 統計情報とトレンド分析を含む包括的なメール通知
- **フィルタリング**: 見本演劇などのテスト用公演を通知対象から除外

#### 3. パフォーマンス最適化
- **APIキャッシュ**: 頻繁なAPI呼び出しを最適化
- **並列処理**: 複数のリクエストを同時実行
- **リトライ機能**: 失敗時の自動リトライ

#### 4. 監視ダッシュボード
- **リアルタイム表示**: 現在の座席状況を視覚的に表示
- **統計情報**: システムの動作状況とパフォーマンス指標
- **設定管理**: 監視間隔や閾値の動的変更

### 容量レベル

| レベル | 条件 | 色 | 説明 |
|--------|------|-----|------|
| 正常 | 6席以上 | 緑 | 十分な空席がある |
| 警告 | 3-5席 | 黄 | 空席が少なくなってきた |
| 緊急 | 1-2席 | オレンジ | 空席が非常に少ない |
| 満席 | 0席 | 赤 | 空席がない |

### 通知優先度

| 優先度 | 条件 | 説明 |
|--------|------|------|
| 高 | 満席になった | 即座に通知が必要 |
| 中 | 緊急レベルに変化 | 注意が必要 |
| 低 | 警告レベルに変化 | 参考情報 |

### 使用方法

#### 1. 基本的な監視開始
```javascript
import enhancedStatusMonitor from './enhanced-status-monitor.js';

// 監視開始
enhancedStatusMonitor.start();

// 監視停止
enhancedStatusMonitor.stop();
```

#### 2. 設定の変更
```javascript
// 監視間隔を変更（30秒間隔）
enhancedStatusMonitor.setCheckInterval(30000);

// 容量閾値を変更
enhancedStatusMonitor.updateCapacityThresholds({
  warning: 3,    // 3席以下で警告
  critical: 1,   // 1席以下で緊急
  full: 0        // 0席で満席
});

// 通知クールダウンを変更（10分間）
enhancedStatusMonitor.setNotificationCooldown(600000);
```

#### 3. 見本演劇除外機能
```javascript
// 見本演劇は自動的に除外されます
// 監視対象から除外される公演名:
// - "見本演劇"
// - その他のテスト用公演（設定により追加可能）

// 除外対象の確認（デバッグ用）
const abnormalTimeslots = enhancedStatusMonitor.getAbnormalTimeslots();
// 見本演劇は含まれません
```

#### 4. 統計情報の取得
```javascript
const stats = enhancedStatusMonitor.getStatistics();
console.log('総チェック回数:', stats.totalChecks);
console.log('総通知回数:', stats.totalNotifications);
console.log('平均空席数:', stats.averageEmptySeats);
console.log('パフォーマンス統計:', stats.performanceStats);
```

### 監視ダッシュボード
`monitoring-dashboard.html`を開くことで、以下の機能を利用できます：

#### リアルタイム表示
- 各公演の現在の座席状況
- 容量レベル別の公演数
- システム統計情報

#### 詳細モーダル表示（新機能）
- **公演カードクリック**: 各公演カードをクリックで詳細モーダルを表示
- **詳細座席分析**: 予約済み座席とチェックイン済み座席の詳細データ
- **正確な演算**: 要求仕様に準拠した正確な座席数計算
- **クラス別分析（更新）**: seatMap から C/E 列を厳密判定してチェックイン率を表示。データソース（seatMap/fallback/error）と分析精度も併記。
- **データ整合性チェック**: ダッシュボードデータと詳細分析の整合性確認
- **エラー検証**: データ検証エラーと警告の表示
- **データソース情報**: API取得時刻、データソース、分析結果の詳細表示

#### 監視制御
- 監視の開始・停止
- 設定の動的変更
- 手動チェック実行

#### 通知履歴
- 過去の通知履歴表示
- 通知履歴のクリア

#### Service Worker 連携（FULL アラートのブロードキャスト）
- `sw.js` は満席検知イベントを受けると、登録済みクライアントへ `postMessage({ type: 'FULL_ALERT', ... })` を送信
- 最高管理者モードのクライアントのみ受信できるよう、`REGISTER_SUPERADMIN` / `UNREGISTER_SUPERADMIN` メッセージで登録制御
- 権限クライアントがいない場合も、通知権限があれば OS 通知を表示

## 🆕 監視・通知・URL・通信の最新仕様（ダッシュボード強化）

### ダッシュボード更新ポリシー（UI保持・バックグラウンド更新）
- 初回取得のみローディング表示。
- 以降は15秒ごとにバックグラウンドで再取得し、UIは保持したまま差分更新（カードを再生成せず、要素をインプレース更新）。
- 受信済みの公演カードは常時表示（新規・更新のみ書き換え）。
- 更新遅延カードは `stale` クラス付与で視覚化可能。
- 上部ステータスカード（満席/緊急/警告/正常）をクリックすると、該当ステータスの公演一覧モーダルを表示。

### メール通知ポリシー（重複抑止・内容明確化）
- 送信タイミング:
  - 初回取得直後に異常（normal 以外）があれば即時送信。
  - 以降は5分ごとに再評価。前回送信時から異常セットに変化がある場合のみ再送信。
- 変化検出:
  - 公演キー（`group|day|timeslot`）＋ `capacityLevel` ＋ `emptySeats` ＋ `occupiedSeats` を署名化して比較。
- 宛先:
  - `config.js` の `FULL_CAPACITY_NOTIFICATION_EMAILS` を必ず注入（重複排除）。
- 送信堅牢化:
  - バッチ送信失敗時は受信者単位でフォールバック送信（リトライ付き）。
  - 部分成功時は成功件数/失敗件数を応答に含め、ダッシュボードは部分成功を成功として扱えるように設計。
- メール本文（例）:
  - 件名: `[座席監視] 異常ステータス N件`
  - 本文（公演ごとに）:
    - 公演：<組> <日>日目 <枠>
    - 現在の状況：満席/緊急/警告/正常
    - 残り：<空席>/<総席> 席
    - 最終更新：<日時>

```mermaid
sequenceDiagram
  participant D as Dashboard
  participant A as GasAPI(JSONP)
  participant G as GAS
  Note over D: 初回取得
  D->>A: getDetailedCapacityAnalysis (JSONP,∞待機)
  A->>G: doGet(func=...)
  G-->>A: analysis
  A-->>D: analysis
  D->>D: UI更新（既存カード更新/保持）
  D->>D: 異常検出→即時送信（初回）
  Note over D: 以降15秒ごとBG更新
  loop 15s
    D->>A: analysis 取得（BG）
    A-->>D: 結果 or フォールバック(getFullCapacityTimeslots)
    D->>D: 署名比較→5分経過かつ変化ありなら送信
  end
```

### URLローテーション（ダッシュボード連携）
- ダッシュボード上に接続先GASの現在URL/インデックス/最終ローテーション時刻を表示。
- 手動操作:
  - 更新: 情報の再読み込み。
  - ランダム切替: 現在と異なるURLへ強制切替。
- 自動操作:
  - 10分ごとに自動でランダム切替（現在とは必ず異なるURL）。

```mermaid
sequenceDiagram
  participant U as User
  participant D as Dashboard
  participant API as GasAPI
  U->>D: 画面表示
  D->>API: getUrlManagerInfo
  API-->>D: {index,total,url,lastRotation}
  Note over D: 10分ごとに selectRandomUrl()
  loop 10min
    D->>API: selectRandomUrl
    API-->>D: 新URL情報
  end
```

### 通信方式（CORS回避・タイムアウト設計）
- CORS回避のため、重いAPIは JSONP をデフォルト使用。
- JSONPタイムアウトは可変:
  - 通常: 20s
  - 大量集計/通知: 無限待機（`timeoutMs: null`）
- POST失敗時は JSONP へ自動フォールバック。


---

## 🧪 DEMOモード

DEMOモードは、指定したURLパラメータからのみ起動でき、UIには表示されない隠しモードです。DEMOモード中はシステム全体が「見本演劇」専用として動作します。

### 特徴
- UI上のモード表示・切替には一切出ません（隠しモード）
- URLパラメータでのみ起動可能（例: `?demo=1`）
- DEMO中はグループが強制的に「見本演劇」になります
- 予約・チェックイン・当日券発行・最高管理者などの機能は通常通り使えます（対象は「見本演劇」に限定）
- 「見本演劇」以外のクラスへアクセスしようとすると「権限がありません」と表示されます

### 起動方法
任意のページのURLに `demo=1` を付与してアクセスします。

例:
```
seats.html?group=見本演劇&day=1&timeslot=A&demo=1
```

### 解除方法

#### URLパラメーターでの解除
任意のページのURLに `demo=0` を付与してアクセスします。

例:
```
index.html?demo=0
seats.html?group=見本演劇&day=1&timeslot=A&demo=0
```

対応するパラメーター値:
- `demo=0`, `demo=false`, `demo=off`, `demo=no`, `demo=disable`

#### コンソールでの解除
ブラウザの開発者コンソールで以下を実行します。

```
DemoMode.disable()
```

有効化の確認/手動有効化:
```
DemoMode.isActive()
DemoMode.enable()
```

### 技術メモ
- 実装: `config.js` の `DemoModeManager`
- 強制とガード適用先:
  - `timeslot-main.js`（グループ強制・他クラス拒否）
  - `seats-main.js`（GROUP強制・他クラス拒否）
  - `walkin-main.js`（GROUP強制・他クラス拒否）


### 独立GAS（フェイルオーバー/オフライン用）の追加デプロイ手順
1. 新しい Google Apps Script プロジェクトを作成（本体とは別プロジェクト）
2. 本リポジトリの以下ファイルを新規プロジェクトへコピー
   - `OfflineCode.gs`
   - `OfflineSpreadsheetIds.gs`
   - `OfflineTimeSlotConfig.gs`
   - 必要に応じて（任意）`system-setting.gs` をコピーしてパスワードを設定
3. `OfflineSpreadsheetIds.gs` の `SEAT_SHEET_IDS`/`LOG_SHEET_IDS` を運用値に更新
4. 新規GASをウェブアプリとしてデプロイ（関数: `doGet`）
5. デプロイURLを `config.js` の `GAS_API_URLS` 配列に追加
   - 例: `const GAS_API_URLS = [ 'https://script.google.com/macros/s/MAIN_DEPLOY_ID/exec', 'https://script.google.com/macros/s/BACKUP_DEPLOY_ID/exec' ];`
6. フロントは変更不要。既存の `api.js` と `APIUrlManager` が自動でURL管理を実行します


### 機能別設定
- **時間帯設定（フロント）**: `timeslot-schedules.js` の `TIMESLOT_SCHEDULES`
- **時間帯設定（GAS）**: `TimeSlotConfig.gs`（`_getAllTimeslotsForGroup` 経由で API 提供）
- **スプレッドシート ID**: `SpreadsheetIds.gs` の `SEAT_SHEET_IDS` / `LOG_SHEET_IDS`
- **サイドバー/モード UI**: `sidebar.js` / `sidebar.css`
- **座席レイアウト**: `seats-main.js` の `layout`（行/列/通路位置など）
- **座席スタイル**: `seats.css`（色、サイズ、凡例など）
- **当日券の枚数 UI**: `walkin.css`（`walkin-qty-*` クラス）
- **最高管理者モード**: `seats-main.js` の座席編集機能、`seats.css` のスタイル

### 変更のヒント
- 席行列構成を変える場合は、GAS 側の `isValidSeatId()`（行の最大席数）と、フロントの `layout`/描画に整合性を持たせてください
- シート名を変更する場合は、`SpreadsheetIds.gs` の `TARGET_SEAT_SHEET_NAME` を合わせて変更します
- モード認証の要件を変える場合は、`sidebar.js` の `applyModeChange()` と GAS 側 `verifyModePassword()` を調整します
- 最高管理者モードの編集可能列を変更する場合は、`Code.gs` の `updateSeatData()` 関数を修正します

---

## 🛡️ セキュリティ

### パスワード管理
- パスワードは GAS のスクリプトプロパティに保存
- リポジトリに平文で置かない
- 公開レベルは運用方針に従って最小権限にする

### 最高管理者モード
- 最高管理者モードは最も高い権限を持つため、適切なパスワード管理が重要です
- 強力なパスワードの使用
- 定期的なパスワード変更
- 必要最小限のユーザーのみに権限を付与

### 当日券機能のアクセス制限
- **ページレベル制限**: 当日券ページ（`walkin.html`）は当日券モードまたは最高管理者モードでのみアクセス可能
- **自動リダイレクト**: 許可されていないモードでアクセスした場合、座席選択ページに自動リダイレクト
- **ボタンレベル制限**: 座席選択画面の当日券ボタンは、許可されたモードでのみ表示・有効化
- **リアルタイム制御**: サイドバーでモード変更時に即座にアクセス制限が適用される

---

## 📊 アーキテクチャ

### システムアーキテクチャ（v2.2最適化版）
```mermaid
graph TB
  subgraph "最適化フロントエンド"
    A[OptimizedLoader]
    B[サイドバー・モード管理]
    C[座席表示・編集]
    D[当日券発行]
    E[UIOptimizer]
    F[PerformanceMonitor]
  end
  
  subgraph "通信層（最適化）"
    G[OptimizedGasAPI]
    H[APICache]
    I[URL管理システム]
    J[フェイルオーバー]
    K[エラーハンドリング]
  end
  
  subgraph "バックエンド"
    L[GAS Web App]
    M[API ルーター]
    N[ビジネスロジック]
  end
  
  subgraph "データストア"
    O[Google Spreadsheet]
    P[座席データ]
    Q[ログデータ]
  end
  
  A --> G
  A --> H
  G --> I
  G --> J
  G --> K
  G --> L
  L --> O
  B --> G
  C --> G
  D --> G
  E --> A
  F --> A
```

### ページ遷移フロー
```mermaid
graph TD
  I[index.html 組選択] --> T[timeslot.html 時間帯選択]
  T -->|通常| S[seats.html 座席表示/予約]
  T -->|当日券| W[walkin.html 当日券発行]
  S -->|管理者| S
  S -->|最高管理者| S
```

### 最高管理者モードの処理フロー
```mermaid
graph TD
  A[座席クリック] --> B[選択状態表示]
  B --> C[編集モーダル表示]
  C --> D[C,D,E列の入力]
  D --> E[確定ボタン]
  E --> F[確認ダイアログ]
  F -->|はい| G[スプレッドシート更新]
  F -->|いいえ| H[キャンセル]
  G --> I[座席データ再読み込み]
  I --> J[選択状態クリア]
```

### モード認証フロー（URLパラメータ対応）
```mermaid
graph TD
  subgraph UI
    A[サイドバーのモード変更] --> B[パスワード入力]
    X[URL直アクセス: ?mode=...&password=...] --> C
  end
  B --> C[GAS verifyModePassword]
  C --> D{認証成功?}
  D -->|はい| E[localStorage.currentMode を更新]
  E --> F{mode == superadmin?}
  F -->|はい| G[localStorage.superadminToken を生成/維持]
  F -->|いいえ| H[トークンは変更しない]
  G --> I[URLから機密情報を除去（history.replaceState）]
  H --> I
  I --> J[ページリロード]
  D -->|いいえ| K[エラー表示/監査ログ]
```

---

## 🔄 技術仕様

### JSONP 通信
- `api.js` が `<script>` を生成し、`callback` で応答を受け取ります
- 15s タイムアウト、キャッシュバスター、成功時はタイマー解除
- 失敗時は `GAS_API_URLS` の次URLに自動フェイルオーバー

### Walk-in 発行
- `walkin-main.js`
- 再入防止フラグで多重実行を抑止
- 複数席API失敗時は単発APIを複数回呼ぶフォールバック

### サイドバー
- `sidebar.js`
- オーバーレイで重ね表示、背景暗転
- 外側クリック/×で閉じる
- モード変更時は二重送信防止（処理中はボタン/入力を無効化）

### 最高管理者モード
- `seats-main.js`
- 座席クリックで編集モーダル表示
- C、D、E列のデータ編集
- スプレッドシートへの直接更新
- 視覚的フィードバックと選択状態管理

---

## 📁 ファイル構成

### 🌐 フロントエンド（HTML/CSS/JS）

#### メインページ
- **`index.html`**: 組選択ページのメインHTML
  - サイドバーコンテナ、組選択UI、基本レイアウト
  - PWA更新通知機能、URL管理システム情報表示
  - 依存: `styles.css`, `sidebar.css`, `config.js`, `optimized-loader.js`, `index-main.js`
- **`index-main.js`**: 組選択ページのメインロジック
  - 組一覧の表示、選択時のナビゲーション処理
  - 依存: `config.js`, `optimized-api.js`, `sidebar.js`

- **`timeslot.html`**: 時間帯選択ページのメインHTML
  - 時間帯選択UI、ナビゲーション要素
  - 依存: `styles.css`, `sidebar.css`, `config.js`, `optimized-loader.js`, `timeslot-main.js`
- **`timeslot-main.js`**: 時間帯選択ページのメインロジック
  - 時間帯一覧の表示、選択時のページ遷移処理
  - 依存: `config.js`, `optimized-api.js`, `sidebar.js`, `timeslot-schedules.js`
- **`timeslot-schedules.js`**: 時間帯スケジュール定義
  - 各組の時間帯データ（フロントエンド固定）
  - 依存: なし（独立したデータファイル）

- **`seats.html`**: 座席選択・予約ページのメインHTML
  - 座席マップ表示エリア、操作ボタン、自動更新設定UI
  - 依存: `styles.css`, `sidebar.css`, `seats.css`, `config.js`, `optimized-loader.js`, `seats-main.js`
- **`seats-main.js`**: 座席選択・予約ページのメインロジック
  - 座席マップ描画、予約処理、チェックイン処理、最高管理者編集機能
  - 自動更新機能、楽観的更新、エラーハンドリング
  - 依存: `config.js`, `optimized-api.js`, `sidebar.js`, `seats.css`, `ui-optimizer.js`
- **`seats.css`**: 座席選択ページ専用スタイル
  - 座席マップレイアウト、座席状態別色分け、モーダル、自動更新設定UI
  - 依存: `styles.css`（基本スタイル継承）

- **`walkin.html`**: 当日券発行ページのメインHTML
  - 当日券発行UI、枚数選択、発行方法選択モーダル
  - 依存: `styles.css`, `sidebar.css`, `walkin.css`, `config.js`, `optimized-loader.js`, `walkin-main.js`
- **`walkin-main.js`**: 当日券発行ページのメインロジック
  - 当日券発行処理、枚数選択、連続席/ランダム選択機能
  - アクセス制限、エラーハンドリング
  - 依存: `config.js`, `optimized-api.js`, `sidebar.js`, `walkin.css`
- **`walkin.css`**: 当日券ページ専用スタイル
  - 当日券UI、枚数選択、通知、モーダルスタイル
  - 依存: `styles.css`（基本スタイル継承）

- **`logs.html`**: 操作ログ表示ページのメインHTML
  - ログ一覧表示、統計情報、フィルタリング機能
  - 依存: `styles.css`, `sidebar.css`, `logs.css`, `config.js`, `optimized-loader.js`, `logs-main.js`
- **`logs-main.js`**: 操作ログ表示ページのメインロジック
  - ログデータ取得、表示、フィルタリング処理
  - 依存: `config.js`, `optimized-api.js`, `sidebar.js`, `logs.css`
- **`logs.css`**: ログページ専用スタイル
  - ログ表示レイアウト、テーブルスタイル、フィルタUI
  - 依存: `styles.css`（基本スタイル継承）

- **`monitoring-dashboard.html`**: 強化監視ダッシュボード
  - リアルタイム座席状況表示、統計情報、監視制御
  - 詳細モーダル表示機能、正確な演算システム、データ整合性チェック
  - 依存: `styles.css`, `config.js`, `enhanced-status-monitor.js`

#### 最適化・共通ファイル
- **`optimized-loader.js`**: 最適化されたスクリプトローダー
  - 依存関係を考慮した並列モジュール読み込み
  - 段階的初期化（クリティカル→セカンダリ→その他）
  - パフォーマンスメトリクス収集
  - 依存: なし（他のファイルを管理）
- **`api-cache.js`**: インテリジェントキャッシュシステム
  - API呼び出しの重複排除
  - TTL管理とメモリ最適化
  - 自動クリーンアップ機能
  - 依存: なし（独立）
- **`optimized-api.js`**: 最適化されたAPI呼び出し機能
  - キャッシュ対応のJSONP通信
  - エラーハンドリング、URL管理システム連携
  - フェイルオーバー機能、全API関数のラッパー
  - 依存: `config.js`, `api-cache.js`
- **`ui-optimizer.js`**: UI応答性の最適化
  - イベント処理の最適化
  - レンダリング最適化
  - メモリ監視機能
  - 依存: なし（独立）
- **`performance-monitor.js`**: パフォーマンス監視
  - リアルタイムメトリクス収集
  - ダッシュボード表示（Ctrl+Shift+P）
  - メモリ使用量監視
  - 依存: なし（独立）
- **`enhanced-status-monitor.js`**: 強化座席監視システム
  - リアルタイム座席状況監視
  - インテリジェント通知システム
  - 容量レベル判定と統計情報
  - 依存: `optimized-api.js`, `api-cache.js`, `config.js`
- **`audit-logger.js`**: 監査ログシステム
  - クライアント操作の監査ログ記録
  - バッチ送信とエラーハンドリング
  - 依存: `optimized-api.js`
- **`config.js`**: システム設定とURL管理機能
  - GAS API URL配列、URL管理システム（APIUrlManager）
  - デバッグモード設定、デバッグログ機能
  - 自動ローテーション、フェイルオーバー機能
  - DEMOモード管理、強化監視設定
  - 依存: なし（他のファイルから参照される）
- **`styles.css`**: 全体共通スタイル
  - 基本レイアウト、ボタン、フォーム、モーダル、レスポンシブ対応
  - 依存: なし（他のCSSファイルの基盤）
- **`sidebar.js`**: サイドバーとモード管理機能
  - サイドバー表示制御、モード切替UI、パスワード認証
  - ナビゲーション制御、GAS疎通テスト
  - 依存: `optimized-api.js`, `audit-logger.js`
- **`sidebar.css`**: サイドバー専用スタイル
  - サイドバーレイアウト、モード切替モーダル、ナビゲーション
  - 依存: `styles.css`（基本スタイル継承）

#### システム管理
- **`system-lock.js`**: システムロック機能
  - グローバルロック状態管理、ロック/アンロック処理
  - 依存: `error-handler.js`, `optimized-api.js`
- **`error-handler.js`**: エラーハンドリング機能
  - グローバルエラーキャッチ、エラー表示、ログ機能
  - 依存: なし（独立）
- **`pwa-update.js`**: PWA更新通知システム
  - 自動更新検知、更新通知UI、ワンクリック更新機能
  - 定期チェック（5分間隔）、監査ログ記録
  - 依存: なし（独立）
- **`pwa-install.js`**: PWAインストール促進機能
  - インストールプロンプト表示、インストール状態管理
  - 依存: なし（独立）

#### オフライン同期システム
- **`offline-sync-v2.js`**: オフライン同期システム（v2.0最適化版）
  - オフライン操作キュー、自動同期（15秒間隔）、競合解決
  - ローカル処理、キャッシュ管理、当日券オフライン発行（オンライン同等の席選定）
  - メモリ最適化（キューサイズ200件、30秒クリーンアップ）
  - 依存: `config.js`, `optimized-api.js`
- **`offline-sync-v2.css`**: オフライン同期UI
  - オフラインインジケーター、同期進捗バー、通知スタイル
  - 依存: `styles.css`
- **`sw.js`**: Service Worker（v2.3 PWA更新対応版）
  - 段階的キャッシュ（クリティカル6個→セカンダリ20個）
  - メモリ圧迫防止（バッチサイズ3個、100ms待機）
  - iOS対応最適化、PWA更新検知機能
  - 自己修復機能、最高管理者通知機能
  - 依存: なし（独立）

#### PWA関連ファイル
- **`manifest.json`**: PWAマニフェスト
  - アプリケーション情報、アイコン、ショートカット定義
  - 依存: なし（独立）
- **`browserconfig.xml`**: ブラウザ設定
  - Windows/IE用のブラウザ設定
  - 依存: なし（独立）

### 🔧 バックエンド（Google Apps Script）

#### メインAPI
- **`Code.gs`**: メインAPI処理とビジネスロジック
  - **API ルーター**: `doGet`/`doPost`によるJSONP通信処理
  - **座席管理**: `getSeatData`, `getSeatDataMinimal` - 座席データ取得
  - **予約機能**: `reserveSeats` - 複数座席予約
  - **チェックイン機能**: `checkInSeat`, `checkInMultipleSeats` - 単体/複数チェックイン
  - **当日券機能**: `assignWalkInSeat`, `assignWalkInSeats`, `assignWalkInConsecutiveSeats` - 当日券発行
  - **最高管理者機能**: `updateSeatData`, `updateMultipleSeats` - 座席データ編集
  - **認証機能**: `verifyModePassword` - モード別パスワード認証
  - **システム管理**: `getSystemLock`, `setSystemLock` - システムロック制御
  - **危険コマンド**: `execDangerCommand` - コンソール専用危険操作
  - **テスト機能**: `testApi` - 全機能疎通テスト
  - **エラー処理**: `reportError` - クライアントエラー報告
  - **ログシステム**: `getOperationLogs`, `getLogStatistics`, `recordClientAudit` - 監査ログ
  - **監視システム**: `getDetailedCapacityAnalysis`, `sendStatusNotificationEmail` - 強化監視
  - **ヘルパー関数**: `isValidSeatId`, `getSheet` - 共通処理
  - 依存: `TimeSlotConfig.gs`, `SpreadsheetIds.gs`

#### 設定・データ管理
- **`SpreadsheetIds.gs`**: スプレッドシートID管理
  - 公演別スプレッドシートID定義、シート名設定
  - 座席シート、ログシートのID管理
  - 依存: なし（Code.gsから参照される）
- **`TimeSlotConfig.gs`**: 時間帯設定管理
  - 組別時間帯データ定義、時間帯取得API
  - フロントエンドとバックエンドの時間帯データ同期
  - 依存: なし（Code.gsから参照される）
- **`system-setting.gs`**: システム設定ユーティリティ
  - パスワード設定、初期化処理
  - システム設定の一括管理
  - 依存: なし（手動実行用）

#### オフライン用バックエンド（フェイルオーバー）
- **`OfflineCode.gs`**: オフライン用メインAPI処理
  - メインGASと同様の機能を提供
  - フェイルオーバー用の独立したGASプロジェクト
  - 依存: `OfflineSpreadsheetIds.gs`, `OfflineTimeSlotConfig.gs`
- **`OfflineSpreadsheetIds.gs`**: オフライン用スプレッドシートID管理
  - オフライン用GASプロジェクト専用のスプレッドシートID設定
  - メインシステムとは独立したデータストア
  - 依存: なし（OfflineCode.gsから参照される）
- **`OfflineTimeSlotConfig.gs`**: オフライン用時間帯設定
  - オフライン用GASプロジェクト専用の時間帯設定
  - メインシステムと同期した時間帯データ
  - 依存: なし（OfflineCode.gsから参照される）

### 📊 ファイルサイズ情報（最新計測）

| ファイル | サイズ (行) | 説明 |
|----------|-------------|------|
| **.gitignore** | 1 | Git除外設定 |
| **CNAME** | 1 | カスタムドメイン設定 |
| **Code.gs** | 2,331 | メインAPI処理とビジネスロジック |
| **LICENSE** | 21 | ライセンス情報 |
| **README.md** | 1,472 | プロジェクトドキュメント |
| **SpreadsheetIds.gs** | 110 | スプレッドシートID管理 |
| **TimeSlotConfig.gs** | 83 | 時間帯設定管理 |
| **system-setting.gs** | 62 | システム設定ユーティリティ |
| **api.js** | 575 | GAS API呼び出し機能 |
| **optimized-api.js** | 304 | 最適化されたAPI呼び出し機能 |
| **api-cache.js** | 270 | インテリジェントキャッシュシステム |
| **optimized-loader.js** | 160 | 最適化されたスクリプトローダー |
| **ui-optimizer.js** | 343 | UI応答性の最適化 |
| **performance-monitor.js** | 279 | パフォーマンス監視 |
| **enhanced-status-monitor.js** | 419 | 強化座席監視システム（見本演劇除外機能追加） |
| **audit-logger.js** | 245 | 監査ログシステム |
| **config.js** | 344 | システム設定とURL管理機能 |
| **error-handler.js** | 194 | エラーハンドリング機能 |
| **system-lock.js** | 102 | システムロック機能 |
| **pwa-update.js** | 474 | PWA更新通知システム |
| **pwa-install.js** | 182 | PWAインストール促進機能 |
| **full-capacity-monitor.js** | 253 | 満席監視システム |
| **offline-sync-v2.js** | 3,079 | オフライン同期システム（v2.0） |
| **offline-sync-v2.css** | 896 | オフライン同期UI |
| **offline-sync.js** | 544 | 旧オフライン同期システム |
| **sw.js** | 201 | Service Worker（v2.3 PWA更新対応版） |
| **index.html** | 399 | 組選択ページ（PWA更新通知機能追加） |
| **index-main.js** | 18 | 組選択ページのメインロジック |
| **timeslot.html** | 392 | 時間帯選択ページ |
| **timeslot-main.js** | 186 | 時間帯選択ページのメインロジック |
| **timeslot-schedules.js** | 93 | 時間帯スケジュール定義 |
| **seats.html** | 431 | 座席選択・予約ページ |
| **seats-main.js** | 1,670 | 座席選択・予約ページのメインロジック |
| **seats.css** | 863 | 座席選択ページ専用スタイル |
| **walkin.html** | 434 | 当日券発行ページ |
| **walkin-main.js** | 453 | 当日券発行ページのメインロジック |
| **walkin.css** | 317 | 当日券ページ専用スタイル |
| **logs.html** | 342 | 操作ログ表示ページ |
| **logs-main.js** | 866 | 操作ログ表示ページのメインロジック |
| **logs.css** | 634 | ログページ専用スタイル |
| **monitoring-dashboard.html** | 2,994 | 強化監視ダッシュボード（詳細モーダル表示・正確な演算システム追加） |
| **sidebar.js** | 355 | サイドバーとモード管理機能 |
| **sidebar.css** | 249 | サイドバー専用スタイル |
| **styles.css** | 302 | 全体共通スタイル |
| **manifest.json** | 83 | PWAマニフェスト |
| **browserconfig.xml** | 9 | ブラウザ設定 |

**合計: 24,035行**（最新計測）

### 🔗 依存関係図（v2.3 最新）
```mermaid
graph TD
    subgraph "最適化層"
        A[optimized-loader.js]
        B[api-cache.js]
        C[optimized-api.js]
        D[ui-optimizer.js]
        E[performance-monitor.js]
    end
    
    subgraph "設定・共通"
        F[config.js]
        G[styles.css]
        EH[error-handler.js]
    end
    
    subgraph "オフライン同期"
        H[offline-sync-v2.js]
        I[offline-sync-v2.css]
        J[sw.js]
    end
    
    subgraph "UI層"
        K[sidebar.js]
        L[sidebar.css]
        PM[pwa-install.js]
    end
    
    subgraph "ページ別JS"
        M[index-main.js]
        N[timeslot-main.js]
        O[seats-main.js]
        P[walkin-main.js]
        QL[logs-main.js]
    end
    
    subgraph "ページ別CSS"
        Q[seats.css]
        R[walkin.css]
        LG[logs.css]
    end
    
    subgraph "ページ別HTML"
        S[index.html]
        T[timeslot.html]
        U[seats.html]
        V[walkin.html]
        W[logs.html]
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> H
    A --> K
    B --> C
    C --> K
    C --> H
    D --> A
    E --> A
    F --> C
    EH --> K
    H --> M
    H --> N
    H --> O
    H --> P
    H --> QL
    K --> M
    K --> N
    K --> O
    K --> P
    K --> QL
    G --> L
    G --> Q
    G --> R
    G --> I
    L --> S
    L --> T
    L --> U
    L --> V
    L --> W
    PM --> S
    PM --> T
    PM --> U
    PM --> V
    I --> S
    I --> T
    I --> U
    I --> V
    M --> S
    N --> T
    O --> U
    P --> V
    QL --> W
    Q --> U
    R --> V
    J -.-> S
    J -.-> T
    J -.-> U
    J -.-> V
    J -.-> W
```

#### バックエンド依存関係
```mermaid
graph TD
    subgraph "Google Apps Script"
        A[Code.gs]
        B[SpreadsheetIds.gs]
        C[TimeSlotConfig.gs]
        D[system-setting.gs]
    end
    
    subgraph "Google Spreadsheet"
        E[座席データ]
        F[ログデータ]
    end
    
    A --> B
    A --> C
    A --> E
    A --> F
    D -.->|独立| D
```

#### システム全体の依存関係（v2.2最適化版）
```mermaid
graph TB
    subgraph "最適化フロントエンド"
        A[OptimizedLoader]
        B[HTML Pages]
        C[CSS Files]
        D[JavaScript Files]
        E[UIOptimizer]
        F[PerformanceMonitor]
    end
    
    subgraph "最適化API層"
        G[APICache]
        H[OptimizedGasAPI]
        I[config.js]
    end
    
    subgraph "Google Apps Script"
        J[Code.gs]
        K[SpreadsheetIds.gs]
        L[TimeSlotConfig.gs]
        M[system-setting.gs]
    end
    
    subgraph "データストア"
        N[Google Spreadsheet]
    end
    
    A --> B
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G
    A --> H
    A --> I
    G --> H
    H --> I
    H --> J
    J --> K
    J --> L
    J --> N
    M -.->|独立| M
```

#### データフロー（v2.2最適化版シーケンス図）
```mermaid
sequenceDiagram
    participant U as ユーザー
    participant OL as OptimizedLoader
    participant AC as APICache
    participant OGA as OptimizedGasAPI
    participant OS as OfflineSyncV2
    participant G as GAS
    participant S as Spreadsheet
    
    U->>OL: ページアクセス
    OL->>OL: 依存関係解析
    OL->>AC: キャッシュ初期化
    OL->>OGA: API初期化
    OL->>OS: オフライン同期開始
    
    U->>OGA: 操作要求
    OGA->>AC: キャッシュチェック
    alt キャッシュヒット
        AC-->>OGA: キャッシュデータ返却
    else キャッシュミス
        OGA->>G: JSONP通信
        G->>S: データ読み書き
        S-->>G: データ返却
        G-->>OGA: レスポンス
        OGA->>AC: キャッシュ保存
    end
    OGA-->>U: 結果表示
    
    Note over OS: バックグラウンド同期（15秒間隔）
    OS->>G: キュー操作送信
    G->>S: データ更新
    S-->>G: 更新完了
    G-->>OS: 同期完了
```

---

## 🚨 トラブルシューティング

### 一般的な問題
- **JSONP タイムアウト**
  - GAS の公開設定が「全員（匿名）」になっているか
  - 最新の /exec を `config.js` に設定（必要に応じて `GAS_API_URLS` に追加）
  - 疎通テスト: `https://<GAS>/exec?callback=cb&func=testApi&params=%5B%5D` を開く前に `function cb(x){console.log(x)}` を定義

- **verifyModePassword の多重呼び出し**
  - 二重送信防止済み。古いキャッシュならハードリロード

- **Walk-in の二重発行**
  - 再入防止済み。最新に更新して再試行

### 最高管理者モード特有の問題
- **座席編集できない**
  - `SUPERADMIN_PASSWORD` が正しく設定されているか確認
  - `system-setting.gs` の `checkPasswords()` で確認
  - スプレッドシートの権限設定を確認

- **編集モーダルが表示されない**
  - 最高管理者モードに正しくログインしているか確認
  - ブラウザのコンソールでエラーメッセージを確認

### GAS疎通テスト
- サイドバーの「GAS疎通テスト」ボタンを使用
- 詳細なエラー情報を確認
- 必要に応じて新しいデプロイURLを取得

---

## 📚 使用例

### 最高管理者モードの使用例

#### 1. パスワード設定
```javascript
// GASエディタで実行
setupSuperAdminPassword(); // デフォルト: superadmin
// または
changeSuperAdminPassword('mySecurePassword'); // カスタムパスワード
```

#### 2. 座席データ編集
1. サイドバーから「モード変更」を選択
2. 「最高管理者モード」を選択し、パスワードを入力
3. 任意の座席をクリック
4. C、D、E列の内容を編集
5. 「確定」ボタンを押す
6. 確認ダイアログで「はい」を選択
7. スプレッドシートが更新される

#### 3. 編集可能な列
- **C列**: ステータス（空、確保、予約済など）
- **D列**: 予約名や備考
- **E列**: チェックイン状態やその他の情報

### 操作方法（補足）

#### サイドバー操作
- 画面左上のメニューで開閉
- 開いている間は背景が暗転
- 外側クリックまたは「×」で閉じる

#### モード変更
- サイドバー内「モード変更」
- 処理中はボタン/入力が無効化されます
- パスワード認証が必要

#### 当日券発行
- ± ボタンで枚数調整（1〜6）
- 処理中は二重実行されません

#### 最高管理者モード
- 任意の座席をクリックして編集モーダルを開く
- C、D、E列の内容を編集して確定
- 確認ダイアログで「はい」を選択
- スプレッドシートが更新される

---

## 🔮 今後の拡張予定

### 機能拡張
- リアルタイム座席状況の表示
- 予約履歴の管理
- 統計・レポート機能

### 技術的改善
- WebSocket対応
- リアルタイム通信
- パフォーマンス最適化

### セキュリティ強化
- 多要素認証
- 監査ログ
- 暗号化通信

---

## 📞 サポート・フィードバック

### 問題報告
- GitHub Issues で問題を報告
- 詳細なエラーログと再現手順を記載

### 機能要望
- 新機能の提案は GitHub Discussions で
- ユースケースと期待する動作を記載

### ドキュメント改善
- READMEの改善提案も歓迎
- 分かりにくい部分の指摘

---

## 📄 ライセンス
- リポジトリの `LICENSE` を参照

## 🤝 コントリビューション
- プルリクエストを歓迎
- コーディング規約に従ってください
- テストの追加も推奨
---

## ✅ 最新の変更点（v2.3 強化監視システム）

### 主要な新機能

#### 1. 強化座席監視システム（v2.3）
- **見本演劇除外**: テスト用公演をメール通知対象から自動除外
- **フィルタリング機能**: 監視対象の公演を自動的にフィルタリング
- **リアルタイム監視**: 15秒間隔で全公演の座席状況を監視
- **インテリジェント通知**: 容量レベル別の優先度通知システム
- **監視ダッシュボード**: リアルタイム表示と統計情報
- **詳細モーダル表示**: 各公演カードをクリックで詳細な座席分析データを表示
- **正確な演算システム**: 予約済み座席とチェックイン済み座席の正確な計算

#### 2. PWA更新通知システム（v2.3）
- **自動更新検知**: Service Workerが新しいデプロイを自動検知
- **美しい通知UI**: グラデーション背景のモダンな更新通知
- **ワンクリック更新**: 「今すぐ更新」ボタンで即座に最新版に更新
- **定期チェック**: 5分間隔での自動更新チェック
- **監査ログ**: 更新通知の表示・適用・却下を詳細記録
- **エラーハンドリング**: 更新失敗時の適切なエラー表示

#### 3. Service Worker最適化（v2.3）
- **更新検知機能**: 新しいService Workerの検知と通知
- **メッセージ通信**: クライアントとService Worker間の双方向通信
- **バージョン管理**: キャッシュバージョンの自動管理

#### 3. パフォーマンス最適化システム（v2.2）
- **OptimizedLoader**: 依存関係を考慮した並列モジュール読み込み
- **APICache**: インテリジェントキャッシュシステム
- **OptimizedGasAPI**: キャッシュ対応のAPI呼び出し
- **UIOptimizer**: イベント処理とレンダリングの最適化
- **PerformanceMonitor**: リアルタイムパフォーマンス監視

#### 4. Service Worker最適化（v2.2）
- **段階的キャッシュ**: クリティカルアセット（6個）を優先キャッシュ
- **バックグラウンドキャッシュ**: セカンダリアセット（20個）を段階的キャッシュ
- **メモリ圧迫防止**: バッチサイズ3個、バッチ間100ms待機
- **iOS対応**: メモリ制限に対応した最適化

#### 5. オフライン同期最適化
- **同期間隔延長**: 10秒→15秒（パフォーマンス向上）
- **メモリクリーンアップ**: 1分→30秒間隔（頻度向上）
- **キューサイズ削減**: 500→200件（メモリ節約）
- **接続チェック最適化**: 10秒→15秒間隔

#### 6. URL管理システム（v2.1）
- **複数API URL対応**: 使用数上限回避のための分散処理
- **自動ローテーション**: 5分間隔でのURL自動切り替え
- **ランダム選択**: 手動更新時の確実なURL変更
- **フェイルオーバー**: API呼び出し失敗時の自動切り替え
- **アニメーション通知**: URL変更時の視覚的フィードバック

#### 7. 完全オフライン動作（v2.0）
- **ローカル処理**: オフライン時でもキャッシュされた座席データで全操作が可能
- **当日券オフライン発行**: オフライン時でも当日券を発行・座席番号を表示
- **自動同期**: オンライン復帰時に操作を自動でサーバーに反映
- **同期頻度**: バックグラウンド同期 15秒、当日券空席プル 25秒

#### 8. キャッシュ管理の強化
- **重複排除**: API呼び出しの重複を防止
- **TTL管理**: 適切なキャッシュ有効期限設定
- **メモリ最適化**: 自動クリーンアップとサイズ制限
- **デバッグ機能**: キャッシュ状況の詳細確認

### 技術的な改善

#### 1. 見本演劇除外機能の実装
- **フィルタリングロジック**: `getAbnormalTimeslots()`関数で見本演劇を除外
- **通知システム統合**: `enhanced-status-monitor.js`の`shouldNotify()`関数で除外
- **一貫性確保**: 監視ダッシュボードと監視システムの両方で除外
- **デバッグ機能**: 除外対象の確認とログ出力

#### 1.5. 詳細モーダル表示機能の実装
- **モーダルUI**: 美しいモーダルデザインで詳細データを表示
- **座席データ分析**: 予約済み座席とチェックイン済み座席の正確な計算
- **データ整合性チェック**: ダッシュボードデータと詳細分析の整合性確認
- **エラー検証**: データ検証エラーと警告の詳細表示
- **API統合**: `getSeatData`エンドポイントとの連携
- **フォールバック機能**: API失敗時の推定データ生成

#### 2. パフォーマンス最適化の実装
- **依存関係管理**: モジュール間の依存関係を正しく管理
- **並列読み込み**: 非依存モジュールの並列処理
- **段階的初期化**: クリティカル→セカンダリ→その他の順序
- **メモリ監視**: リアルタイムメモリ使用量監視

#### 3. アーキテクチャの最適化
- **OptimizedLoader**: モジュール読み込みの一元管理
- **APICache**: キャッシュシステムの統合
- **UIOptimizer**: UI応答性の向上
- **PerformanceMonitor**: パフォーマンスメトリクスの収集

#### 3. パフォーマンス向上の成果
- **初期読み込み**: 約40%短縮
- **スクリプト読み込み**: 約50%短縮
- **Service Worker**: 約60%短縮
- **API呼び出し**: 約60%削減
- **メモリ使用量**: 約30%削減
- **UI応答性**: 約50%向上

#### 4. ユーザビリティの向上
- **パフォーマンス監視**: `Ctrl + Shift + P`でダッシュボード表示
- **キャッシュ管理**: リアルタイムキャッシュ統計
- **メトリクス確認**: 詳細なパフォーマンスデータ
- **URL管理**: 現在のAPI URL情報表示

---

## ⚡ システム最適化（v2.2）

### 最適化の成果
- **初期読み込み時間**: 約40%短縮（クリティカルアセット優先読み込み）
- **スクリプト読み込み**: 約50%短縮（依存関係の最適化）
- **Service Worker**: 約60%短縮（段階的キャッシュ）
- **API呼び出し**: 重複排除により約60%削減
- **メモリ使用量**: 約30%削減（キューサイズ削減、頻繁なクリーンアップ）
- **UI応答性**: 約50%向上（イベント処理最適化）

### 最適化されたアーキテクチャ
```mermaid
graph TB
  subgraph "最適化された読み込み層"
    A[OptimizedLoader] --> B[依存関係管理]
    B --> C[段階的読み込み]
    C --> D[並列処理]
  end
  
  subgraph "キャッシュ層"
    E[APICache] --> F[重複排除]
    F --> G[TTL管理]
    G --> H[メモリ最適化]
  end
  
  subgraph "通信層"
    I[OptimizedGasAPI] --> J[URL管理]
    J --> K[フェイルオーバー]
    K --> L[オフライン委譲]
  end
  
  subgraph "UI層"
    M[UIOptimizer] --> N[イベント最適化]
    N --> O[レンダリング最適化]
    O --> P[メモリ監視]
  end
  
  A --> E
  E --> I
  I --> M
```

### 最適化されたコンポーネント
1. **OptimizedLoader** (`optimized-loader.js`) - 依存関係を考慮した並列モジュール読み込み
2. **APICache** (`api-cache.js`) - インテリジェントキャッシュシステム
3. **OptimizedGasAPI** (`optimized-api.js`) - キャッシュ対応のAPI呼び出し
4. **UIOptimizer** (`ui-optimizer.js`) - イベント処理の最適化
5. **PerformanceMonitor** (`performance-monitor.js`) - リアルタイムパフォーマンス監視

### Service Worker最適化
- **クリティカルアセット**: 6個の最重要ファイルを優先キャッシュ
- **セカンダリアセット**: 20個のファイルをバックグラウンドで段階的キャッシュ
- **バッチサイズ**: 3個ずつ処理（iOS対応）
- **メモリ圧迫防止**: バッチ間で100ms待機

### オフライン同期最適化
- **同期間隔**: 15秒（10秒から延長）
- **バックグラウンド同期**: 15秒（10秒から延長）
- **メモリクリーンアップ**: 30秒間隔（1分から短縮）
- **キューサイズ**: 200件（500件から削減）
- **接続チェック**: 15秒間隔（10秒から延長）

### 使用方法
- **パフォーマンス監視ダッシュボード**: `Ctrl + Shift + P`
- **キャッシュ管理**: `window.apiCache.getStats()`
- **メトリクス確認**: `window.performanceMonitor.getMetrics()`
- **URL管理**: `window.GasAPI.getUrlManagerInfo()`

---

## 👨‍💼 管理者モード完全操作ガイド

### 管理者モードの種類
1. **最高管理者モード (Super Admin)** - 全機能アクセス + システム設定変更
2. **一般管理者モード (Admin)** - 基本管理機能 + 限定された設定変更

### 主要機能
- 座席データの管理と編集
- 当日券の割り当てと管理
- オフライン同期システムの管理
- 競合解決と通知システム
- パフォーマンス最適化
- セキュリティとバックアップ

### アクセス方法
```javascript
// URLパラメータ方式（推奨）
https://your-domain.com/index.html?mode=superadmin&password=YOUR_SUPERADMIN_PASSWORD

// ローカルストレージ方式（デバッグ用途）
localStorage.setItem('admin_mode', 'superadmin');
localStorage.setItem('admin_password', 'your-superadmin-password');
location.reload();
```

### 基本操作
- 座席データの取得・予約・チェックイン
- 当日券の割り当てと管理
- データの確認と検索

---

## 🌐 API URL分散設定ガイド

### 概要
API通信の使用数上限を回避するため、複数のGoogle Apps Script URLを分散して使用する機能。

### 機能
- **ランダム選択**: ページ読み込み時にランダムにURLを選択
- **定期ローテーション**: 5分間隔でURLを自動切り替え
- **フェイルオーバー**: エラー時に次のURLに自動切り替え
- **手動切り替え**: コンソールから手動でURLを変更可能

### 設定方法
```javascript
// config.js
const GAS_API_URLS = [
  "https://script.google.com/macros/s/MAIN_DEPLOY_ID/exec",
  "https://script.google.com/macros/s/BACKUP_DEPLOY_ID/exec",
  "https://script.google.com/macros/s/THIRD_DEPLOY_ID/exec"
];
```

### 使用方法
```javascript
// 現在のURL情報を確認
SeatApp.urlInfo()

// ランダムにURLを選択
SeatApp.selectRandomUrl()

// 利用可能なURL一覧を表示
SeatApp.getAllUrls()
```

### 監視機能
- 画面右上に現在のURL番号を表示（例：API URL: 2/4）
- 更新ボタンで手動でURL情報を更新可能
- コンソールログで詳細な動作を確認

