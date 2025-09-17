# 強化座席監視システム - Enhanced Status Monitoring System

## 概要

このシステムは、各スプレッドシートのステータスデータを頻繁に取得し、ステータス「空」の数を解析して、その結果から満席メールを送信するかを判断・実行する強化された監視システムです。

## 主な機能

### 1. リアルタイム監視
- **頻繁なチェック**: デフォルト15秒間隔で全公演の座席状況を監視
- **状態変化検知**: 前回の状態と比較して変化を検出
- **容量レベル判定**: 正常・警告・緊急・満席の4段階で分類

### 2. インテリジェント通知システム
- **優先度別通知**: 高・中・低の3段階で通知優先度を設定
- **重複防止**: クールダウン機能で同じ公演への重複通知を防止
- **詳細レポート**: 統計情報とトレンド分析を含む包括的なメール通知

### 3. パフォーマンス最適化
- **APIキャッシュ**: 頻繁なAPI呼び出しを最適化
- **並列処理**: 複数のリクエストを同時実行
- **リトライ機能**: 失敗時の自動リトライ

### 4. 監視ダッシュボード
- **リアルタイム表示**: 現在の座席状況を視覚的に表示
- **統計情報**: システムの動作状況とパフォーマンス指標
- **設定管理**: 監視間隔や閾値の動的変更

## ファイル構成

### フロントエンド
- `enhanced-status-monitor.js` - メイン監視システム
- `api-cache.js` - API呼び出し最適化・キャッシュシステム
- `monitoring-dashboard.html` - 監視ダッシュボードUI
- `config.js` - 設定ファイル（更新済み）

### バックエンド（Google Apps Script）
- `Code.gs` - メインAPI処理（更新済み）
- `SpreadsheetIds.gs` - スプレッドシートID管理
- `TimeSlotConfig.gs` - 時間帯設定

## 設定

### 監視設定
```javascript
const ENHANCED_MONITORING_CONFIG = {
  defaultCheckInterval: 15000,        // チェック間隔（ミリ秒）
  defaultWarningThreshold: 5,         // 警告閾値（席数）
  defaultCriticalThreshold: 2,        // 緊急閾値（席数）
  defaultNotificationCooldown: 300000, // 通知クールダウン（ミリ秒）
  maxConcurrentChecks: 5,             // 同時チェック数上限
  cacheTimeout: 30000,                // キャッシュタイムアウト（ミリ秒）
  retryAttempts: 3,                   // リトライ回数
  retryDelay: 1000                    // リトライ間隔（ミリ秒）
};
```

### メール通知設定
```javascript
const FULL_CAPACITY_NOTIFICATION_EMAILS = [
  'jxjin2010@gmail.com',
  'jxjin.ig.school@gmail.com',
  'nzn.engeki5@gmail.com'
];
```

## 使用方法

### 1. 基本的な監視開始
```javascript
import enhancedStatusMonitor from './enhanced-status-monitor.js';

// 監視開始
enhancedStatusMonitor.start();

// 監視停止
enhancedStatusMonitor.stop();
```

### 2. 設定の変更
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

### 3. 統計情報の取得
```javascript
const stats = enhancedStatusMonitor.getStatistics();
console.log('総チェック回数:', stats.totalChecks);
console.log('総通知回数:', stats.totalNotifications);
console.log('平均空席数:', stats.averageEmptySeats);
console.log('パフォーマンス統計:', stats.performanceStats);
```

### 4. 手動チェック
```javascript
// 手動でステータスチェックを実行
await enhancedStatusMonitor.manualCheck();
```

## 監視ダッシュボード

`monitoring-dashboard.html`を開くことで、以下の機能を利用できます：

### リアルタイム表示
- 各公演の現在の座席状況
- 容量レベル別の公演数
- システム統計情報

### 監視制御
- 監視の開始・停止
- 設定の動的変更
- 手動チェック実行

### 通知履歴
- 過去の通知履歴表示
- 通知履歴のクリア

## API仕様

### 新しいAPIエンドポイント

#### `getDetailedCapacityAnalysis(group, day, timeslot)`
詳細な容量分析を取得
- **パラメータ**: 
  - `group` (optional): 組名でフィルタ
  - `day` (optional): 日でフィルタ  
  - `timeslot` (optional): 時間帯でフィルタ
- **戻り値**: 容量分析結果と統計情報

#### `sendStatusNotificationEmail(emailData)`
強化されたステータス通知メールを送信
- **パラメータ**: 
  - `emailData`: メール送信データ（通知、統計、タイムスタンプ）
- **戻り値**: 送信結果

#### `getCapacityStatistics()`
容量統計を取得
- **戻り値**: システム統計とパフォーマンス情報

## 容量レベル

| レベル | 条件 | 色 | 説明 |
|--------|------|-----|------|
| 正常 | 6席以上 | 緑 | 十分な空席がある |
| 警告 | 3-5席 | 黄 | 空席が少なくなってきた |
| 緊急 | 1-2席 | オレンジ | 空席が非常に少ない |
| 満席 | 0席 | 赤 | 空席がない |

## 通知優先度

| 優先度 | 条件 | 説明 |
|--------|------|------|
| 高 | 満席になった | 即座に通知が必要 |
| 中 | 緊急レベルに変化 | 注意が必要 |
| 低 | 警告レベルに変化 | 参考情報 |

## パフォーマンス最適化

### APIキャッシュ
- 30秒間のキャッシュで重複リクエストを削減
- 自動的なキャッシュクリーンアップ
- キャッシュヒット率の統計

### 並列処理
- 最大5つの同時リクエスト
- リクエストキューによる負荷制御
- 自動リトライ機能

### リソース管理
- メモリ使用量の最適化
- 不要なデータの自動削除
- パフォーマンス統計の提供

## トラブルシューティング

### よくある問題

1. **監視が開始されない**
   - ブラウザのコンソールでエラーを確認
   - API接続をテスト
   - 設定値を確認

2. **通知が送信されない**
   - メールアドレス設定を確認
   - 通知設定が有効か確認
   - クールダウン期間を確認

3. **パフォーマンスが遅い**
   - キャッシュ統計を確認
   - 同時リクエスト数を調整
   - チェック間隔を調整

### デバッグ

```javascript
// デバッグモードを有効化
window.DEBUG_MODE = true;

// 統計情報を確認
console.log(enhancedStatusMonitor.getStatistics());

// キャッシュ統計を確認
console.log(apiCache.getCacheStats());
```

## 今後の拡張予定

- [ ] 機械学習による予測機能
- [ ] より詳細な分析レポート
- [ ] モバイルアプリ対応
- [ ] 複数言語対応
- [ ] カスタム通知ルール

## ライセンス

このプロジェクトは既存の座席管理システムの一部として提供されています。
