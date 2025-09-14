// ===============================================================
// オフライン同期システム v2.0 - 完全再設計版
// ===============================================================

// 定数定義
const OFFLINE_CONFIG = {
  ENABLED: true,
  SYNC_INTERVAL_MS: 15000, // 15秒に延長（パフォーマンス向上）
  MAX_RETRY_COUNT: 2, // iOSではリトライ回数をさらに減らす
  RETRY_DELAY_MS: 5000, // リトライ間隔を延長
  MAX_QUEUE_SIZE: 200, // iOSメモリ制限に対応（さらに削減）
  SYNC_TIMEOUT_MS: 25000, // 同期タイムアウトを25秒に延長
  BACKGROUND_SYNC_INTERVAL: 15000, // バックグラウンド同期間隔を15秒に延長
  CACHE_EXPIRY_MS: 300000, // 5分に延長（iOSメモリ節約）
  BATCH_SIZE: 2, // iOS用バッチサイズ（さらに削減）
  MEMORY_CLEANUP_INTERVAL: 30000 // 30秒ごとにメモリクリーンアップ（頻度向上）
};

// ストレージキー
const STORAGE_KEYS = {
  OPERATION_QUEUE: 'offlineOperationQueue_v2',
  OPERATION_LOG: 'offlineOperationLog_v2',
  CACHE_DATA: 'offlineCacheData_v2',
  SYNC_STATE: 'offlineSyncState_v2',
  CONFLICT_RESOLUTION: 'offlineConflictResolution_v2'
};

// 操作タイプ定義
const OPERATION_TYPES = {
  RESERVE_SEATS: 'reserveSeats',
  CHECK_IN_SEATS: 'checkInMultipleSeats',
  UPDATE_SEAT_DATA: 'updateSeatData',
  ASSIGN_WALKIN: 'assignWalkInSeats',
  ASSIGN_WALKIN_CONSECUTIVE: 'assignWalkInConsecutiveSeats'
};

// 操作の優先度
const OPERATION_PRIORITY = {
  [OPERATION_TYPES.RESERVE_SEATS]: 1, // 最高優先度
  [OPERATION_TYPES.CHECK_IN_SEATS]: 2,
  [OPERATION_TYPES.UPDATE_SEAT_DATA]: 3,
  [OPERATION_TYPES.ASSIGN_WALKIN]: 4,
  [OPERATION_TYPES.ASSIGN_WALKIN_CONSECUTIVE]: 4
};

/**
 * オフライン操作管理クラス
 */
class OfflineOperationManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.syncState = this.loadSyncState();
    this.backgroundSyncInterval = null;
    this.retryTimeout = null;
    this.operationCounter = 0;
    this.instanceId = `inst_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.lockKey = 'offline_sync_lock_v2';
    this.lockTtlMs = 30000; // 30秒に短縮（iOS対応）
    this.bc = null;
    this.seatPrefetchInterval = null;
    this.seatPrefetchIntervalMs = 30000; // 30秒に延長（パフォーマンス向上）
    this.noticePollInterval = null;
    this.noticePollIntervalMs = 20000; // 20秒に延長（iOS負荷軽減）
    this.lastNoticeTs = 0;
    
    // 当日券モード用の空席同期
    this.walkinSeatSyncInterval = null;
    this.walkinSeatSyncEnabled = false;
    this.walkinSeatSyncIntervalMs = 25000; // 25秒に延長（iOS負荷軽減）
    
    // iOS対応: メモリクリーンアップ用
    this.memoryCleanupInterval = null;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    this.setupCrossTabChannel();
    this.initializeEventListeners();
    this.startBackgroundSync();
    this.startMemoryCleanup();
  }

  /**
   * イベントリスナーの初期化
   */
  initializeEventListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    window.addEventListener('beforeunload', (event) => this.handleBeforeUnload(event));
    
    // iOS対応: 接続状態チェック間隔を調整
    const connectionCheckInterval = this.isIOS ? 15000 : 8000;
    setInterval(() => this.checkConnectionStatus(), connectionCheckInterval);
    
    // ページ可視性の変更を監視
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
    
    // iOS対応: ページハイド時の処理
    if (this.isIOS) {
      document.addEventListener('pagehide', () => this.handlePageHide());
      window.addEventListener('pageshow', () => this.handlePageShow());
    }
    
    // 当日券モードの監視
    this.startWalkinModeMonitoring();

    // storageイベントで他タブからの更新を検知
    window.addEventListener('storage', (e) => {
      try {
        if (e.key === this.lockKey) {
          return; // ロックの変更は無視
        }
        if (e.key === STORAGE_KEYS.OPERATION_QUEUE) {
          const q = this.readOperationQueue();
          if (this.isOnline && q.length > 0 && !this.syncInProgress) {
            this.performSync();
          }
        }
      } catch (_) {}
    });
  }

  // BroadcastChannel によるタブ間連携
  setupCrossTabChannel() {
    try {
      if ('BroadcastChannel' in window) {
        this.bc = new BroadcastChannel('offline-sync-v2');
        this.bc.onmessage = (ev) => {
          const data = ev.data || {};
          if (data.type === 'queue-updated') {
            if (this.isOnline && !this.syncInProgress) {
              this.performSync();
            }
          } else if (data.type === 'sync-started' && data.owner && data.owner !== this.instanceId) {
            this.syncInProgress = true;
          } else if (data.type === 'sync-finished') {
            this.syncInProgress = false;
          }
        };
      }
    } catch (e) {
      console.warn('[OfflineSync] BroadcastChannel 初期化に失敗:', e);
    }
  }

  broadcast(message) {
    try { if (this.bc) { this.bc.postMessage(message); } } catch (_) {}
  }

  // 競合回避のためのロック獲得
  tryAcquireLock() {
    try {
      const now = Date.now();
      const current = localStorage.getItem(this.lockKey);
      if (current) {
        const parsed = JSON.parse(current);
        if (parsed && parsed.expiresAt && parsed.expiresAt > now) {
          return false; // ロックが生存
        }
      }
      const lock = { owner: this.instanceId, acquiredAt: now, expiresAt: now + this.lockTtlMs };
      localStorage.setItem(this.lockKey, JSON.stringify(lock));
      const confirm = JSON.parse(localStorage.getItem(this.lockKey) || '{}');
      return confirm.owner === this.instanceId;
    } catch (e) {
      console.warn('[OfflineSync] ロック取得に失敗:', e);
      return true; // ロックできない環境では続行
    }
  }

  refreshLock() {
    try {
      const now = Date.now();
      const lock = { owner: this.instanceId, acquiredAt: now, expiresAt: now + this.lockTtlMs };
      localStorage.setItem(this.lockKey, JSON.stringify(lock));
    } catch (_) {}
  }

  releaseLock() {
    try {
      const current = JSON.parse(localStorage.getItem(this.lockKey) || '{}');
      if (current.owner === this.instanceId) {
        localStorage.removeItem(this.lockKey);
      }
    } catch (_) {}
  }

  /**
   * オンライン復帰時の処理
   */
  async handleOnline() {
    if (this.isOnline) return;
    
    console.log('[OfflineSync] オンライン復帰を検知');
    this.isOnline = true;
    this.syncState.lastOnlineTime = Date.now();
    this.saveSyncState();
    
    // オフライン状態インジケーターを更新
    this.updateOfflineIndicator();
    
    // 即座に同期を開始
    await this.performSync();
    
    // バックグラウンド同期を再開
    this.startBackgroundSync();

    // 座席データのバックグラウンド事前取得を開始
    this.startSeatDataPrefetch();

    // 管理者通知ポーリングを開始
    this.startAdminNoticePolling();
  }

  /**
   * オフライン状態の処理
   */
  async handleOffline() {
    if (!this.isOnline) return;
    
    console.log('[OfflineSync] オフライン状態を検知');
    this.isOnline = false;
    this.syncState.lastOfflineTime = Date.now();
    this.saveSyncState();
    
    // オフライン状態インジケーターを更新
    this.updateOfflineIndicator();
    
    // バックグラウンド同期を停止
    this.stopBackgroundSync();
    
    // オフライン操作モードに切り替え
    await this.installOfflineOverrides();

    // 座席データ事前取得はオンライン時のみ
    this.stopSeatDataPrefetch();

    // 通知ポーリング停止
    this.stopAdminNoticePolling();

    // iOS対応: メモリクリーンアップを実行
    if (this.isIOS) {
      this.performMemoryCleanup();
    }
  }

  /**
   * 接続状態のチェック
   */
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

  /**
   * ページ可視性の変更を処理
   */
  handleVisibilityChange() {
    if (document.visibilityState === 'visible' && this.isOnline) {
      // ページが表示された時に同期を実行
      this.performSync();
      // 可視時は事前取得も確実に走らせる
      this.startSeatDataPrefetch();
    }
  }

  // iOS対応: ページハイド時の処理
  handlePageHide() {
    try {
      // 同期状態を保存
      this.saveSyncState();
      // メモリクリーンアップを実行
      this.performMemoryCleanup();
    } catch (e) {
      console.warn('[OfflineSync] Page hide error:', e);
    }
  }

  // iOS対応: ページ表示時の処理
  handlePageShow() {
    try {
      // 接続状態を再確認
      this.checkConnectionStatus();
      // 同期状態を復元
      this.syncState = this.loadSyncState();
    } catch (e) {
      console.warn('[OfflineSync] Page show error:', e);
    }
  }

  /**
   * ページ離脱時の処理
   */
  handleBeforeUnload(event) {
    // 同期状態を保存
    this.saveSyncState();
    
    // 未同期の操作がある場合は警告
    const queue = this.readOperationQueue();
    if (queue.length > 0) {
      try {
        event.preventDefault();
        event.returnValue = '';
      } catch (_) {}
      return '';
    }
  }

  /**
   * オフライン操作をキューに追加
   */
  addOperation(operation) {
    const queue = this.readOperationQueue();
    
    // キューサイズの制限チェック
    if (queue.length >= OFFLINE_CONFIG.MAX_QUEUE_SIZE) {
      console.warn('[OfflineSync] キューが最大サイズに達しました。古い操作を削除します。');
      queue.splice(0, Math.floor(queue.length / 2)); // 古い操作を半分削除
    }
    
    const operationWithMeta = {
      ...operation,
      id: this.generateOperationId(),
      timestamp: Date.now(),
      retryCount: 0,
      priority: OPERATION_PRIORITY[operation.type] || 5,
      status: 'pending',
      precondition: this.capturePrecondition(operation)
    };
    
    queue.push(operationWithMeta);
    
    // 優先度順にソート
    queue.sort((a, b) => a.priority - b.priority);
    
    this.writeOperationQueue(queue);
    this.broadcast({ type: 'queue-updated' });
    this.logOperation(operationWithMeta);

    // コンテキストを学習して事前取得対象に追加
    try { const ctx = this.extractContext(operation.args); this.trackKnownContext(ctx); } catch (_) {}
    
    console.log(`[OfflineSync] オフライン操作を追加: ${operation.type} (ID: ${operationWithMeta.id})`);
    
    // オンライン時は即座に同期を試行
    if (this.isOnline && !this.syncInProgress) {
      this.performSync();
    }
    
    return operationWithMeta.id;
  }

  /**
   * 操作の前提条件をキャプチャ
   */
  capturePrecondition(operation) {
    try {
      const { group, day, timeslot } = this.extractContext(operation.args);
      if (group && day && timeslot) {
        const cache = this.readCache(group, day, timeslot);
        return cache ? { timestamp: cache.cachedAt, version: cache.version } : null;
      }
    } catch (error) {
      console.warn('[OfflineSync] 前提条件のキャプチャに失敗:', error);
    }
    return null;
  }

  /**
   * 操作IDの生成
   */
  generateOperationId() {
    this.operationCounter++;
    return `op_${Date.now()}_${this.operationCounter}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * 操作のログ出力
   */
  logOperation(operation) {
    const log = this.readOperationLog();
    log.push({
      timestamp: Date.now(),
      operation: {
        id: operation.id,
        type: operation.type,
        args: operation.args,
        priority: operation.priority
      },
      queueLength: this.readOperationQueue().length
    });
    
    // ログサイズを制限
    if (log.length > 1000) {
      log.splice(0, log.length - 1000);
    }
    
    this.writeOperationLog(log);
  }

  /**
   * 同期の実行
   */
  async performSync() {
    if (this.syncInProgress) {
      console.log('[OfflineSync] 同期が既に進行中です');
      return;
    }

    // タブ間排他ロック
    if (!this.tryAcquireLock()) {
      console.log('[OfflineSync] 他タブで同期中のため待機');
      return;
    }
    this.broadcast({ type: 'sync-started', owner: this.instanceId });

    const queue = this.readOperationQueue();
    if (queue.length === 0) {
      console.log('[OfflineSync] 同期する操作がありません');
      this.releaseLock();
      this.broadcast({ type: 'sync-finished' });
      return;
    }

    // iOS対応: バッチサイズを制限
    const batchSize = this.isIOS ? OFFLINE_CONFIG.BATCH_SIZE : queue.length;
    const operationsToSync = queue.slice(0, batchSize);

    console.log(`[OfflineSync] ${operationsToSync.length}件の操作を同期開始 (iOS: ${this.isIOS})`);
    this.syncInProgress = true;
    this.syncState.lastSyncAttempt = Date.now();
    this.saveSyncState();
    
    this.showSyncModal();

    // GasAPI readiness guard: if not ready, back off and retry
    try {
      await this.waitForGasAPI();
    } catch (e) {
      console.warn('[OfflineSync] GasAPI未準備のため、同期を後で再試行します:', e.message);
      this.syncInProgress = false;
      this.hideSyncModal();
      this.releaseLock();
      this.broadcast({ type: 'sync-finished' });
      setTimeout(() => { this.performSync(); }, OFFLINE_CONFIG.RETRY_DELAY_MS);
      return;
    }

    // タイムアウト処理
    const timeoutId = setTimeout(() => {
      if (this.syncInProgress) {
        console.error('[OfflineSync] 同期タイムアウト');
        this.syncInProgress = false;
        this.hideSyncModal();
        this.releaseLock();
        this.broadcast({ type: 'sync-finished' });
        // エラー通知を安全に表示
        try {
          this.showErrorNotification('同期がタイムアウトしました。手動で再試行してください。');
        } catch (error) {
          console.error('[OfflineSync] エラー通知の表示に失敗:', error);
          // フォールバック: アラートで表示
          alert('同期がタイムアウトしました。手動で再試行してください。');
        }
      }
    }, OFFLINE_CONFIG.SYNC_TIMEOUT_MS);

    try {
      console.log('[OfflineSync] 操作キューの処理開始');
      const result = await this.processOperationQueue(queue);
      clearTimeout(timeoutId);
      
      console.log('[OfflineSync] 同期完了:', result);
      
      // 成功した操作をキューから削除
      this.writeOperationQueue(result.remaining);
      this.broadcast({ type: 'queue-updated' });
      
      // 同期状態を更新
      this.syncState.lastSuccessfulSync = Date.now();
      this.syncState.syncErrors = [];
      this.saveSyncState();
      
      // 成功通知を表示
      if (result.processed.length > 0) {
        this.showSuccessNotification(`${result.processed.length}件の操作を同期しました`);
      }
      
      // 競合が残っている場合は自動解決を試行
      if (result.conflictCount > 0 && Array.isArray(result.conflicts) && result.conflicts.length > 0) {
        console.log('[OfflineSync] 競合の自動解決を試行します:', result.conflicts.length);
        await this.resolveConflicts(result.conflicts);
      }
      
      // エラーが発生した操作がある場合の通知
      if (result.errorCount > 0) {
        this.showErrorNotification(`${result.errorCount}件の操作でエラーが発生しました`);
      }
      
      // キャッシュを更新
      console.log('[OfflineSync] キャッシュ更新開始');
      await this.refreshCache();
      console.log('[OfflineSync] キャッシュ更新完了');
      
    } catch (error) {
      clearTimeout(timeoutId);
      console.error('[OfflineSync] 同期エラー:', error);
      this.handleSyncError(error);
      
      // エラーが発生した場合、キューをクリアして無限ループを防ぐ
      const currentQueue = this.readOperationQueue();
      if (currentQueue.length > 0) {
        console.warn('[OfflineSync] 同期エラーのため、キューをクリアします');
        this.writeOperationQueue([]);
      }
    } finally {
      console.log('[OfflineSync] 同期処理終了');
      this.syncInProgress = false;
      this.hideSyncModal();
      this.releaseLock();
      this.broadcast({ type: 'sync-finished' });
    }
  }

  /**
   * 操作キューの処理
   */
  async processOperationQueue(queue) {
    const remaining = [];
    const processed = [];
    const errors = [];
    const conflicts = [];

    for (const operation of queue) {
      try {
        console.log(`[OfflineSync] 処理中: ${operation.type} (ID: ${operation.id})`);
        
        // 前提条件のチェック
        if (!this.validatePrecondition(operation)) {
          conflicts.push(operation);
          console.warn(`[OfflineSync] 前提条件の競合: ${operation.type} (ID: ${operation.id})`);
          // 競合した操作は再試行のためキューに残す
          remaining.push(operation);
          continue;
        }
        
        const result = await this.executeOperation(operation);
        
        if (result.success) {
          processed.push({ ...operation, result, syncedAt: Date.now() });
          console.log(`[OfflineSync] 成功: ${operation.type} (ID: ${operation.id})`);
        } else {
          // リトライ可能なエラーの場合
          if (operation.retryCount < OFFLINE_CONFIG.MAX_RETRY_COUNT) {
            operation.retryCount++;
            operation.status = 'retry';
            remaining.push(operation);
            console.log(`[OfflineSync] リトライ予定: ${operation.type} (ID: ${operation.id}) - ${operation.retryCount}/${OFFLINE_CONFIG.MAX_RETRY_COUNT}`);
          } else {
            operation.status = 'failed';
            errors.push({ ...operation, error: result.error });
            console.error(`[OfflineSync] 失敗: ${operation.type} (ID: ${operation.id}) - 最大リトライ回数に達しました`);
            // 失敗した操作はキューから削除（再試行しない）
          }
        }
      } catch (error) {
        console.error(`[OfflineSync] エラー: ${operation.type} (ID: ${operation.id})`, error);
        // 例外が発生した操作もリトライを試行
        if (operation.retryCount < OFFLINE_CONFIG.MAX_RETRY_COUNT) {
          operation.retryCount++;
          operation.status = 'retry';
          remaining.push(operation);
          console.log(`[OfflineSync] 例外後リトライ予定: ${operation.type} (ID: ${operation.id}) - ${operation.retryCount}/${OFFLINE_CONFIG.MAX_RETRY_COUNT}`);
        } else {
          operation.status = 'failed';
          errors.push({ ...operation, error: error.message });
          console.error(`[OfflineSync] 例外後失敗: ${operation.type} (ID: ${operation.id}) - 最大リトライ回数に達しました`);
        }
      }
    }

    return {
      processed,
      remaining,
      errors,
      conflicts,
      successCount: processed.length,
      errorCount: errors.length,
      conflictCount: conflicts.length
    };
  }

  /**
   * 前提条件の検証
   */
  validatePrecondition(operation) {
    try {
      const { group, day, timeslot } = this.extractContext(operation.args);
      if (!group || !day || !timeslot) {
        console.log('[OfflineSync] 前提条件検証: コンテキスト情報が不完全');
        return true;
      }
      
      const cache = this.readCache(group, day, timeslot);
      if (!cache) {
        console.log('[OfflineSync] 前提条件検証: キャッシュが存在しない');
        return true;
      }
      
      if (!operation.precondition) {
        console.log('[OfflineSync] 前提条件検証: 操作の前提条件が存在しない');
        return true;
      }
      
      // キャッシュのバージョンが前提条件と一致するかチェック
      const isValid = cache.version === operation.precondition.version;
      console.log(`[OfflineSync] 前提条件検証: ${isValid ? '有効' : '無効'} (cache: ${cache.version}, operation: ${operation.precondition.version})`);
      
      // オフライン操作の場合は前提条件を緩和
      if (!isValid && operation.timestamp) {
        const timeDiff = Date.now() - operation.timestamp;
        if (timeDiff < 300000) { // 5分以内の操作は有効とする
          console.log('[OfflineSync] 前提条件検証: 時間ベースで有効と判定');
          return true;
        }
      }
      
      return isValid;
    } catch (error) {
      console.warn('[OfflineSync] 前提条件の検証に失敗:', error);
      return true; // エラーの場合は検証をスキップ
    }
  }

  /**
   * ローカル予約済み座席を当日券として登録
   */
  async registerLocalReservationAsWalkin(operation) {
    try {
      const { group, day, timeslot } = this.extractContext(operation.args);
      const cache = this.readCache(group, day, timeslot);
      
      if (!cache || !cache.seatMap) {
        return { success: false, error: 'キャッシュデータが見つかりません' };
      }

      // ローカルで予約済みの座席を特定（オフライン当日券予約フラグをチェック）
      const locallyReservedSeats = [];
      for (const [seatId, seatData] of Object.entries(cache.seatMap)) {
        if (seatData.status === 'reserved' && (seatData.offlineReserved || seatData.offlineWalkin)) {
          locallyReservedSeats.push(seatId);
        }
      }

      // 何もローカル予約がない場合、操作内容（席数/連続）をもとにローカル予約を作成してから続行
      if (locallyReservedSeats.length === 0) {
        try {
          let numSeats = 1;
          let consecutive = false;
          if (operation && operation.type === OPERATION_TYPES.ASSIGN_WALKIN_CONSECUTIVE) {
            consecutive = true;
            if (Array.isArray(operation.args) && typeof operation.args[3] === 'number') {
              numSeats = Math.max(1, operation.args[3] | 0);
            }
          } else if (operation && operation.type === OPERATION_TYPES.ASSIGN_WALKIN) {
            if (Array.isArray(operation.args) && typeof operation.args[3] === 'number') {
              numSeats = Math.max(1, operation.args[3] | 0);
            }
          } else {
            numSeats = 1;
          }

          // ローカル当日券予約を作成
          const localAssign = this.processLocalWalkinAssignment(group, day, timeslot, numSeats, consecutive);
          if (localAssign && localAssign.success && Array.isArray(localAssign.seatIds) && localAssign.seatIds.length > 0) {
            locallyReservedSeats.push(...localAssign.seatIds);
          } else {
            return { success: false, error: 'ローカル予約済み座席が見つかりません' };
          }
        } catch (_) {
          return { success: false, error: 'ローカル予約済み座席が見つかりません' };
        }
      }

      console.log(`[OfflineSync] ローカル予約済み座席を当日券として登録:`, locallyReservedSeats);

      // 座席データを更新して当日券として登録
      const gasAPI = await this.waitForGasAPI();
      // GASのシート仕様に合わせてC/D/E列を直接更新
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const ts = `${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const walkinLabel = `当日券_${ts}`;

      const updatePromises = locallyReservedSeats.map(seatId => {
        // C列: 予約済, D列: 当日券_yyyy/MM/dd HH:mm:ss, E列: 空
        return gasAPI.updateSeatData(group, day, timeslot, seatId, '予約済', walkinLabel, '');
      });

      const results = await Promise.all(updatePromises);
      const failedUpdates = results.filter(r => !r.success);
      
      if (failedUpdates.length > 0) {
        // オフライン委譲はここでキュー投入して成功扱いにする
        const offlineDelegated = failedUpdates.filter(r => r && r.error === 'offline_delegate' && Array.isArray(r.params));
        const otherFailures = failedUpdates.filter(r => !(r && r.error === 'offline_delegate' && Array.isArray(r.params)));
        
        if (offlineDelegated.length > 0) {
          try {
            offlineDelegated.forEach(item => {
              try {
                const args = item.params;
                // args: [group, day, timeslot, seatId, columnC, columnD, columnE]
                if (Array.isArray(args)) {
                  this.addOperation({ type: OPERATION_TYPES.UPDATE_SEAT_DATA, args });
                }
              } catch (_) {}
            });
            console.warn(`[OfflineSync] ${offlineDelegated.length}件の座席更新をオフラインキューに委譲`);
          } catch (e) {
            console.error('[OfflineSync] オフライン委譲のキュー投入でエラー:', e);
          }
        }

        if (otherFailures.length > 0) {
          console.error('[OfflineSync] 一部の座席更新に失敗:', otherFailures);
          return { 
            success: false, 
            error: `${otherFailures.length}件の座席更新に失敗しました`,
            details: otherFailures
          };
        }
        // すべて offline_delegate の場合は成功として継続
      }

      // キャッシュを更新
      const updatedCache = { ...cache };
      locallyReservedSeats.forEach(seatId => {
        if (updatedCache.seatMap[seatId]) {
          // オフライン専用フラグを除去し、シート仕様に近い形へ正規化
          const { offlineReserved, offlineWalkin, offlineSync, walkInTime, ...rest } = updatedCache.seatMap[seatId];
          updatedCache.seatMap[seatId] = {
            status: 'reserved',
            name: walkinLabel,
            ...rest
          };
        }
      });
      
      this.writeCache(group, day, timeslot, updatedCache);

      return {
        success: true,
        message: `ローカル予約済み ${locallyReservedSeats.length} 席を当日券として登録しました`,
        seatIds: locallyReservedSeats,
        offlineSync: true
      };

    } catch (error) {
      console.error('[OfflineSync] ローカル予約の当日券登録エラー:', error);
      return { success: false, error: `当日券登録エラー: ${error.message}` };
    }
  }

  /**
   * 個別操作の実行
   */
  async executeOperation(operation) {
    const { type, args } = operation;
    
    try {
      console.log(`[OfflineSync] GasAPI待機開始: ${type}`);
      const gasAPI = await this.waitForGasAPI();
      console.log(`[OfflineSync] GasAPI取得完了: ${type}`);
      
      console.log(`[OfflineSync] GAS API呼び出し: ${type}`, args);
      
      let result;
      switch (type) {
        case OPERATION_TYPES.RESERVE_SEATS:
          console.log(`[OfflineSync] reserveSeats呼び出し開始(オリジナル)`);
          result = this.originalMethods && this.originalMethods.reserveSeats
            ? await this.originalMethods.reserveSeats(...args)
            : await gasAPI.reserveSeats(...args);
          console.log(`[OfflineSync] reserveSeats呼び出し完了(オリジナル)`);
          break;
        case OPERATION_TYPES.CHECK_IN_SEATS:
          console.log(`[OfflineSync] checkInMultipleSeats呼び出し開始(オリジナル)`);
          result = this.originalMethods && this.originalMethods.checkInMultipleSeats
            ? await this.originalMethods.checkInMultipleSeats(...args)
            : await gasAPI.checkInMultipleSeats(...args);
          console.log(`[OfflineSync] checkInMultipleSeats呼び出し完了(オリジナル)`);
          break;
        case OPERATION_TYPES.UPDATE_SEAT_DATA:
          console.log(`[OfflineSync] updateSeatData呼び出し開始(オリジナル)`);
          result = this.originalMethods && this.originalMethods.updateSeatData
            ? await this.originalMethods.updateSeatData(...args)
            : await gasAPI.updateSeatData(...args);
          console.log(`[OfflineSync] updateSeatData呼び出し完了(オリジナル)`);
          break;
                 case OPERATION_TYPES.ASSIGN_WALKIN:
           console.log(`[OfflineSync] ローカル予約済み座席を当日券として登録開始`);
           result = await this.registerLocalReservationAsWalkin(operation);
           console.log(`[OfflineSync] ローカル予約済み座席を当日券として登録完了`);
           break;
         case OPERATION_TYPES.ASSIGN_WALKIN_CONSECUTIVE:
           console.log(`[OfflineSync] ローカル予約済み座席を当日券として登録開始`);
           result = await this.registerLocalReservationAsWalkin(operation);
           console.log(`[OfflineSync] ローカル予約済み座席を当日券として登録完了`);
           break;
        default:
          result = { success: false, error: `未知の操作タイプ: ${type}` };
      }
      
      console.log(`[OfflineSync] GAS API応答: ${type}`, result);
      return result;
    } catch (error) {
      console.error(`[OfflineSync] 操作実行エラー: ${type}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 競合解決の実行
   */
  async resolveConflicts(conflicts) {
    console.log(`[OfflineSync] ${conflicts.length}件の競合を解決中...`);
    
    for (const conflict of conflicts) {
      try {
        // 最新のデータを取得
        const { group, day, timeslot } = this.extractContext(conflict.args);
        if (group && day && timeslot) {
          const gasAPI = await this.waitForGasAPI();
          const freshData = await gasAPI.getSeatDataMinimal(group, day, timeslot, false);
          
          if (freshData && freshData.success) {
            // キャッシュを更新
            this.writeCache(group, day, timeslot, freshData);
            
            // 操作を再試行
            const result = await this.executeOperation(conflict);
            if (result.success) {
              console.log(`[OfflineSync] 競合解決成功: ${conflict.type} (ID: ${conflict.id})`);
            }
            // 競合発生を通知（管理者向けブロードキャスト）
            await this.notifyConflict(conflict, freshData);
          }
        }
      } catch (error) {
        console.error(`[OfflineSync] 競合解決エラー: ${conflict.type} (ID: ${conflict.id})`, error);
        // エラーも通知
        try { await this.notifyConflict(conflict, null, error); } catch (_) {}
      }
    }
  }

  // 競合通知の送信（ローカル通知 + 可能ならサーバーブロードキャスト）
  async notifyConflict(operation, latestData = null, error = null) {
    try {
      // 現在モードの推定
      let mode = 'normal';
      try { mode = localStorage.getItem('currentMode') || 'normal'; } catch (_) {}
      const ctx = this.extractContext(operation.args) || {};
      const message = `競合が発生しました: type=${operation.type}, group=${ctx.group}, day=${ctx.day}, timeslot=${ctx.timeslot}`;
      const details = {
        mode,
        operationId: operation.id,
        operationType: operation.type,
        timestamp: new Date().toISOString(),
        error: error ? (error.message || String(error)) : undefined,
        latestVersion: latestData && latestData.version ? latestData.version : undefined
      };

      // ローカル通知（画面）
      this.showErrorNotification(`${message}`);
      try { console.warn('[OfflineSync] 競合詳細:', details); } catch (_) {}

      // 最高管理者モード端末向けにサーバー通知を試行
      try {
        if (window.GasAPI && window.GasAPI.broadcastAdminNotice) {
          window.GasAPI.broadcastAdminNotice(message, details).catch(() => {});
        }
      } catch (_) {}

      // タブ間にも通知
      this.broadcast({ type: 'conflict', payload: { message, details } });
    } catch (e) {
      console.error('[OfflineSync] 競合通知の送信に失敗:', e);
    }
  }

  /**
   * キャッシュの更新
   */
  async refreshCache() {
    try {
      const { group, day, timeslot } = this.getCurrentContext();
      if (group && day && timeslot) {
        console.log('[OfflineSync] キャッシュを更新中...');
        const gasAPI = await this.waitForGasAPI();
        const freshData = await gasAPI.getSeatDataMinimal(group, day, timeslot, false);
        
        if (freshData && freshData.success) {
          this.writeCache(group, day, timeslot, freshData);
          console.log('[OfflineSync] キャッシュ更新完了');
        }
      }
    } catch (error) {
      console.error('[OfflineSync] キャッシュ更新エラー:', error);
    }
  }

  /**
   * エラーハンドリング
   */
  handleSyncError(error) {
    this.syncState.syncErrors.push({
      timestamp: Date.now(),
      error: error.message,
      retryCount: this.syncState.retryCount || 0
    });
    
    // 連続エラーが多すぎる場合は同期を停止
    const recentErrors = this.syncState.syncErrors.filter(
      e => Date.now() - e.timestamp < 300000 // 5分以内のエラー
    );
    
    if (recentErrors.length > 10) {
      console.error('[OfflineSync] 連続エラーが多すぎるため、同期を停止します');
      this.stopBackgroundSync();
      this.notifySyncFailure();
      return;
    }
    
    if (this.syncState.retryCount < OFFLINE_CONFIG.MAX_RETRY_COUNT) {
      this.syncState.retryCount++;
      console.log(`[OfflineSync] リトライ ${this.syncState.retryCount}/${OFFLINE_CONFIG.MAX_RETRY_COUNT} を ${OFFLINE_CONFIG.RETRY_DELAY_MS}ms後に実行`);
      
      this.retryTimeout = setTimeout(() => {
        this.performSync();
      }, OFFLINE_CONFIG.RETRY_DELAY_MS);
    } else {
      console.error('[OfflineSync] 最大リトライ回数に達しました');
      this.notifySyncFailure();
    }
    
    this.saveSyncState();
  }

  /**
   * 同期失敗の通知
   */
  notifySyncFailure() {
    const notification = document.createElement('div');
    notification.className = 'sync-failure-notification';
    notification.innerHTML = `
      <div class="notification-content">
        <h4>同期エラー</h4>
        <p>オフライン操作の同期に失敗しました。手動で同期を試してください。</p>
        <button onclick="OfflineSyncV2.retrySync()">再試行</button>
        <button onclick="OfflineSyncV2.showQueueStatus()">詳細表示</button>
        <button onclick="this.parentElement.parentElement.remove()">閉じる</button>
      </div>
    `;
    
    document.body.appendChild(notification);
  }

  /**
   * バックグラウンド同期の開始
   */
  startBackgroundSync() {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
    }
    
    this.backgroundSyncInterval = setInterval(() => {
      if (this.isOnline && !this.syncInProgress) {
        const hasQueue = this.readOperationQueue().length > 0;
        if (hasQueue) {
          this.performSync();
        } else {
          // キューが無くても座席キャッシュを最新化
          this.refreshCache();
        }
      }
    }, OFFLINE_CONFIG.BACKGROUND_SYNC_INTERVAL);
  }

  /**
   * バックグラウンド同期の停止
   */
  stopBackgroundSync() {
    if (this.backgroundSyncInterval) {
      clearInterval(this.backgroundSyncInterval);
      this.backgroundSyncInterval = null;
    }
  }

  /**
   * オフラインオーバーライドのインストール
   */
  async installOfflineOverrides() {
    if (!OFFLINE_CONFIG.ENABLED) return;
    
    try {
      // GasAPIの待機を短時間で試行
      const gasAPI = await Promise.race([
        this.waitForGasAPI(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('GasAPI待機タイムアウト')), 5000)
        )
      ]);
      
      if (!gasAPI) {
        console.warn('[OfflineSync] GasAPIが利用できません。オフラインオーバーライドをスキップします。');
        return;
      }
      
      console.log('[OfflineSync] オフライン操作モードに切り替え');
      
             // 元のメソッドを保存
       const originalMethods = {
         reserveSeats: gasAPI.reserveSeats.bind(gasAPI),
         checkInMultipleSeats: gasAPI.checkInMultipleSeats.bind(gasAPI),
         updateSeatData: gasAPI.updateSeatData.bind(gasAPI),
         assignWalkInSeat: gasAPI.assignWalkInSeat.bind(gasAPI),
         assignWalkInSeats: gasAPI.assignWalkInSeats.bind(gasAPI),
         assignWalkInConsecutiveSeats: gasAPI.assignWalkInConsecutiveSeats.bind(gasAPI)
       };
      // インスタンスに保持（同期時にオリジナルを使用）
      this.originalMethods = originalMethods;

      // 予約のオフライン対応
      gasAPI.reserveSeats = async (...args) => {
        const [group, day, timeslot, seats] = args;
        
        if (this.isOnline) {
          try {
            return await originalMethods.reserveSeats(...args);
          } catch (error) {
            console.log('[OfflineSync] オンライン予約失敗、オフライン処理を試行');
            
            // キャッシュがある場合はローカル処理を試行
            if (this.shouldProcessLocally(group, day, timeslot)) {
              this.showOfflineProcessingNotification('座席予約をローカルで処理中...', true);
              const localResult = this.processLocalReservation(group, day, timeslot, seats);
              if (localResult.success) {
                // ローカル処理成功時は同期キューにも追加
                const operationId = this.addOperation({ type: OPERATION_TYPES.RESERVE_SEATS, args });
                this.showSuccessNotification(localResult.message);
                return { ...localResult, operationId };
              } else {
                this.showErrorNotification(localResult.error);
              }
            }
            
            // ローカル処理できない場合はキューに追加
            const operationId = this.addOperation({ type: OPERATION_TYPES.RESERVE_SEATS, args });
            return { 
              success: true, 
              message: 'オフラインで予約を受け付けました', 
              offline: true, 
              operationId 
            };
          }
        } else {
          // オフライン時はキャッシュがあるかチェック
          if (this.shouldProcessLocally(group, day, timeslot)) {
            this.showOfflineProcessingNotification('座席予約をローカルで処理中...', true);
            const localResult = this.processLocalReservation(group, day, timeslot, seats);
            if (localResult.success) {
              // ローカル処理成功時は同期キューにも追加
              const operationId = this.addOperation({ type: OPERATION_TYPES.RESERVE_SEATS, args });
              this.showSuccessNotification(localResult.message);
              return { ...localResult, operationId };
            } else {
              this.showErrorNotification(localResult.error);
              return localResult; // ローカル処理失敗時はエラーを返す
            }
          } else {
            // キャッシュがない場合は通常のオフライン処理
            this.showOfflineProcessingNotification('座席予約をオフラインで受け付けました');
            const operationId = this.addOperation({ type: OPERATION_TYPES.RESERVE_SEATS, args });
            return { 
              success: true, 
              message: 'オフラインで予約を受け付けました', 
              offline: true, 
              operationId 
            };
          }
        }
      };

      // チェックインのオフライン対応
      gasAPI.checkInMultipleSeats = async (...args) => {
        const [group, day, timeslot, seats] = args;
        
        if (this.isOnline) {
          try {
            return await originalMethods.checkInMultipleSeats(...args);
          } catch (error) {
            console.log('[OfflineSync] オンラインチェックイン失敗、オフライン処理を試行');
            
            // キャッシュがある場合はローカル処理を試行
            if (this.shouldProcessLocally(group, day, timeslot)) {
              const localResult = this.processLocalCheckIn(group, day, timeslot, seats);
              if (localResult.success) {
                // ローカル処理成功時は同期キューにも追加
                const operationId = this.addOperation({ type: OPERATION_TYPES.CHECK_IN_SEATS, args });
                return { ...localResult, operationId };
              }
            }
            
            // ローカル処理できない場合はキューに追加
            const operationId = this.addOperation({ type: OPERATION_TYPES.CHECK_IN_SEATS, args });
            return { 
              success: true, 
              message: 'オフラインでチェックインを受け付けました', 
              offline: true, 
              operationId 
            };
          }
        } else {
          // オフライン時はキャッシュがあるかチェック
          if (this.shouldProcessLocally(group, day, timeslot)) {
            const localResult = this.processLocalCheckIn(group, day, timeslot, seats);
            if (localResult.success) {
              // ローカル処理成功時は同期キューにも追加
              const operationId = this.addOperation({ type: OPERATION_TYPES.CHECK_IN_SEATS, args });
              return { ...localResult, operationId };
            } else {
              return localResult; // ローカル処理失敗時はエラーを返す
            }
          } else {
            // キャッシュがない場合は通常のオフライン処理
            const operationId = this.addOperation({ type: OPERATION_TYPES.CHECK_IN_SEATS, args });
            return { 
              success: true, 
              message: 'オフラインでチェックインを受け付けました', 
              offline: true, 
              operationId 
            };
          }
        }
      };

      // 座席データ更新のオフライン対応
      gasAPI.updateSeatData = async (...args) => {
        if (this.isOnline) {
          try {
            return await originalMethods.updateSeatData(...args);
          } catch (error) {
            console.log('[OfflineSync] オンライン更新失敗、オフライン操作として処理');
            const operationId = this.addOperation({ type: OPERATION_TYPES.UPDATE_SEAT_DATA, args });
            return { 
              success: true, 
              message: 'オフラインで更新を受け付けました', 
              offline: true, 
              operationId 
            };
          }
        } else {
          const operationId = this.addOperation({ type: OPERATION_TYPES.UPDATE_SEAT_DATA, args });
          return { 
            success: true, 
            message: 'オフラインで更新を受け付けました', 
            offline: true, 
            operationId 
          };
        }
      };

             // 当日券発行のオフライン対応（単発）
       gasAPI.assignWalkInSeat = async (...args) => {
         const [group, day, timeslot] = args;
         
         if (this.isOnline) {
           try {
             return await originalMethods.assignWalkInSeat(...args);
           } catch (error) {
             console.log('[OfflineSync] オンライン当日券発行失敗、オフライン処理を試行');
             
             // キャッシュがある場合はローカル処理を試行
             if (this.shouldProcessLocally(group, day, timeslot)) {
               this.showOfflineProcessingNotification('当日券発行をローカルで処理中...', true);
               const localResult = this.processLocalWalkinAssignment(group, day, timeslot, 1, false);
               if (localResult.success) {
                 // ローカル処理成功時は同期キューにも追加
                 const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
                 this.showSuccessNotification(localResult.message);
                 return { ...localResult, operationId };
               } else {
                 this.showErrorNotification(localResult.error);
               }
             }
             
             // ローカル処理できない場合はキューに追加
             const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
             return { 
               success: true, 
               message: 'オフラインで当日券発行を受け付けました', 
               offline: true, 
               operationId 
             };
           }
         } else {
           // オフライン時はキャッシュがあるかチェック
           if (this.shouldProcessLocally(group, day, timeslot)) {
             this.showOfflineProcessingNotification('当日券発行をローカルで処理中...', true);
             const localResult = this.processLocalWalkinAssignment(group, day, timeslot, 1, false);
             if (localResult.success) {
               // ローカル処理成功時は同期キューにも追加
               const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
               this.showSuccessNotification(localResult.message);
               return { ...localResult, operationId };
             } else {
               this.showErrorNotification(localResult.error);
               return localResult; // ローカル処理失敗時はエラーを返す
             }
           } else {
             // キャッシュがない場合は通常のオフライン処理
             this.showOfflineProcessingNotification('当日券発行をオフラインで受け付けました');
             const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
             return { 
               success: true, 
               message: 'オフラインで当日券発行を受け付けました', 
               offline: true, 
               operationId 
             };
           }
         }
       };

       // 当日券発行のオフライン対応（複数）
       gasAPI.assignWalkInSeats = async (...args) => {
         const [group, day, timeslot, numSeats] = args;
         
         if (this.isOnline) {
           try {
             return await originalMethods.assignWalkInSeats(...args);
           } catch (error) {
             console.log('[OfflineSync] オンライン当日券発行失敗、オフライン処理を試行');
             
             // キャッシュがある場合はローカル処理を試行
             if (this.shouldProcessLocally(group, day, timeslot)) {
               const localResult = this.processLocalWalkinAssignment(group, day, timeslot, numSeats, false);
               if (localResult.success) {
                 // ローカル処理成功時は同期キューにも追加
                 const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
                 return { ...localResult, operationId };
               }
             }
             
             // ローカル処理できない場合はキューに追加
             const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
             return { 
               success: true, 
               message: 'オフラインで当日券発行を受け付けました', 
               offline: true, 
               operationId 
             };
           }
         } else {
           // オフライン時はキャッシュがあるかチェック
           if (this.shouldProcessLocally(group, day, timeslot)) {
             const localResult = this.processLocalWalkinAssignment(group, day, timeslot, numSeats, false);
             if (localResult.success) {
               // ローカル処理成功時は同期キューにも追加
               const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
               return { ...localResult, operationId };
             } else {
               return localResult; // ローカル処理失敗時はエラーを返す
             }
           } else {
             // キャッシュがない場合は通常のオフライン処理
             const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN, args });
             return { 
               success: true, 
               message: 'オフラインで当日券発行を受け付けました', 
               offline: true, 
               operationId 
             };
           }
         }
       };

       // 連続席当日券発行のオフライン対応
       gasAPI.assignWalkInConsecutiveSeats = async (...args) => {
         const [group, day, timeslot, numSeats] = args;
         
         if (this.isOnline) {
           try {
             return await originalMethods.assignWalkInConsecutiveSeats(...args);
           } catch (error) {
             console.log('[OfflineSync] オンライン連続席発行失敗、オフライン処理を試行');
             
             // キャッシュがある場合はローカル処理を試行
             if (this.shouldProcessLocally(group, day, timeslot)) {
               const localResult = this.processLocalWalkinAssignment(group, day, timeslot, numSeats, true);
               if (localResult.success) {
                 // ローカル処理成功時は同期キューにも追加
                 const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN_CONSECUTIVE, args });
                 return { ...localResult, operationId };
               }
             }
             
             // ローカル処理できない場合はキューに追加
             const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN_CONSECUTIVE, args });
             return { 
               success: true, 
               message: 'オフラインで連続席発行を受け付けました', 
               offline: true, 
               operationId 
             };
           }
         } else {
           // オフライン時はキャッシュがあるかチェック
           if (this.shouldProcessLocally(group, day, timeslot)) {
             const localResult = this.processLocalWalkinAssignment(group, day, timeslot, numSeats, true);
             if (localResult.success) {
               // ローカル処理成功時は同期キューにも追加
               const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN_CONSECUTIVE, args });
               return { ...localResult, operationId };
             } else {
               return localResult; // ローカル処理失敗時はエラーを返す
             }
           } else {
             // キャッシュがない場合は通常のオフライン処理
             const operationId = this.addOperation({ type: OPERATION_TYPES.ASSIGN_WALKIN_CONSECUTIVE, args });
             return { 
               success: true, 
               message: 'オフラインで連続席発行を受け付けました', 
               offline: true, 
               operationId 
             };
           }
         }
       };
      
    } catch (error) {
      console.error('[OfflineSync] オフラインオーバーライドのインストールに失敗:', error);
    }
  }

  /**
   * 同期モーダルの表示
   */
  showSyncModal() {
    try {
      const existing = document.getElementById('sync-modal-v2');
      if (existing) existing.remove();

      const modalHTML = `
        <div id="sync-modal-v2">
          <div class="modal-content">
            <div class="spinner"></div>
            <h3>オフライン操作を同期中...</h3>
            <p>しばらくお待ちください。操作はできません。</p>
            <div class="sync-progress">
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
            </div>
            <div class="sync-status">
              <p>同期状況: <span id="sync-status-text">処理中...</span></p>
            </div>
          </div>
        </div>
      `;
      
      document.body.insertAdjacentHTML('beforeend', modalHTML);
      console.log('[OfflineSync] 同期モーダルを表示');
      
    } catch (error) {
      console.error('[OfflineSync] モーダル表示エラー:', error);
    }
  }

  /**
   * 同期モーダルの非表示
   */
  hideSyncModal() {
    try {
      const modal = document.getElementById('sync-modal-v2');
      if (modal) {
        modal.classList.add('fade-out');
        setTimeout(() => {
          modal.remove();
          console.log('[OfflineSync] 同期モーダルを非表示');
        }, 300);
      }
    } catch (error) {
      console.error('[OfflineSync] モーダル非表示エラー:', error);
    }
  }

  /**
   * 成功通知の表示
   */
  showSuccessNotification(message) {
    try {
      const notification = document.createElement('div');
      notification.className = 'success-notification';
      
      notification.innerHTML = `
        <div class="notification-content">
          <span class="notification-message">${message}</span>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">閉じる</button>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 4000);
    } catch (error) {
      console.error('[OfflineSync] 成功通知の表示に失敗:', error);
      // フォールバック: アラートで表示
      alert(message);
    }
  }

  /**
   * オフライン処理通知の表示
   */
  showOfflineProcessingNotification(message, isLocal = false) {
    try {
      const notification = document.createElement('div');
      notification.className = 'offline-processing-notification';
      
      const type = isLocal ? 'ローカル処理' : 'オフライン処理';
      
      notification.innerHTML = `
        <div class="notification-content">
          <span class="notification-message">
            <strong>${type}:</strong> ${message}
          </span>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">閉じる</button>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 6000);
    } catch (error) {
      console.error('[OfflineSync] オフライン処理通知の表示に失敗:', error);
    }
  }

  /**
   * オフライン状態インジケーターの更新
   */
  updateOfflineIndicator() {
    try {
      const indicator = document.getElementById('offline-indicator');
      if (!indicator) return;

      const isOnline = this.isOnline;
      const hasValidCache = this.hasValidCacheForContext(...Object.values(this.getCurrentContext()));
      
      if (isOnline) {
        indicator.style.display = 'none';
        indicator.textContent = 'オンライン';
        indicator.classList.add('online');
        indicator.classList.remove('offline', 'offline-with-cache');
      } else {
        indicator.style.display = 'block';
        indicator.textContent = hasValidCache ? 'オフライン (キャッシュ利用可能)' : 'オフライン';
        indicator.classList.remove('online');
        indicator.classList.add(hasValidCache ? 'offline-with-cache' : 'offline');
      }
    } catch (error) {
      console.error('[OfflineSync] オフライン状態インジケーター更新エラー:', error);
    }
  }

  /**
   * エラー通知の表示
   */
  showErrorNotification(message) {
    try {
      const notification = document.createElement('div');
      notification.className = 'sync-failure-notification';
      
      notification.innerHTML = `
        <h4>エラー</h4>
        <p>${message}</p>
        <button onclick="this.parentElement.remove()">閉じる</button>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 6000);
    } catch (error) {
      console.error('[OfflineSync] エラー通知の表示に失敗:', error);
      // フォールバック: アラートで表示
      alert(message);
    }
  }

  /**
   * GasAPIの待機
   */
  async waitForGasAPI() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('GasAPIの待機がタイムアウトしました'));
      }, 10000); // 10秒でタイムアウト
      
      const checkAPI = () => {
        if (window.GasAPI) {
          clearTimeout(timeout);
          resolve(window.GasAPI);
        } else {
          setTimeout(checkAPI, 100);
        }
      };
      checkAPI();
    });
  }

  /**
   * 現在のコンテキストを取得
   */
  getCurrentContext() {
    try {
      const params = new URLSearchParams(window.location.search);
      return {
        group: params.get('group'),
        day: params.get('day'),
        timeslot: params.get('timeslot')
      };
    } catch (error) {
      console.error('[OfflineSync] コンテキスト取得エラー:', error);
      return {};
    }
  }

  /**
   * 操作のコンテキストを抽出
   */
  extractContext(args) {
    try {
      if (Array.isArray(args) && args.length >= 3) {
        return {
          group: args[0],
          day: args[1],
          timeslot: args[2]
        };
      }
    } catch (error) {
      console.warn('[OfflineSync] コンテキスト抽出エラー:', error);
    }
    return {};
  }

  /**
   * 操作キューの読み取り
   */
  readOperationQueue() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OPERATION_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[OfflineSync] キュー読み取りエラー:', error);
      return [];
    }
  }

  /**
   * 操作キューの書き込み
   */
  writeOperationQueue(queue) {
    try {
      localStorage.setItem(STORAGE_KEYS.OPERATION_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('[OfflineSync] キュー書き込みエラー:', error);
    }
  }

  /**
   * 操作ログの読み取り
   */
  readOperationLog() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.OPERATION_LOG);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('[OfflineSync] ログ読み取りエラー:', error);
      return [];
    }
  }

  /**
   * 操作ログの書き込み
   */
  writeOperationLog(log) {
    try {
      localStorage.setItem(STORAGE_KEYS.OPERATION_LOG, JSON.stringify(log));
    } catch (error) {
      console.error('[OfflineSync] ログ書き込みエラー:', error);
    }
  }

  /**
   * キャッシュの読み取り（オフライン時専用強化版）
   */
  readCache(group, day, timeslot) {
    try {
      const key = `${STORAGE_KEYS.CACHE_DATA}_${group}-${day}-${timeslot}`;
      const data = localStorage.getItem(key);
      if (!data) return null;
      
      const cache = JSON.parse(data);
      
      // オフライン時は有効期限を延長（通常の3倍）
      const isOffline = !navigator.onLine;
      const expiryMs = isOffline ? OFFLINE_CONFIG.CACHE_EXPIRY_MS * 3 : OFFLINE_CONFIG.CACHE_EXPIRY_MS;
      
      // キャッシュの有効期限チェック
      if (cache.cachedAt && (Date.now() - cache.cachedAt) > expiryMs) {
        if (!isOffline) {
          // オンライン時のみキャッシュを削除
          localStorage.removeItem(key);
        }
        return null;
      }
      
      // オフライン時の座席データ復元強化
      if (isOffline && cache.seatMap) {
        console.log('[OfflineSync] オフライン時の座席キャッシュ復元:', {
          group, day, timeslot,
          seatCount: Object.keys(cache.seatMap).length,
          cacheAge: Math.round((Date.now() - cache.cachedAt) / 1000) + '秒前'
        });
        
        // 座席データの整合性チェックと修復
        const repairedSeatMap = {};
        Object.entries(cache.seatMap).forEach(([seatId, seatData]) => {
          if (seatData && typeof seatData === 'object') {
            // 基本的な座席データ構造を保証
            repairedSeatMap[seatId] = {
              id: seatId,
              status: seatData.status || 'available',
              name: seatData.name || null,
              ...seatData
            };
          }
        });
        
        if (Object.keys(repairedSeatMap).length > 0) {
          cache.seatMap = repairedSeatMap;
          console.log('[OfflineSync] 座席データ修復完了:', Object.keys(repairedSeatMap).length + '席');
        }
      }
      
      return cache;
    } catch (error) {
      console.error('[OfflineSync] キャッシュ読み取りエラー:', error);
      return null;
    }
  }

  /**
   * オフライン時のキャッシュデータ存在チェック
   */
  hasValidCacheForContext(group, day, timeslot) {
    try {
      const cache = this.readCache(group, day, timeslot);
      if (!cache) {
        console.log('[OfflineSync] キャッシュデータが存在しません:', { group, day, timeslot });
        return false;
      }

      // キャッシュデータの有効性を詳細チェック
      const hasSeatMap = cache.seatMap && typeof cache.seatMap === 'object';
      const hasSeatData = hasSeatMap && Object.keys(cache.seatMap).length > 0;
      const hasValidData = cache.success !== false;
      const isRecent = cache.cachedAt && (Date.now() - cache.cachedAt) < OFFLINE_CONFIG.CACHE_EXPIRY_MS;

      const isValid = hasSeatMap && hasSeatData && hasValidData && isRecent;
      console.log('[OfflineSync] キャッシュ有効性チェック:', {
        group, day, timeslot,
        hasSeatMap,
        hasSeatData,
        seatCount: hasSeatMap ? Object.keys(cache.seatMap).length : 0,
        hasValidData,
        isRecent,
        isValid,
        cacheAge: cache.cachedAt ? Date.now() - cache.cachedAt : 'unknown'
      });

      return isValid;
    } catch (error) {
      console.error('[OfflineSync] キャッシュ有効性チェックエラー:', error);
      return false;
    }
  }

  /**
   * オフライン時のローカル処理判定
   */
  shouldProcessLocally(group, day, timeslot) {
    if (this.isOnline) {
      console.log('[OfflineSync] オンライン状態のため、ローカル処理は不要');
      return false;
    }

    const hasValidCache = this.hasValidCacheForContext(group, day, timeslot);
    console.log('[OfflineSync] ローカル処理判定:', {
      group, day, timeslot,
      isOnline: this.isOnline,
      hasValidCache,
      shouldProcessLocally: hasValidCache
    });

    return hasValidCache;
  }

  /**
   * オフライン時のローカル座席予約処理
   */
  processLocalReservation(group, day, timeslot, seats) {
    try {
      console.log('[OfflineSync] ローカル座席予約処理開始:', { group, day, timeslot, seats });
      
      const cache = this.readCache(group, day, timeslot);
      if (!cache || !cache.seatMap) {
        return { success: false, error: 'キャッシュデータが無効です' };
      }

      const seatMap = { ...cache.seatMap };
      const reservedSeats = [];
      const errors = [];

      // 座席の予約状態をチェック
      for (const seatId of seats) {
        if (!seatMap[seatId]) {
          errors.push(`座席 ${seatId} が見つかりません`);
          continue;
        }

        const seatStatus = seatMap[seatId].status;
        const isReserved = seatStatus === 'reserved' || seatStatus === 'occupied' || seatStatus === 'taken';
        
        if (isReserved) {
          errors.push(`座席 ${seatId} は既に予約済みです (状態: ${seatStatus})`);
          continue;
        }

        // 座席を予約状態に変更
        seatMap[seatId] = {
          ...seatMap[seatId],
          status: 'reserved',
          reservedAt: Date.now(),
          offlineReservation: true
        };
        reservedSeats.push(seatId);
      }

      if (errors.length > 0 && reservedSeats.length === 0) {
        return { success: false, error: errors.join(', ') };
      }

      // キャッシュを更新
      const updatedCache = {
        ...cache,
        seatMap,
        lastModified: Date.now(),
        offlineModifications: (cache.offlineModifications || 0) + 1
      };
      this.writeCache(group, day, timeslot, updatedCache);

      console.log('[OfflineSync] ローカル座席予約処理完了:', { reservedSeats, errors });
      
      return {
        success: true,
        message: `オフラインで ${reservedSeats.length} 席を予約しました`,
        seatIds: reservedSeats,
        offline: true,
        localProcessing: true,
        warnings: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('[OfflineSync] ローカル座席予約処理エラー:', error);
      return { success: false, error: `ローカル処理エラー: ${error.message}` };
    }
  }

  /**
   * オフライン時のローカルチェックイン処理
   */
  processLocalCheckIn(group, day, timeslot, seats) {
    try {
      console.log('[OfflineSync] ローカルチェックイン処理開始:', { group, day, timeslot, seats });
      
      const cache = this.readCache(group, day, timeslot);
      if (!cache || !cache.seatMap) {
        return { success: false, error: 'キャッシュデータが無効です' };
      }

      const seatMap = { ...cache.seatMap };
      const checkedInSeats = [];
      const errors = [];

      // 座席のチェックイン状態をチェック
      for (const seatId of seats) {
        if (!seatMap[seatId]) {
          errors.push(`座席 ${seatId} が見つかりません`);
          continue;
        }

        const seatStatus = seatMap[seatId].status;
        const isOccupied = seatStatus === 'occupied' || seatStatus === 'taken';
        const isAvailable = seatStatus === 'available' || seatStatus === 'free' || seatStatus === 'open' || 
                           seatStatus === '' || seatStatus === null || seatStatus === undefined;

        if (isOccupied) {
          errors.push(`座席 ${seatId} は既にチェックイン済みです (状態: ${seatStatus})`);
          continue;
        }

        if (isAvailable) {
          errors.push(`座席 ${seatId} は予約されていません (状態: ${seatStatus})`);
          continue;
        }

        // 座席をチェックイン状態に変更
        seatMap[seatId] = {
          ...seatMap[seatId],
          status: 'occupied',
          checkedInAt: Date.now(),
          offlineCheckIn: true
        };
        checkedInSeats.push(seatId);
      }

      if (errors.length > 0 && checkedInSeats.length === 0) {
        return { success: false, error: errors.join(', ') };
      }

      // キャッシュを更新
      const updatedCache = {
        ...cache,
        seatMap,
        lastModified: Date.now(),
        offlineModifications: (cache.offlineModifications || 0) + 1
      };
      this.writeCache(group, day, timeslot, updatedCache);

      console.log('[OfflineSync] ローカルチェックイン処理完了:', { checkedInSeats, errors });
      
      return {
        success: true,
        message: `オフラインで ${checkedInSeats.length} 席をチェックインしました`,
        seatIds: checkedInSeats,
        offline: true,
        localProcessing: true,
        warnings: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('[OfflineSync] ローカルチェックイン処理エラー:', error);
      return { success: false, error: `ローカル処理エラー: ${error.message}` };
    }
  }

  /**
   * オフライン時のローカル当日券発行処理
   */
  processLocalWalkinAssignment(group, day, timeslot, numSeats = 1, consecutive = false) {
    try {
      console.log('[OfflineSync] ローカル当日券発行処理開始:', { group, day, timeslot, numSeats, consecutive });
      
      let cache = this.readCache(group, day, timeslot);
      console.log('[OfflineSync] 読み込んだキャッシュデータ:', cache);
      
      // ローカル座席キャッシュが空の場合、当日券用キャッシュで最低限の座席マップを補完
      if (!cache || !cache.seatMap || Object.keys(cache.seatMap).length === 0) {
        try {
          const spreadsheetId = window.SPREADSHEET_ID;
          const walkinSeatMap = spreadsheetId ? this.getCachedWalkinSeatData(spreadsheetId) : null;
          if (walkinSeatMap && typeof walkinSeatMap === 'object') {
            cache = cache || { seatMap: {}, success: true };
            cache.seatMap = cache.seatMap || {};
            // 利用可能席だけ反映
            Object.entries(walkinSeatMap).forEach(([seatId, seat]) => {
              if (!cache.seatMap[seatId] && seat && (seat.status === 'available' || seat.status === 'free' || seat.status === 'open' || seat.status === '' || seat.status == null)) {
                cache.seatMap[seatId] = { id: seatId, status: 'available', name: null };
              }
            });
            // 書き戻し
            this.writeCache(group, day, timeslot, cache);
            console.log('[OfflineSync] 当日券用キャッシュから座席マップを補完');
          }
        } catch (e) {
          console.warn('[OfflineSync] 当日券用キャッシュ補完に失敗:', e);
        }
        if (!cache || !cache.seatMap || Object.keys(cache.seatMap).length === 0) {
          return { 
            success: false, 
            error: '座席データがキャッシュされていません。当日券キャッシュも空でした。',
            needsOnlineData: true
          };
        }
      }

      const seatMap = { ...cache.seatMap };
      const assignedSeats = [];

      // オンラインの挙動に合わせ、厳密に 'available' のみを空席とみなす
      const isAvailableStatus = (s) => s === 'available';

      // シートの決定順序をオンラインに近い行優先・番号昇順で決定
      const rowOrder = ['A', 'B', 'C', 'D', 'E'];
      const rowMaxCols = { A: 12, B: 12, C: 12, D: 12, E: 6 };

      const orderedAvailable = [];
      for (const row of rowOrder) {
        const maxCol = rowMaxCols[row];
        for (let col = 1; col <= maxCol; col++) {
          const seatId = `${row}${col}`;
          const data = seatMap[seatId];
          if (data && isAvailableStatus(data.status)) {
            orderedAvailable.push({ seatId, ...data, row, col });
          }
        }
      }

      console.log('[OfflineSync] 利用可能な座席数(ordered):', orderedAvailable.length);
      console.log('[OfflineSync] 必要座席数:', numSeats);

      if (orderedAvailable.length < numSeats) {
        const errorMsg = `空席が不足しています (必要: ${numSeats}, 利用可能: ${availableSeats.length})`;
        console.error('[OfflineSync]', errorMsg);
        return { 
          success: false, 
          error: errorMsg 
        };
      }

      if (consecutive) {
        // 同一行で番号が連続する最初の組を選択
        let found = false;
        for (const row of rowOrder) {
          const rowSeats = orderedAvailable.filter(s => s.row === row).map(s => s.col);
          if (rowSeats.length === 0) continue;
          // 連続区間探索
          for (let i = 0; i <= rowSeats.length - numSeats; i++) {
            let ok = true;
            for (let k = 1; k < numSeats; k++) {
              if (rowSeats[i + k] !== rowSeats[i] + k) { ok = false; break; }
            }
            if (ok) {
              const startCol = rowSeats[i];
              for (let c = startCol; c < startCol + numSeats; c++) {
                assignedSeats.push({ seatId: `${row}${c}` });
              }
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) {
          return { 
            success: false, 
            error: `連続する空席が不足しています (必要: ${numSeats})` 
          };
        }
      } else {
        // 先頭から必要数だけ選択
        assignedSeats.push(...orderedAvailable.slice(0, numSeats).map(s => ({ seatId: s.seatId })));
      }

      // 座席を予約状態に変更（オフライン当日券予約フラグを設定）
      for (const seat of assignedSeats) {
        seatMap[seat.seatId] = {
          ...seat,
          status: 'reserved',
          reservedAt: Date.now(),
          offlineWalkin: true,
          walkinAssignment: true,
          offlineReserved: true // 同期時に当日券として登録するためのフラグ
        };
      }

      // キャッシュを更新
      const updatedCache = {
        ...cache,
        seatMap,
        lastModified: Date.now(),
        offlineModifications: (cache.offlineModifications || 0) + 1
      };
      this.writeCache(group, day, timeslot, updatedCache);

      const seatIds = assignedSeats.map(s => s.seatId);
      console.log('[OfflineSync] ローカル当日券発行処理完了:', { seatIds });
      
      return {
        success: true,
        message: `オフラインで ${numSeats} 席の当日券を発行しました`,
        seatId: seatIds.length === 1 ? seatIds[0] : undefined,
        seatIds: seatIds,
        offline: true,
        localProcessing: true,
        assignedSeats: assignedSeats,
        consecutive: consecutive
      };
    } catch (error) {
      console.error('[OfflineSync] ローカル当日券発行処理エラー:', error);
      return { success: false, error: `ローカル処理エラー: ${error.message}` };
    }
  }

  /**
   * 連続席の検索
   */
  findConsecutiveSeats(availableSeats, numSeats) {
    console.log('[OfflineSync] 連続席検索開始:', { availableSeats: availableSeats.length, numSeats });
    
    // 座席IDを数値としてソート
    const sortedSeats = availableSeats.sort((a, b) => {
      const aNum = parseInt(a.seatId.replace(/\D/g, '')) || 0;
      const bNum = parseInt(b.seatId.replace(/\D/g, '')) || 0;
      return aNum - bNum;
    });

    console.log('[OfflineSync] ソート後の座席:', sortedSeats.map(s => s.seatId));

    for (let i = 0; i <= sortedSeats.length - numSeats; i++) {
      const consecutive = sortedSeats.slice(i, i + numSeats);
      console.log(`[OfflineSync] 連続席候補 ${i}:`, consecutive.map(s => s.seatId));
      
      if (consecutive.length === numSeats) {
        console.log('[OfflineSync] 連続席発見:', consecutive.map(s => s.seatId));
        return consecutive;
      }
    }

    console.log('[OfflineSync] 連続席が見つかりませんでした');
    return [];
  }

  /**
   * キャッシュの書き込み（オフライン時専用強化版）
   */
  writeCache(group, day, timeslot, data) {
    try {
      const key = `${STORAGE_KEYS.CACHE_DATA}_${group}-${day}-${timeslot}`;
      const isOffline = !navigator.onLine;
      
      // オフライン時の座席データ保存強化
      let enhancedData = { ...data };
      if (isOffline && data.seatMap) {
        console.log('[OfflineSync] オフライン時の座席キャッシュ保存:', {
          group, day, timeslot,
          seatCount: Object.keys(data.seatMap).length
        });
        
        // 座席データの完全性を保証
        const validatedSeatMap = {};
        Object.entries(data.seatMap).forEach(([seatId, seatData]) => {
          if (seatData && typeof seatData === 'object') {
            validatedSeatMap[seatId] = {
              id: seatId,
              status: seatData.status || 'available',
              name: seatData.name || null,
              offlineModified: isOffline, // オフライン変更フラグ
              ...seatData
            };
          }
        });
        
        enhancedData.seatMap = validatedSeatMap;
        enhancedData.offlineCache = true; // オフラインキャッシュフラグ
      }
      
      const cacheData = {
        ...enhancedData,
        cachedAt: Date.now(),
        version: Date.now().toString(), // バージョン管理
        offlineSaved: isOffline // オフライン保存フラグ
      };
      
      localStorage.setItem(key, JSON.stringify(cacheData));
      
      if (isOffline) {
        console.log('[OfflineSync] オフライン座席キャッシュ保存完了:', {
          group, day, timeslot,
          seatCount: Object.keys(enhancedData.seatMap || {}).length
        });
      }
    } catch (error) {
      console.error('[OfflineSync] キャッシュ書き込みエラー:', error);
    }
  }

  /**
   * 同期状態の読み取り
   */
  loadSyncState() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SYNC_STATE);
      return data ? JSON.parse(data) : {
        retryCount: 0,
        lastSyncAttempt: 0,
        lastSuccessfulSync: 0,
        lastOnlineTime: 0,
        lastOfflineTime: 0,
        syncErrors: []
      };
    } catch (error) {
      console.error('[OfflineSync] 同期状態読み取りエラー:', error);
      return {
        retryCount: 0,
        lastSyncAttempt: 0,
        lastSuccessfulSync: 0,
        lastOnlineTime: 0,
        lastOfflineTime: 0,
        syncErrors: []
      };
    }
  }

  /**
   * 同期状態の保存
   */
  saveSyncState() {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(this.syncState));
    } catch (error) {
      console.error('[OfflineSync] 同期状態保存エラー:', error);
    }
  }

  /**
   * システムの状態を取得
   */
  getSystemStatus() {
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      retryCount: this.syncState.retryCount,
      lastSyncAttempt: this.syncState.lastSyncAttempt,
      lastSuccessfulSync: this.syncState.lastSuccessfulSync,
      lastOnlineTime: this.syncState.lastOnlineTime,
      lastOfflineTime: this.syncState.lastOfflineTime,
      syncErrors: this.syncState.syncErrors,
      queueLength: this.readOperationQueue().length,
      cacheInfo: this.getCacheInfo()
    };
  }

  /**
   * キャッシュ情報の取得
   */
  getCacheInfo() {
    const { group, day, timeslot } = this.getCurrentContext();
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

  /**
   * システムの初期化
   */
  async initialize() {
    console.log('[OfflineSync] オフライン同期システム v2.0 を初期化中...');
    
    // 初回: 現在ページの座席が未キャッシュなら最低限の雛形を用意
    try {
      const { group, day, timeslot } = this.getCurrentContext();
      if (group && day && timeslot && !this.readCache(group, day, timeslot)) {
        console.log('[OfflineSync] 初期キャッシュを作成:', { group, day, timeslot });
        this.writeCache(group, day, timeslot, { 
          seatMap: {},
          success: true,
          cachedAt: Date.now(),
          version: Date.now().toString()
        });
      }
      // オンラインであれば、主要ページで必要な座席データを事前取得
      if (this.isOnline) {
        try {
          await this.prefetchSeatDataIfPossible();
        } catch (_) {}
      }
      // 現在のコンテキストを学習
      this.trackKnownContext({ group, day, timeslot });
    } catch (error) {
      console.error('[OfflineSync] 初期化エラー:', error);
    }

    // オフラインオーバーライドを即座にインストール
    await this.installOfflineOverrides();

    // オフライン状態の確認
    if (!this.isOnline) {
      await this.handleOffline();
    }

    // オフライン状態インジケーターの初期化
    this.updateOfflineIndicator();

    // どのページでも設定から同期操作できるボタン/メニューを注入
    try { this.injectGlobalSettingsEntry(); } catch (_) {}

    // 座席データのバックグラウンド事前取得
    if (this.isOnline) {
      this.startSeatDataPrefetch();
      this.startAdminNoticePolling();
    }

    console.log('[OfflineSync] 初期化完了');
  }

  // 最高管理者向け通知のポーリング開始
  startAdminNoticePolling() {
    try {
      if (this.noticePollInterval) return;
      // 最高管理者モードのみ対象
      const mode = (localStorage.getItem('currentMode') || 'normal');
      if (mode !== 'superadmin') return;
      this.noticePollInterval = setInterval(async () => {
        try {
          if (!window.GasAPI || !window.GasAPI.fetchAdminNotices) return;
          const resp = await window.GasAPI.fetchAdminNotices(this.lastNoticeTs || 0);
          if (resp && resp.success && Array.isArray(resp.notices)) {
            for (const n of resp.notices) {
              try {
                const ts = n.timestamp || Date.now();
                this.lastNoticeTs = Math.max(this.lastNoticeTs || 0, ts);
                this.showConflictAdminNotice(n);
              } catch (_) {}
            }
          }
        } catch (_) {}
      }, this.noticePollIntervalMs);
    } catch (_) {}
  }

  stopAdminNoticePolling() {
    try { if (this.noticePollInterval) { clearInterval(this.noticePollInterval); this.noticePollInterval = null; } } catch (_) {}
  }

  // 受信通知の表示（最高管理者）
  showConflictAdminNotice(notice) {
    try {
      const msg = notice && notice.message ? notice.message : '競合が発生しました';
      const detail = notice && notice.details ? notice.details : {};
      const div = document.createElement('div');
      div.className = 'sync-failure-notification';
      div.innerHTML = `
        <div class="notification-content">
          <h4>競合警告</h4>
          <p>${msg}</p>
          ${detail && detail.operationType ? `<p>操作: ${detail.operationType}</p>` : ''}
          ${detail && detail.mode ? `<p>モード: ${detail.mode}</p>` : ''}
          ${detail && detail.timestamp ? `<p>時刻: ${new Date(detail.timestamp).toLocaleString('ja-JP')}</p>` : ''}
          <button onclick="this.parentElement.parentElement.remove()">閉じる</button>
        </div>`;
      document.body.appendChild(div);
      setTimeout(() => { try { if (div && div.parentElement) div.remove(); } catch (_) {} }, 10000);
    } catch (e) {
      try { alert('競合警告: ' + (notice && notice.message ? notice.message : '')); } catch (_) {}
    }
  }

  // 主要ページでの座席データ事前取得
  async prefetchSeatDataIfPossible() {
    try {
      const ctx = this.getCurrentContext();
      if (!ctx || !ctx.group || !ctx.day || !ctx.timeslot) {
        return; // コンテキストが不明ならスキップ
      }
      const existing = this.readCache(ctx.group, ctx.day, ctx.timeslot);
      const isStale = !existing || !existing.cachedAt || (Date.now() - existing.cachedAt) > (OFFLINE_CONFIG.CACHE_EXPIRY_MS / 2);
      if (!isStale) return;

      const gasAPI = await this.waitForGasAPI();
      const fresh = await gasAPI.getSeatDataMinimal(ctx.group, ctx.day, ctx.timeslot, false);
      if (fresh && fresh.success) {
        this.writeCache(ctx.group, ctx.day, ctx.timeslot, fresh);
        console.log('[OfflineSync] 事前取得: 座席データをキャッシュしました');
      }
    } catch (e) {
      console.warn('[OfflineSync] 事前取得に失敗:', e);
    }
  }

  // 既知のコンテキストを記録
  trackKnownContext(ctx) {
    try {
      if (!ctx || !ctx.group || !ctx.day || !ctx.timeslot) return;
      this.syncState.knownContexts = Array.isArray(this.syncState.knownContexts) ? this.syncState.knownContexts : [];
      const key = `${ctx.group}::${ctx.day}::${ctx.timeslot}`;
      const exists = this.syncState.knownContexts.some(k => k === key);
      if (!exists) {
        this.syncState.knownContexts.push(key);
        // サイズ上限
        if (this.syncState.knownContexts.length > 30) {
          this.syncState.knownContexts.splice(0, this.syncState.knownContexts.length - 30);
        }
        this.saveSyncState();
      }
    } catch (_) {}
  }

  // スプシID一覧（座席データ事前取得用）
  getSeatPrefetchSpreadsheetIds() {
    const ids = [];
    try { if (window.SPREADSHEET_ID) ids.push(window.SPREADSHEET_ID); } catch (_) {}
    try { if (window.OFFLINE_SPREADSHEET_ID) ids.push(window.OFFLINE_SPREADSHEET_ID); } catch (_) {}
    try { if (window.SPREADSHEET_IDS && Array.isArray(window.SPREADSHEET_IDS)) ids.push(...window.SPREADSHEET_IDS); } catch (_) {}
    try { if (window.SEAT_PREFETCH_IDS && Array.isArray(window.SEAT_PREFETCH_IDS)) ids.push(...window.SEAT_PREFETCH_IDS); } catch (_) {}
    return [...new Set(ids)];
  }

  // 任意スプシIDから座席データを取得しキャッシュ
  async fetchSeatDataForSpreadsheet(spreadsheetId, group, day, timeslot) {
    return new Promise((resolve, reject) => {
      try {
        const script = document.createElement('script');
        const callbackName = `seatPrefetch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        window[callbackName] = (response) => {
          try {
            document.head.removeChild(script);
          } catch (_) {}
          delete window[callbackName];
          if (response && response.success) {
            this.writeCache(group, day, timeslot, response);
            resolve(true);
          } else {
            resolve(false);
          }
        };
        const params = [group, day, timeslot, false];
        script.src = `https://script.google.com/macros/s/${spreadsheetId}/exec?callback=${callbackName}&func=getSeatDataMinimal&params=${encodeURIComponent(JSON.stringify(params))}`;
        script.onerror = () => {
          try { document.head.removeChild(script); } catch (_) {}
          delete window[callbackName];
          resolve(false);
        };
        document.head.appendChild(script);
        setTimeout(() => {
          if (window[callbackName]) {
            try { document.head.removeChild(script); } catch (_) {}
            delete window[callbackName];
            resolve(false);
          }
        }, 10000);
      } catch (e) {
        resolve(false);
      }
    });
  }

  // 事前取得の開始/停止
  startSeatDataPrefetch() {
    try {
      if (this.seatPrefetchInterval) return;
      this.seatPrefetchInterval = setInterval(async () => {
        if (!this.isOnline) return;
        const ids = this.getSeatPrefetchSpreadsheetIds();
        const contexts = (this.syncState.knownContexts || []).map(k => {
          const [group, day, timeslot] = (k || '').split('::');
          return { group, day, timeslot };
        }).filter(c => c.group && c.day && c.timeslot);
        // 現在ページも確実に含める
        const curr = this.getCurrentContext();
        if (curr && curr.group && curr.day && curr.timeslot) {
          contexts.unshift(curr);
        }
        // 最大数を制限
        const limited = contexts.slice(0, 10);
        for (const spreadsheetId of ids) {
          for (const ctx of limited) {
            try { await this.fetchSeatDataForSpreadsheet(spreadsheetId, ctx.group, ctx.day, ctx.timeslot); } catch (_) {}
          }
        }
      }, this.seatPrefetchIntervalMs);
    } catch (_) {}
  }

  stopSeatDataPrefetch() {
    try { if (this.seatPrefetchInterval) { clearInterval(this.seatPrefetchInterval); this.seatPrefetchInterval = null; } } catch (_) {}
  }

  /**
   * 左下の設定ボタンとメニューへオフライン同期の4要素を統合
   * - 全ページで設定ボタンを表示
   * - seats.html では既存の設定パネルにオフライン同期セクションを追加
   * - その他ページでは軽量モーダルに4要素のみ表示
   */
  injectGlobalSettingsEntry() {
    if (!document.getElementById('global-settings-button')) {
      const btn = document.createElement('button');
      btn.id = 'global-settings-button';
      btn.title = '設定';
      btn.setAttribute('aria-label', '設定');
      btn.className = 'global-settings-button';
      btn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12A3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66Z" fill="white"/></svg>';
      btn.onclick = () => this.openGlobalSettingsPanel();
      document.body.appendChild(btn);
    }

    // seatsページの既存設定パネルにセクションを追加（存在する場合のみ）
    this.ensureOfflineSectionInSeatSettings();

    // seats.html では既存の歯車ボタンがあるため重複回避で非表示
    try { const legacyBtn = document.getElementById('auto-refresh-settings-btn'); if (legacyBtn) legacyBtn.style.display = 'none'; } catch (_) {}
  }

  openGlobalSettingsPanel() {
    console.log('[OfflineSync] openGlobalSettingsPanel called');
    
    // seats.html の自動更新設定パネルがあればそこに統合
    if (document.getElementById('auto-refresh-settings-panel')) {
      console.log('[OfflineSync] Found auto-refresh-settings-panel, integrating with seats settings');
      try {
        // 既存のUIを開く（toggle関数があれば利用）
        try { if (window.toggleAutoRefreshSettings) { window.toggleAutoRefreshSettings(); } } catch (_) {}
        this.ensureOfflineSectionInSeatSettings(true /*focus*/);
        return;
      } catch (error) {
        console.error('[OfflineSync] Error integrating with seats settings:', error);
      }
    }

    // その他ページ: パネル形式で表示
    console.log('[OfflineSync] Showing offline sync panel for non-seats page');
    this.showOfflineSyncPanel();
  }

  showOfflineSyncPanel() {
    try {
      // 既存のモーダルがあれば削除
      const existing = document.getElementById('offline-sync-card-modal');
      if (existing) { existing.remove(); }
      
      // カードモーダルを作成（オーバーレイなし）
      const modal = document.createElement('div');
      modal.id = 'offline-sync-card-modal';
      modal.className = 'offline-sync-card-modal';
      
      try {
        modal.innerHTML = `
          <h4>オフライン同期</h4>
          <div class="offline-sync-card-controls">
            ${this.renderOfflineControlsHTML()}
          </div>
          <div class="offline-sync-card-status" id="offline-sync-status">同期状況: 待機中</div>
        `;
      } catch (error) {
        console.error('[OfflineSync] HTML generation error:', error);
        modal.innerHTML = `
          <h4>オフライン同期</h4>
          <div class="offline-sync-card-controls">
            <div class="offline-sync-controls-fallback">
              <span class="sync-status-pill">状態不明</span>
              <span class="sync-queue-pill">キュー: 0</span>
            </div>
            <button disabled class="offline-sync-card-btn">今すぐ同期</button>
            <button class="offline-sync-card-btn">詳細表示</button>
          </div>
          <div class="offline-sync-card-status" id="offline-sync-status">同期状況: エラー</div>
        `;
      }
      
      document.body.appendChild(modal);
      
      // アニメーションで表示
      setTimeout(() => {
        try {
          modal.classList.add('show');
        } catch (error) {
          console.error('[OfflineSync] Animation error:', error);
        }
      }, 10);
      
      // カード外をクリックして閉じる機能を追加
      this.addOutsideClickHandler(modal);
      
      this.hydrateOfflineControls();
    } catch (error) {
      console.error('[OfflineSync] showOfflineSyncPanel error:', error);
    }
  }

  closeOfflineSyncPanel() {
    try {
      const modal = document.getElementById('offline-sync-card-modal');
      
      if (modal) {
        modal.classList.add('scale-out');
        
        setTimeout(() => {
          try {
            modal.remove();
          } catch (error) {
            console.error('[OfflineSync] Cleanup error:', error);
          }
        }, 300);
      }
    } catch (error) {
      console.error('[OfflineSync] closeOfflineSyncPanel error:', error);
    }
  }

  // カード外をクリックして閉じるハンドラーを追加
  addOutsideClickHandler(modal) {
    const handleOutsideClick = (event) => {
      // モーダルが存在し、クリックされた要素がモーダルの外側の場合
      if (modal && !modal.contains(event.target)) {
        this.closeOfflineSyncPanel();
        // イベントリスナーを削除
        document.removeEventListener('click', handleOutsideClick);
      }
    };

    // 少し遅延してイベントリスナーを追加（モーダル表示アニメーション完了後）
    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 100);
  }

  ensureOfflineSectionInSeatSettings(scrollIntoView = false) {
    const panel = document.getElementById('auto-refresh-settings-panel');
    if (!panel) return;
    if (document.getElementById('offline-sync-settings-section')) return;

    const section = document.createElement('div');
    section.id = 'offline-sync-settings-section';
    section.style.marginTop = '12px';
    section.innerHTML = `
      <hr style="margin:10px 0;">
      <h4 style="margin:0 0 8px 0;font-size:16px;">オフライン同期</h4>
      ${this.renderOfflineControlsHTML()}`;
    panel.appendChild(section);
    this.hydrateOfflineControls();
    if (scrollIntoView) {
      try { section.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
    }
  }

  renderOfflineControlsHTML() {
    try {
      const status = this.getSystemStatus();
      const isOnline = status?.isOnline ?? navigator.onLine;
      const inProgress = status?.syncInProgress ?? false;
      const queueLen = status?.queueLength ?? 0;
      const disabled = (!isOnline) || inProgress || queueLen === 0 ? 'disabled' : '';
      
      // カードモーダル用のHTMLを返す
      return `
        <div class="offline-sync-controls-wrapper">
          <div class="offline-sync-controls-pills">
            <span id="sync-status-pill" class="sync-status-pill ${inProgress ? 'syncing' : (isOnline ? 'online' : 'offline')}">${inProgress ? '同期中' : (isOnline ? 'オンライン' : 'オフライン')}</span>
            <span id="sync-queue-pill" class="sync-queue-pill">キュー: ${queueLen}</span>
          </div>
          <button id="sync-now-btn" ${disabled} class="offline-sync-card-btn">今すぐ同期</button>
          <button id="sync-detail-btn" class="offline-sync-card-btn detail-btn">詳細表示</button>
        </div>`;
    } catch (error) {
      console.error('[OfflineSync] renderOfflineControlsHTML error:', error);
      // フォールバック用のHTML
      return `
        <div class="offline-sync-controls-wrapper">
          <div class="offline-sync-controls-pills">
            <span id="sync-status-pill" class="sync-status-pill unknown">状態不明</span>
            <span id="sync-queue-pill" class="sync-queue-pill">キュー: 0</span>
          </div>
          <button id="sync-now-btn" disabled class="offline-sync-card-btn">今すぐ同期</button>
          <button id="sync-detail-btn" class="offline-sync-card-btn detail-btn">詳細表示</button>
        </div>`;
    }
  }

    hydrateOfflineControls() {
    try {
      const syncBtn = document.getElementById('sync-now-btn');
      const detailBtn = document.getElementById('sync-detail-btn');
      
      if (syncBtn) {
        syncBtn.onclick = () => { 
          try { 
            if (window.OfflineSyncV2 && window.OfflineSyncV2.sync) {
              window.OfflineSyncV2.sync(); 
            } else {
              console.warn('[OfflineSync] OfflineSyncV2.sync not available');
            }
          } catch (error) {
            console.error('[OfflineSync] sync error:', error);
          } 
        };
      }
      
      if (detailBtn) {
        detailBtn.onclick = () => { 
          try { 
            if (window.OfflineSyncV2 && window.OfflineSyncV2.showQueueStatus) {
              window.OfflineSyncV2.showQueueStatus(); 
            } else {
              console.warn('[OfflineSync] OfflineSyncV2.showQueueStatus not available');
            }
          } catch (error) {
            console.error('[OfflineSync] showQueueStatus error:', error);
          } 
        };
      }

      // 状態の定期更新（軽量）
      const update = () => {
        try {
          const status = this.getSystemStatus();
          const isOnline = status?.isOnline ?? navigator.onLine;
          const inProgress = status?.syncInProgress ?? false;
          const queueLen = status?.queueLength ?? 0;
          const statusPill = document.getElementById('sync-status-pill');
          const queuePill = document.getElementById('sync-queue-pill');
          
          if (statusPill) {
            statusPill.textContent = inProgress ? '同期中' : (isOnline ? 'オンライン' : 'オフライン');
            statusPill.className = `sync-status-pill ${inProgress ? 'syncing' : (isOnline ? 'online' : 'offline')}`;
          }
          if (queuePill) queuePill.textContent = `キュー: ${queueLen}`;
          if (syncBtn) {
            const disabled = (!isOnline) || inProgress || queueLen === 0;
            syncBtn.disabled = disabled;
            syncBtn.style.opacity = disabled ? '0.6' : '1';
            syncBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
          }
        } catch (error) {
          console.error('[OfflineSync] update error:', error);
        }
      };
      
      update();
      // 過剰更新を避けて2秒間隔
      const intervalId = setInterval(() => {
        // DOMがなくなったら停止
        if (!document.getElementById('sync-status-pill') && !document.getElementById('offline-sync-settings-section') && !document.getElementById('offline-sync-card-modal')) {
          clearInterval(intervalId);
          return;
        }
        update();
      }, 2000);
    } catch (error) {
      console.error('[OfflineSync] hydrateOfflineControls error:', error);
    }
  }

  /**
   * 当日券モードの監視を開始
   */
  startWalkinModeMonitoring() {
    // 定期的に当日券モードかどうかをチェック
    setInterval(() => {
      this.checkWalkinMode();
    }, 5000);
  }

  /**
   * 当日券モードかどうかをチェック
   */
  checkWalkinMode() {
    const currentMode = localStorage.getItem('currentMode') || 'normal';
    const isWalkinMode = currentMode === 'walkin';
    
    if (isWalkinMode && !this.walkinSeatSyncEnabled) {
      console.log('[OfflineSync] 当日券モードを検知、空席同期を開始');
      this.startWalkinSeatSync();
    } else if (!isWalkinMode && this.walkinSeatSyncEnabled) {
      console.log('[OfflineSync] 当日券モード終了、空席同期を停止');
      this.stopWalkinSeatSync();
    }
  }

  /**
   * 当日券用の空席同期を開始
   */
  startWalkinSeatSync() {
    if (this.walkinSeatSyncEnabled) return;
    
    this.walkinSeatSyncEnabled = true;
    console.log('[OfflineSync] 当日券用空席同期を開始');
    
    // 即座に実行（現在の公演で取得）
    this.syncWalkinSeatData();
    
    // 定期的に実行
    this.walkinSeatSyncInterval = setInterval(() => {
      this.syncWalkinSeatData();
    }, this.walkinSeatSyncIntervalMs);
  }

  /**
   * 当日券用の空席同期を停止
   */
  stopWalkinSeatSync() {
    if (!this.walkinSeatSyncEnabled) return;
    
    this.walkinSeatSyncEnabled = false;
    console.log('[OfflineSync] 当日券用空席同期を停止');
    
    if (this.walkinSeatSyncInterval) {
      clearInterval(this.walkinSeatSyncInterval);
      this.walkinSeatSyncInterval = null;
    }
  }

  /**
   * 当日券用の空席データを同期
   */
  async syncWalkinSeatData() {
    if (!this.isOnline || !this.walkinSeatSyncEnabled) return;
    
    try {
      console.log('[OfflineSync] 当日券用空席データを同期中...');
      
      // 各スプシの空席データを取得
      const spreadsheetIds = this.getWalkinSpreadsheetIds();
      
      for (const spreadsheetId of spreadsheetIds) {
        try {
          await this.syncWalkinSpreadsheetSeats(spreadsheetId);
        } catch (error) {
          console.error(`[OfflineSync] スプシ ${spreadsheetId} の空席同期エラー:`, error);
        }
      }
      
      console.log('[OfflineSync] 当日券用空席データ同期完了');
    } catch (error) {
      console.error('[OfflineSync] 当日券用空席データ同期エラー:', error);
    }
  }

  /**
   * 当日券用のスプシID一覧を取得
   */
  getWalkinSpreadsheetIds() {
    // 設定からスプシID一覧を取得
    const spreadsheetIds = [];
    
    // メインのスプシID
    if (window.SPREADSHEET_ID) {
      spreadsheetIds.push(window.SPREADSHEET_ID);
    }
    
    // オフライン用のスプシID
    if (window.OFFLINE_SPREADSHEET_ID) {
      spreadsheetIds.push(window.OFFLINE_SPREADSHEET_ID);
    }
    
    // その他のスプシID（設定ファイルから取得）
    try {
      if (window.SPREADSHEET_IDS && Array.isArray(window.SPREADSHEET_IDS)) {
        spreadsheetIds.push(...window.SPREADSHEET_IDS);
      }
    } catch (error) {
      console.warn('[OfflineSync] スプシID一覧の取得に失敗:', error);
    }
    
    return [...new Set(spreadsheetIds)]; // 重複を除去
  }

  /**
   * 特定のスプシの空席データを同期
   */
  async syncWalkinSpreadsheetSeats(spreadsheetId) {
    try {
      // 空席データを取得
      const seatData = await this.fetchWalkinSeatData(spreadsheetId);
      
      if (seatData && seatData.success) {
        // ローカルストレージに保存
        const cacheKey = `walkin_seats_${spreadsheetId}`;
        const cacheData = {
          data: seatData.seatMap,
          timestamp: Date.now(),
          spreadsheetId: spreadsheetId
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        console.log(`[OfflineSync] スプシ ${spreadsheetId} の空席データをキャッシュに保存`);
      }
    } catch (error) {
      console.error(`[OfflineSync] スプシ ${spreadsheetId} の空席データ取得エラー:`, error);
    }
  }

  /**
   * 当日券用の空席データを取得
   */
  async fetchWalkinSeatData(spreadsheetId) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const callbackName = `walkinSeatCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      window[callbackName] = (response) => {
        document.head.removeChild(script);
        delete window[callbackName];
        resolve(response);
      };
      
      // 現在のコンテキストで取得
      const ctx = this.getCurrentContext();
      const params = [ctx.group || '見本演劇', ctx.day || '1', ctx.timeslot || 'A', false];
      script.src = `https://script.google.com/macros/s/${spreadsheetId}/exec?callback=${callbackName}&func=getSeatDataMinimal&params=${encodeURIComponent(JSON.stringify(params))}`;
      script.onerror = () => {
        document.head.removeChild(script);
        delete window[callbackName];
        reject(new Error('空席データの取得に失敗しました'));
      };
      
      document.head.appendChild(script);
      
      // タイムアウト設定
      setTimeout(() => {
        if (window[callbackName]) {
          document.head.removeChild(script);
          delete window[callbackName];
          reject(new Error('空席データの取得がタイムアウトしました'));
        }
      }, 10000);
    });
  }

  /**
   * キャッシュされた当日券用空席データを取得
   */
  getCachedWalkinSeatData(spreadsheetId) {
    try {
      const cacheKey = `walkin_seats_${spreadsheetId}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (cached) {
        const cacheData = JSON.parse(cached);
        const now = Date.now();
        const cacheAge = now - cacheData.timestamp;
        
        // キャッシュが1時間以内なら有効
        if (cacheAge < 3600000) {
          return cacheData.data;
        }
      }
    } catch (error) {
      console.error('[OfflineSync] キャッシュされた空席データの取得エラー:', error);
    }
    
    return null;
  }
  
  /**
   * キャッシュの有効性: ローカル座席キャッシュが空でも、当日券用キャッシュがあれば有効扱い
   */
  hasValidCacheForContext(group, day, timeslot) {
    try {
      const cache = this.readCache(group, day, timeslot);
      if (cache && cache.seatMap && Object.keys(cache.seatMap).length > 0 && cache.success !== false && cache.cachedAt && (Date.now() - cache.cachedAt) < OFFLINE_CONFIG.CACHE_EXPIRY_MS) {
        return true;
      }
      // ローカル座席キャッシュが空の場合、当日券用キャッシュの存在を確認
      const spreadsheetId = window.SPREADSHEET_ID;
      const walkinData = spreadsheetId ? this.getCachedWalkinSeatData(spreadsheetId) : null;
      return !!walkinData;
    } catch (error) {
      console.error('[OfflineSync] キャッシュ有効性チェックエラー:', error);
      return false;
    }
  }

  // メモリクリーンアップの開始
  startMemoryCleanup() {
    if (this.memoryCleanupInterval) return;
    
    this.memoryCleanupInterval = setInterval(() => {
      this.performMemoryCleanup();
    }, OFFLINE_CONFIG.MEMORY_CLEANUP_INTERVAL);
  }

  // メモリクリーンアップの停止
  stopMemoryCleanup() {
    if (this.memoryCleanupInterval) {
      clearInterval(this.memoryCleanupInterval);
      this.memoryCleanupInterval = null;
    }
  }

  // メモリクリーンアップの実行
  performMemoryCleanup() {
    try {
      // 古いキャッシュデータを削除
      const cacheData = this.readCacheData();
      const now = Date.now();
      let cleaned = 0;
      
      for (const key in cacheData) {
        if (cacheData[key].cachedAt && (now - cacheData[key].cachedAt) > OFFLINE_CONFIG.CACHE_EXPIRY_MS) {
          delete cacheData[key];
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        this.writeCacheData(cacheData);
        console.log(`[OfflineSync] メモリクリーンアップ: ${cleaned}件の古いキャッシュを削除`);
      }

      // 操作ログのサイズ制限
      const log = this.readOperationLog();
      if (log.length > 100) { // 最大100件に制限
        const trimmedLog = log.slice(-100);
        this.writeOperationLog(trimmedLog);
        console.log(`[OfflineSync] 操作ログを${log.length - 100}件削除`);
      }

      // iOS対応: ガベージコレクションを強制実行
      if (this.isIOS && window.gc) {
        window.gc();
      }
    } catch (error) {
      console.warn('[OfflineSync] メモリクリーンアップエラー:', error);
    }
  }

  // 追加: ローカルストレージの座席キャッシュを一括読み取り
  readCacheData() {
    try {
      const all = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEYS.CACHE_DATA + '_')) {
          try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            all[key] = parsed;
          } catch (_) {}
        }
      }
      return all;
    } catch (e) {
      console.warn('[OfflineSync] readCacheData 失敗:', e);
      return {};
    }
  }

  // 追加: 座席キャッシュの一括書き戻し
  writeCacheData(cacheData) {
    try {
      Object.keys(cacheData || {}).forEach((key) => {
        if (key && key.startsWith(STORAGE_KEYS.CACHE_DATA + '_')) {
          try {
            localStorage.setItem(key, JSON.stringify(cacheData[key]));
          } catch (_) {}
        }
      });
    } catch (e) {
      console.warn('[OfflineSync] writeCacheData 失敗:', e);
    }
  }
}

// グローバルインスタンスの作成
const offlineOperationManager = new OfflineOperationManager();

// グローバル関数（設定用）
window.OfflineSyncV2 = {
  // 状態管理
  getStatus: () => offlineOperationManager.getSystemStatus(),
  
  // 同期制御
  sync: () => offlineOperationManager.performSync(),
  retrySync: () => offlineOperationManager.performSync(),
  
  // 強制同期（タイムアウトを無視）
  forceSync: async () => {
    console.log('[OfflineSyncV2] 強制同期を実行');
    const queue = offlineOperationManager.readOperationQueue();
    if (queue.length === 0) {
      console.log('[OfflineSyncV2] 同期する操作がありません');
      return;
    }
    
    // 同期状態をリセット
    offlineOperationManager.syncInProgress = false;
    
    // 同期を実行
    await offlineOperationManager.performSync();
  },
  
  // キュー管理
  getQueue: () => offlineOperationManager.readOperationQueue(),
  clearQueue: () => {
    try {
      offlineOperationManager.writeOperationQueue([]);
      console.log('[OfflineSyncV2] キューをクリアしました');
      
      // 成功通知を表示
      const notification = document.createElement('div');
      notification.className = 'success-notification';
      notification.innerHTML = `
        <div class="notification-content">
          <span class="notification-icon">✓</span>
          <span class="notification-message">キューをクリアしました</span>
          <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentElement) {
          notification.remove();
        }
      }, 3000);
      
      // 現在開いているキューステータスモーダルがあれば閉じる
      const modal = document.getElementById('queue-status-modal');
      if (modal) {
        modal.remove();
      }
      
    } catch (error) {
      console.error('[OfflineSyncV2] キュークリアエラー:', error);
      alert('キューのクリアに失敗しました');
    }
  },
  
  // キャッシュ管理
  getCache: () => offlineOperationManager.getCacheInfo(),
  clearCache: () => {
    const { group, day, timeslot } = offlineOperationManager.getCurrentContext();
    if (group && day && timeslot) {
      localStorage.removeItem(`${STORAGE_KEYS.CACHE_DATA}_${group}-${day}-${timeslot}`);
      console.log('[OfflineSyncV2] キャッシュをクリアしました');
    }
  },
  
  // 操作管理
  addOperation: (operation) => offlineOperationManager.addOperation(operation),
  
  // 競合解決
  resolveConflicts: () => offlineOperationManager.resolveConflicts([]),

  // ローカル処理機能
  hasValidCacheForContext: (group, day, timeslot) => offlineOperationManager.hasValidCacheForContext(group, day, timeslot),
  shouldProcessLocally: (group, day, timeslot) => offlineOperationManager.shouldProcessLocally(group, day, timeslot),
  processLocalReservation: (group, day, timeslot, seats) => offlineOperationManager.processLocalReservation(group, day, timeslot, seats),
  processLocalCheckIn: (group, day, timeslot, seats) => offlineOperationManager.processLocalCheckIn(group, day, timeslot, seats),
  processLocalWalkinAssignment: (group, day, timeslot, numSeats, consecutive) => offlineOperationManager.processLocalWalkinAssignment(group, day, timeslot, numSeats, consecutive),

  // デバッグ機能
  debugCacheData: (group, day, timeslot) => {
    const cache = offlineOperationManager.readCache(group, day, timeslot);
    console.log('[OfflineSync] キャッシュデータ詳細:', {
      group, day, timeslot,
      cache,
      seatMapKeys: cache ? Object.keys(cache.seatMap || {}) : [],
      seatStatuses: cache && cache.seatMap ? Object.values(cache.seatMap).map(s => s.status) : []
    });
    return cache;
  },

  // キャッシュクリア機能
  clearCacheForContext: (group, day, timeslot) => {
    const key = `${STORAGE_KEYS.CACHE_DATA}_${group}-${day}-${timeslot}`;
    localStorage.removeItem(key);
    console.log('[OfflineSync] キャッシュをクリアしました:', { group, day, timeslot });
  },
  
    // キューステータスの表示
  showQueueStatus: () => {
    try {
      const queue = offlineOperationManager.readOperationQueue();
      const status = offlineOperationManager.getSystemStatus();
      
      console.log('[OfflineSyncV2] キューステータス:', {
        queueLength: queue.length,
        systemStatus: status,
        queue: queue
      });
      
      // 既存のモーダルがあれば削除
      const existingModal = document.getElementById('queue-status-modal');
      if (existingModal) {
        existingModal.remove();
        console.log('[OfflineSyncV2] 既存のモーダルを削除');
      }
      
      // モーダルを直接DOM要素として作成
      const modal = document.createElement('div');
      modal.id = 'queue-status-modal';
      
      modal.innerHTML = `
        <div class="modal-content">
          <h3>オフライン操作キュー状況</h3>
          <div class="queue-status">
            <p><strong>キュー長:</strong> ${queue.length}</p>
            <p><strong>オンライン状態:</strong> ${status.isOnline ? 'オンライン' : 'オフライン'}</p>
            <p><strong>同期状況:</strong> ${status.syncInProgress ? '同期中' : '待機中'}</p>
            <p><strong>最後の同期:</strong> ${status.lastSuccessfulSync ? new Date(status.lastSuccessfulSync).toLocaleString('ja-JP') : 'なし'}</p>
          </div>
          <div class="queue-items">
            <h4>待機中の操作 (${queue.length}件)</h4>
            ${queue.length > 0 ? queue.map(op => `
              <div class="queue-item">
                <strong>${op.type}</strong> - ${new Date(op.timestamp).toLocaleString('ja-JP')}
                <br>ステータス: ${op.status || 'pending'} (リトライ: ${op.retryCount || 0}/${OFFLINE_CONFIG.MAX_RETRY_COUNT})
              </div>
            `).join('') : '<div class="queue-item">待機中の操作はありません</div>'}
          </div>
          <div class="modal-buttons">
            <button onclick="OfflineSyncV2.sync()" ${queue.length === 0 ? 'disabled' : ''}>今すぐ同期</button>
            <button onclick="OfflineSyncV2.clearQueue()" ${queue.length === 0 ? 'disabled' : ''}>キューをクリア</button>
            <button onclick="OfflineSyncV2.closeQueueStatusModal()">閉じる</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      console.log('[OfflineSyncV2] モーダルが正常に追加されました');
      
      // モーダルクリックで閉じる機能を追加
      modal.onclick = (e) => {
        if (e.target === modal) {
          OfflineSyncV2.closeQueueStatusModal();
        }
      };
      
    } catch (error) {
      console.error('[OfflineSyncV2] showQueueStatus error:', error);
      // フォールバック: アラートで情報を表示
      const queue = offlineOperationManager.readOperationQueue();
      const status = offlineOperationManager.getSystemStatus();
      alert(`オフライン同期状況:\n\nキュー長: ${queue.length}\nオンライン状態: ${status.isOnline ? 'オンライン' : 'オフライン'}\n同期状況: ${status.syncInProgress ? '同期中' : '待機中'}`);
    }
  },

  // キューステータスモーダルを閉じる
  closeQueueStatusModal() {
    const modal = document.getElementById('queue-status-modal');
    if (modal) {
      // モーダルコンテンツにもアニメーションを適用
      const modalContent = modal.querySelector('.modal-content');
      if (modalContent) {
        modalContent.classList.add('slide-down');
      }
      modal.classList.add('fade-out');
      
      setTimeout(() => {
        modal.remove();
      }, 300);
    }
  },
  
  // デバッグ機能
  debug: async () => {
    console.log('[OfflineSyncV2] システム状態:', offlineOperationManager.getSystemStatus());
    
    // GAS接続テスト
    try {
      const gasAPI = await offlineOperationManager.waitForGasAPI();
      const testResult = await gasAPI.testApi();
      console.log('[OfflineSyncV2] GAS接続テスト:', testResult);
    } catch (error) {
      console.error('[OfflineSyncV2] GAS接続テスト失敗:', error);
    }
    
    // 現在の座席データを取得
    try {
      const gasAPI = await offlineOperationManager.waitForGasAPI();
      const { group, day, timeslot } = offlineOperationManager.getCurrentContext();
      if (group && day && timeslot) {
        const seatData = await gasAPI.getSeatDataMinimal(group, day, timeslot, false);
        console.log('[OfflineSyncV2] 現在の座席データ:', seatData);
      }
    } catch (error) {
      console.error('[OfflineSyncV2] 座席データ取得失敗:', error);
    }
  }
};

// システムの初期化（即座に開始）
(async () => {
  // DOMContentLoadedを待たずに初期化を開始
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await offlineOperationManager.initialize();
    });
  } else {
    // 既にDOMが読み込まれている場合は即座に初期化
    await offlineOperationManager.initialize();
  }
})();

// 既存の関数との互換性を保つ
function isOffline() { return !offlineOperationManager.isOnline; }
async function onOnline() { await offlineOperationManager.handleOnline(); }
async function onOffline() { await offlineOperationManager.handleOffline(); }
async function flushQueue() { await offlineOperationManager.performSync(); }
function showSyncModal() { offlineOperationManager.showSyncModal(); }
function hideSyncModal() { offlineOperationManager.hideSyncModal(); }
function readQueue() { return offlineOperationManager.readOperationQueue(); }
function writeQueue(queue) { offlineOperationManager.writeOperationQueue(queue); }
function readCache(group, day, timeslot) { return offlineOperationManager.readCache(group, day, timeslot); }
function writeCache(group, day, timeslot, data) { offlineOperationManager.writeCache(group, day, timeslot, data); }
function enqueue(operation) { offlineOperationManager.addOperation(operation); }
async function installOfflineOverrides() { await offlineOperationManager.installOfflineOverrides(); }

// 当日券用空席データ取得
function getWalkinSeatData(spreadsheetId) { return offlineOperationManager.getCachedWalkinSeatData(spreadsheetId); }
async function syncWalkinSeats() { return await offlineOperationManager.syncWalkinSeatData(); }
