// ===============================================================
// オフライン同期システム - 再設計版
// ===============================================================

// 定数定義
const OFFLINE_FEATURE_ENABLED = true;
const SYNC_INTERVAL_MS = 30000; // 30秒
const MAX_RETRY_COUNT = 3;
const RETRY_DELAY_MS = 5000; // 5秒

// ストレージキー
const QUEUE_KEY = 'offlineQueue';
const CACHE_KEY_PREFIX = 'seatCache_';
const META_KEY = 'offlineMeta';
const BACKGROUND_SYNC_URL_KEY = 'backgroundSyncUrl';

// オフライン状態管理クラス
class OfflineStateManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.retryCount = 0;
    this.lastSyncAttempt = 0;
    this.syncErrors = [];
    
    this.initializeEventListeners();
  }

  // イベントリスナーの初期化
  initializeEventListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // 定期的な状態チェック
    setInterval(() => this.checkConnectionStatus(), 10000);
  }

  // オンライン状態の処理
  async handleOnline() {
    if (this.isOnline) return; // 既にオンライン
    
    console.log('[状態管理] オンライン復帰を検知');
    this.isOnline = true;
    this.retryCount = 0;
    
    // オフライン操作の同期を開始
    await this.syncOfflineOperations();
  }

  // オフライン状態の処理
  async handleOffline() {
    if (!this.isOnline) return; // 既にオフライン
    
    console.log('[状態管理] オフライン状態を検知');
    this.isOnline = false;
    this.syncInProgress = false;
    
    // オフライン操作モードに切り替え
    await this.installOfflineOverrides();
  }

  // 接続状態のチェック
  checkConnectionStatus() {
    const currentOnline = navigator.onLine;
    if (currentOnline !== this.isOnline) {
      if (currentOnline) {
        this.handleOnline();
      } else {
        this.handleOffline();
      }
    }
  }

  // オフライン操作の同期
  async syncOfflineOperations() {
    if (this.syncInProgress) {
      console.log('[状態管理] 同期が既に進行中です');
      return;
    }

    const queue = this.readQueue();
    if (queue.length === 0) {
      console.log('[状態管理] 同期するオフライン操作がありません');
      return;
    }

    console.log(`[状態管理] ${queue.length}件のオフライン操作を同期開始`);
    this.syncInProgress = true;
    this.showSyncModal();

    try {
      const result = await this.processQueue(queue);
      console.log('[状態管理] 同期完了:', result);
      
      // 成功した操作をキューから削除
      this.writeQueue(result.remaining);
      
      // キャッシュを更新
      await this.refreshCache();
      
    } catch (error) {
      console.error('[状態管理] 同期エラー:', error);
      this.handleSyncError(error);
    } finally {
      this.syncInProgress = false;
      this.hideSyncModal();
    }
  }

  // キューの処理
  async processQueue(queue) {
    const remaining = [];
    const processed = [];
    const errors = [];

    for (const item of queue) {
      try {
        console.log(`[状態管理] 処理中: ${item.type}`, item.args);
        
        const result = await this.executeOperation(item);
        if (result.success) {
          processed.push({ ...item, result });
          console.log(`[状態管理] 成功: ${item.type}`);
        } else {
          remaining.push(item);
          console.log(`[状態管理] 失敗: ${item.type} - ${result.error}`);
        }
      } catch (error) {
        console.error(`[状態管理] エラー: ${item.type}`, error);
        errors.push({ ...item, error: error.message });
        remaining.push(item);
      }
    }

    return {
      processed,
      remaining,
      errors,
      successCount: processed.length,
      errorCount: errors.length
    };
  }

  // 個別操作の実行
  async executeOperation(item) {
    const { type, args } = item;
    
    try {
      const gasAPI = await waitForGasAPI();
      
      switch (type) {
        case 'reserveSeats':
          return await gasAPI.reserveSeats(...args);
        case 'checkInMultipleSeats':
          return await gasAPI.checkInMultipleSeats(...args);
        case 'updateSeatData':
          return await gasAPI.updateSeatData(...args);
        default:
          return { success: false, error: `未知の操作タイプ: ${type}` };
      }
    } catch (error) {
      console.error(`[状態管理] 操作実行エラー: ${type}`, error);
      return { success: false, error: error.message };
    }
  }

  // キャッシュの更新
  async refreshCache() {
    try {
      const params = new URLSearchParams(window.location.search);
      const group = params.get('group');
      const day = params.get('day');
      const timeslot = params.get('timeslot');
      
      if (group && day && timeslot) {
        console.log('[状態管理] キャッシュを更新中...');
        const gasAPI = await waitForGasAPI();
        const freshData = await gasAPI.getSeatDataMinimal(group, day, timeslot, false);
        
        if (freshData && freshData.success) {
          this.writeCache(group, day, timeslot, freshData);
          console.log('[状態管理] キャッシュ更新完了');
        }
      }
    } catch (error) {
      console.error('[状態管理] キャッシュ更新エラー:', error);
    }
  }

  // エラーハンドリング
  handleSyncError(error) {
    this.syncErrors.push({
      timestamp: Date.now(),
      error: error.message,
      retryCount: this.retryCount
    });

    if (this.retryCount < MAX_RETRY_COUNT) {
      this.retryCount++;
      console.log(`[状態管理] リトライ ${this.retryCount}/${MAX_RETRY_COUNT} を ${RETRY_DELAY_MS}ms後に実行`);
      
      setTimeout(() => {
        this.syncOfflineOperations();
      }, RETRY_DELAY_MS);
    } else {
      console.error('[状態管理] 最大リトライ回数に達しました');
      this.notifySyncFailure();
    }
  }

  // 同期失敗の通知
  notifySyncFailure() {
    // ユーザーに同期失敗を通知
    const notification = document.createElement('div');
    notification.className = 'sync-failure-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <h4>同期エラー</h4>
        <p>オフライン操作の同期に失敗しました。手動で同期を試してください。</p>
        <button onclick="OfflineSync.retrySync()">再試行</button>
        <button onclick="this.parentElement.parentElement.remove()">閉じる</button>
      </div>
    `;
    
    document.body.appendChild(notification);
  }

  // オフライン操作の追加
  addOfflineOperation(operation) {
    const queue = this.readQueue();
    const operationWithMeta = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
      retryCount: 0
    };
    
    queue.push(operationWithMeta);
    this.writeQueue(queue);
    
    console.log(`[状態管理] オフライン操作を追加: ${operation.type}`, operationWithMeta);
    
    // オフライン操作をコンソールに出力
    this.logOfflineOperation(operationWithMeta);
  }

  // 操作IDの生成
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // オフライン操作のログ出力
  logOfflineOperation(operation) {
    const timestamp = new Date().toLocaleString('ja-JP');
    console.log(`[オフライン操作] ${timestamp}`, {
      id: operation.id,
      type: operation.type,
      args: operation.args,
      precondition: operation.pre,
      queueLength: this.readQueue().length
    });
  }

  // オフラインオーバーライドのインストール
  async installOfflineOverrides() {
    if (!OFFLINE_FEATURE_ENABLED) return;
    
    try {
      const gasAPI = await waitForGasAPI();
      if (!gasAPI) return;
      
      console.log('[状態管理] オフライン操作モードに切り替え');
      
      // GasAPIのメソッドをオフライン対応にオーバーライド
      const originalReserveSeats = gasAPI.reserveSeats;
      const originalCheckInMultipleSeats = gasAPI.checkInMultipleSeats;
      const originalUpdateSeatData = gasAPI.updateSeatData;

      // 予約のオフライン対応
      gasAPI.reserveSeats = async (...args) => {
        if (this.isOnline) {
          try {
            return await originalReserveSeats(...args);
          } catch (error) {
            console.log('[状態管理] オンライン予約失敗、オフライン操作として処理');
            this.addOfflineOperation({ type: 'reserveSeats', args });
            return { success: true, message: 'オフラインで予約を受け付けました', offline: true };
          }
        } else {
          this.addOfflineOperation({ type: 'reserveSeats', args });
          return { success: true, message: 'オフラインで予約を受け付けました', offline: true };
        }
      };

      // チェックインのオフライン対応
      gasAPI.checkInMultipleSeats = async (...args) => {
        if (this.isOnline) {
          try {
            return await originalCheckInMultipleSeats(...args);
          } catch (error) {
            console.log('[状態管理] オンラインチェックイン失敗、オフライン操作として処理');
            this.addOfflineOperation({ type: 'checkInMultipleSeats', args });
            return { success: true, message: 'オフラインでチェックインを受け付けました', offline: true };
          }
        } else {
          this.addOfflineOperation({ type: 'checkInMultipleSeats', args });
          return { success: true, message: 'オフラインでチェックインを受け付けました', offline: true };
        }
      };

      // 座席データ更新のオフライン対応
      gasAPI.updateSeatData = async (...args) => {
        if (this.isOnline) {
          try {
            return await originalUpdateSeatData(...args);
          } catch (error) {
            console.log('[状態管理] オンライン更新失敗、オフライン操作として処理');
            this.addOfflineOperation({ type: 'updateSeatData', args });
            return { success: true, message: 'オフラインで更新を受け付けました', offline: true };
          }
        } else {
          this.addOfflineOperation({ type: 'updateSeatData', args });
          return { success: true, message: 'オフラインで更新を受け付けました', offline: true };
        }
      };
    } catch (error) {
      console.error('[状態管理] オフラインオーバーライドのインストールに失敗:', error);
    }
  }

  // 同期モーダルの表示
  showSyncModal() {
    try {
      const existing = document.getElementById('sync-modal');
      if (existing) existing.remove();

      const modalHTML = `
        <div id="sync-modal" class="modal" style="display: block; z-index: 10000;">
          <div class="modal-content" style="text-align: center; max-width: 400px;">
            <div class="spinner"></div>
            <h3>オフライン操作を同期中...</h3>
            <p>しばらくお待ちください。操作はできません。</p>
            <div class="sync-progress">
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      console.log('[状態管理] 同期モーダルを表示');
    } catch (error) {
      console.error('[状態管理] モーダル表示エラー:', error);
    }
  }

  // 同期モーダルの非表示
  hideSyncModal() {
    try {
      const modal = document.getElementById('sync-modal');
      if (modal) {
        modal.remove();
        console.log('[状態管理] 同期モーダルを非表示');
      }
    } catch (error) {
      console.error('[状態管理] モーダル非表示エラー:', error);
    }
  }

  // キューの読み取り
  readQueue() {
    try {
      const data = localStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[状態管理] キュー読み取りエラー:', error);
      return [];
    }
  }

  // キューの書き込み
  writeQueue(queue) {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('[状態管理] キュー書き込みエラー:', error);
    }
  }

  // キャッシュの読み取り
  readCache(group, day, timeslot) {
    try {
      const key = `${CACHE_KEY_PREFIX}${group}-${day}-${timeslot}`;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[状態管理] キャッシュ読み取りエラー:', error);
      return null;
    }
  }

  // キャッシュの書き込み
  writeCache(group, day, timeslot, data) {
    try {
      const key = `${CACHE_KEY_PREFIX}${group}-${day}-${timeslot}`;
      const cacheData = {
        ...data,
        cachedAt: Date.now(),
        version: '2.0' // 新しいバージョン番号
      };
      localStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('[状態管理] キャッシュ書き込みエラー:', error);
    }
  }

  // システムの初期化
  initialize() {
    console.log('[状態管理] オフラインシステムを初期化中...');
    
    // 初回: 現在ページの座席が未キャッシュなら最低限の雛形を用意
    try {
      const { group, day, timeslot } = this.readContext();
      if (group && day && timeslot && !this.readCache(group, day, timeslot)) {
        this.writeCache(group, day, timeslot, { seatMap: {} });
      }
    } catch (error) {
      console.error('[状態管理] 初期化エラー:', error);
    }

    // オフライン状態の確認
    if (!this.isOnline) {
      this.handleOffline();
    }

    console.log('[状態管理] 初期化完了');
  }

  // コンテキストの読み取り
  readContext() {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        group: params.get('group'),
        day: params.get('day'),
        timeslot: params.get('timeslot')
      };
    } catch (error) {
      console.error('[状態管理] コンテキスト読み取りエラー:', error);
      return {};
    }
  }

  // システムの状態を取得
  getSystemStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      retryCount: this.retryCount,
      lastSyncAttempt: this.lastSyncAttempt,
      syncErrors: this.syncErrors,
      queueLength: this.readQueue().length,
      cacheInfo: this.getCacheInfo()
    };
  }

  // キャッシュ情報の取得
  getCacheInfo() {
    const { group, day, timeslot } = this.readContext();
    if (group && day && timeslot) {
      const cache = this.readCache(group, day, timeslot);
      return {
        exists: !!cache,
        cachedAt: cache ? cache.cachedAt : null,
        version: cache ? cache.version : null,
        seatCount: cache && cache.seatMap ? Object.keys(cache.seatMap).length : 0
      };
    }
    return null;
  }
}

// グローバルインスタンスの作成
const offlineStateManager = new OfflineStateManager();

// GasAPIが利用可能になるまで待機する関数
function waitForGasAPI() {
  return new Promise((resolve) => {
    const checkAPI = () => {
      if (window.GasAPI) {
        resolve(window.GasAPI);
      } else {
        setTimeout(checkAPI, 100);
      }
    };
    checkAPI();
  });
}

// グローバル関数（設定用）
window.OfflineSync = {
  // 状態管理
  getStatus: () => offlineStateManager.getSystemStatus(),
  
  // 同期制御
  sync: () => offlineStateManager.syncOfflineOperations(),
  retrySync: () => offlineStateManager.syncOfflineOperations(),
  
  // キュー管理
  getQueue: () => offlineStateManager.readQueue(),
  clearQueue: () => offlineStateManager.writeQueue([]),
  
  // キャッシュ管理
  getCache: () => offlineStateManager.getCacheInfo(),
  clearCache: () => {
    const { group, day, timeslot } = offlineStateManager.readContext();
    if (group && day && timeslot) {
      localStorage.removeItem(`${CACHE_KEY_PREFIX}${group}-${day}-${timeslot}`);
      console.log('[OfflineSync] キャッシュをクリアしました');
    }
  },
  
  // デバッグ機能
  debug: async () => {
    console.log('[OfflineSync] システム状態:', offlineStateManager.getSystemStatus());
    
    // GAS接続テスト
    try {
      const gasAPI = await waitForGasAPI();
      const testResult = await gasAPI.testApi();
      console.log('[OfflineSync] GAS接続テスト:', testResult);
    } catch (error) {
      console.error('[OfflineSync] GAS接続テスト失敗:', error);
    }
    
    // 現在の座席データを取得
    try {
      const gasAPI = await waitForGasAPI();
      const { group, day, timeslot } = offlineStateManager.readContext();
      if (group && day && timeslot) {
        const seatData = await gasAPI.getSeatDataMinimal(group, day, timeslot, false);
        console.log('[OfflineSync] 現在の座席データ:', seatData);
      }
    } catch (error) {
      console.error('[OfflineSync] 座席データ取得失敗:', error);
    }
  }
};

// システムの初期化
document.addEventListener('DOMContentLoaded', () => {
  offlineStateManager.initialize();
});

// 既存の関数との互換性を保つ
function isOffline() { return !offlineStateManager.isOnline; }
async function onOnline() { await offlineStateManager.handleOnline(); }
async function onOffline() { await offlineStateManager.handleOffline(); }
async function flushQueue() { await offlineStateManager.syncOfflineOperations(); }
function showSyncModal() { offlineStateManager.showSyncModal(); }
function hideSyncModal() { offlineStateManager.hideSyncModal(); }
function readQueue() { return offlineStateManager.readQueue(); }
function writeQueue(queue) { offlineStateManager.writeQueue(queue); }
function readCache(group, day, timeslot) { return offlineStateManager.readCache(group, day, timeslot); }
function writeCache(group, day, timeslot, data) { offlineStateManager.writeCache(group, day, timeslot, data); }
function enqueue(operation) { offlineStateManager.addOfflineOperation(operation); }
async function installOfflineOverrides() { await offlineStateManager.installOfflineOverrides(); }


