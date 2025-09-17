// api.js
import { GAS_API_URLS, DEBUG_MODE, debugLog, apiUrlManager, FEATURE_FLAGS, FULL_CAPACITY_NOTIFICATION_EMAILS } from './config.js';
import audit from './audit-logger.js';

class GasAPI {
  static async _retryWithBackoff(task, shouldRetry, opts = {}) {
    const {
      retries = 2,
      baseDelayMs = 300,
      maxDelayMs = 2000,
      jitter = true
    } = opts;
    let attempt = 0;
    let lastErr;
    while (attempt <= retries) {
      try { return await task(); } catch (e) {
        lastErr = e;
        if (!shouldRetry(e, attempt)) break;
        const exp = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));
        const delay = jitter ? Math.floor(exp * (0.5 + Math.random() * 0.5)) : exp;
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      }
    }
    throw lastErr;
  }
  static _callApiPost(functionName, params = []) {
    return new Promise(async (resolve) => {
      try {
        const urls = Array.isArray(GAS_API_URLS) && GAS_API_URLS.length > 0 ? GAS_API_URLS : [];
        const currentUrl = apiUrlManager.getCurrentUrl();
        const candidates = urls.length ? [currentUrl, ...urls.filter(u => u !== currentUrl)] : [currentUrl];

        const formParams = `func=${encodeURIComponent(functionName)}&params=${encodeURIComponent(JSON.stringify(params))}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        for (let i = 0; i < candidates.length; i++) {
          const url = candidates[i];
          try {
            const resp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: formParams,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            debugLog(`API Response (POST): ${functionName}`, data);
            return resolve(data);
          } catch (err) {
            if (i === candidates.length - 1) {
              // 最後まで失敗 → JSONP にフォールバック
              debugLog(`API POST failed, falling back to JSONP: ${functionName}`, { error: err && err.message });
              const jsonp = await this._callApi(functionName, params);
              return resolve(jsonp);
            }
          }
        }
      } catch (e) {
        try {
          const jsonp = await this._callApi(functionName, params);
          return resolve(jsonp);
        } catch (_) {
          return resolve({ success: false, error: e.message || 'POST 呼び出しに失敗しました' });
        }
      }
    });
  }
  static _callApi(functionName, params = [], options = {}) {
    return new Promise((resolve, reject) => {
      try {
        // オフライン時はオフライン同期システムに処理を委譲
        try { 
          if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) { 
            // オフライン同期システムが利用可能な場合は、オフライン操作として処理
            if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
              console.log('[API] オフライン状態を検知、オフライン同期システムに委譲');
              // オフライン同期システムに処理を委譲するための特別なレスポンス
              return resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
            } else {
              return resolve({ success: false, error: 'offline', offline: true });
            }
          } 
        } catch (_) {}
        
        // ネットワーク接続状態をより詳細にチェック
        if (typeof navigator !== 'undefined' && navigator && !navigator.onLine) {
          console.log('[API] ネットワーク接続なし、オフライン同期システムに委譲');
          if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
            return resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
          } else {
            return resolve({ success: false, error: 'offline', offline: true });
          }
        }
        
        debugLog(`API Call (JSONP): ${functionName}`, params);

        const callbackName = 'jsonpCallback_' + functionName + '_' + Date.now();
        const encodedParams = encodeURIComponent(JSON.stringify(params));
        const encodedFuncName = encodeURIComponent(functionName);
        const uaParam = (() => { try { return encodeURIComponent(navigator.userAgent || ''); } catch (_) { return ''; } })();
        
        window[callbackName] = (data) => {
          debugLog(`API Response (JSONP): ${functionName}`, data);
          try {
            try { if (timeoutId) clearTimeout(timeoutId); } catch (e) {}
            delete window[callbackName]; // コールバック関数を削除
            if (script && script.parentNode) {
              script.parentNode.removeChild(script); // スクリプトタグを削除
            }
            
            try { audit.wrapApiCall(functionName, params, data); } catch (_) {}
            
            // success: falseの場合も正常なレスポンスとして扱う
            if (data && typeof data === 'object') {
              resolve(data);
            } else {
              // エラーレスポンスでもresolveして、呼び出し側で処理
              console.warn(`Invalid API response for ${functionName}:`, data);
              resolve({ success: false, error: '無効なAPIレスポンスです', data: data });
            }
          } catch (e) {
            console.error('API response cleanup failed:', e);
            resolve({ success: false, error: 'API応答の処理中にエラーが発生しました: ' + e.message });
          }
        };

        // URL 構築（キャッシュバスター付き）
        const urls = Array.isArray(GAS_API_URLS) && GAS_API_URLS.length > 0 ? GAS_API_URLS : [];
        const cacheBuster = `_=${Date.now()}`;
        const formData = `func=${encodedFuncName}&params=${encodedParams}`;
        
        // URL管理システムから現在のURLを取得
        const currentUrl = apiUrlManager.getCurrentUrl();
        let currentUrlIndex = urls.indexOf(currentUrl);
        if (currentUrlIndex === -1) {
          currentUrlIndex = 0; // フォールバック
        }
        
        let fullUrl = `${currentUrl}?callback=${callbackName}&${formData}&userAgent=${uaParam}&${cacheBuster}`;

        const script = document.createElement('script');
        script.src = fullUrl;
        script.async = true;
        
        // タイムアウト設定（options.timeoutMs === null の場合は無限待機）
        let timeoutId = null;
        const timeoutMs = Object.prototype.hasOwnProperty.call(options, 'timeoutMs') ? options.timeoutMs : 20000;
        if (timeoutMs !== null) {
          timeoutId = setTimeout(() => {
            console.error('API call timeout:', { functionName, fullUrl });
            try {
              // 遅延応答で callback 未定義にならないよう、しばらくはNOOPを残す
              window[callbackName] = function noop() { /* late JSONP ignored */ };
              // 60秒後に完全クリーンアップ
              setTimeout(() => { try { delete window[callbackName]; } catch (_) {} }, 60000);
              if (script && script.parentNode) {
                script.parentNode.removeChild(script);
              }
            } catch (e) {}
            
            // タイムアウト時もオフライン同期システムに委譲を試行
            if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
              console.log('[API] タイムアウト、オフライン同期システムに委譲');
              resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
            } else {
              this._reportError(`JSONPタイムアウト: ${functionName}`);
              resolve({ success: false, error: `JSONPタイムアウト: ${functionName}`, timeout: true });
            }
          }, timeoutMs);
        }

        script.onerror = (error) => {
          console.error('API call error:', error, { functionName, fullUrl });
          try {
            // 現在のURLとは異なるURLを選択してフェイルオーバー
            if (Array.isArray(urls) && urls.length > 1) {
              // 現在のURLのインデックスを取得
              const currentUrl = apiUrlManager.getCurrentUrl();
              const currentUrlIndexInArray = urls.indexOf(currentUrl);
              
              // 現在のURLとは異なるURLを選択
              let nextUrlIndex;
              do {
                nextUrlIndex = Math.floor(Math.random() * urls.length);
              } while (nextUrlIndex === currentUrlIndexInArray && urls.length > 1);
              
              const nextUrl = `${urls[nextUrlIndex]}?callback=${callbackName}&${formData}&userAgent=${uaParam}&${cacheBuster}`;
              console.warn('Failing over to different GAS url:', nextUrl);
              script.src = nextUrl;
              return; // タイムアウトは継続
            }

            delete window[callbackName];
            if (script && script.parentNode) {
              script.parentNode.removeChild(script);
            }
            clearTimeout(timeoutId);
            
            // より詳細なエラー情報を提供
            const errorDetails = {
              functionName,
              fullUrl,
              errorType: 'script_error',
              timestamp: new Date().toISOString()
            };
            console.error('API call failed details:', errorDetails);
            
            // エラー時もオフライン同期システムに委譲を試行
            if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
              console.log('[API] エラー、オフライン同期システムに委譲');
              resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
            } else {
              this._reportError(`JSONPリクエストに失敗しました: ${functionName} (詳細: ${JSON.stringify(errorDetails)})`);
              resolve({ success: false, error: `JSONPリクエストに失敗しました: ${functionName}`, details: errorDetails });
            }
          } catch (e) {
            console.error('API error cleanup failed:', e);
            resolve({ success: false, error: 'APIエラー処理中に例外が発生しました: ' + e.message });
          }
        };
        
        const execute = () => (document.head || document.body || document.documentElement).appendChild(script);

        if (FEATURE_FLAGS.apiRetryEnabled) {
          // JSONPはエラー時 onerror でフェイルオーバー、ここでは初回実行のみ
          try { execute(); } catch (e) { /* noop */ }
        } else {
          try { execute(); } catch (e) { /* noop */ }
        }
      } catch (err) {
        console.error('API call exception:', err);
        // 例外時もオフライン同期システムに委譲を試行
        if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
          console.log('[API] 例外、オフライン同期システムに委譲');
          resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
        } else {
          this._reportError(`API呼び出し例外: ${err.message}`);
          resolve({ success: false, error: `API呼び出し例外: ${err.message}`, exception: true });
        }
      }
    });
  }

  static getSystemLock() {
    return this._callApi('getSystemLock', []);
  }

  static setSystemLock(shouldLock, password) {
    return this._callApi('setSystemLock', [shouldLock === true, password || '']);
  }

  static _reportError(errorMessage) {
    // オフライン時は報告しない（通信しない）
    try { if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) { return; } } catch (_) {}
    // エラー詳細をコンソールに出力
    console.error('API Error Details:', {
      message: errorMessage,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
    
    // UIにエラーメッセージを表示
    try {
      const errorContainer = document.getElementById('error-container');
      const errorMessageElement = document.getElementById('error-message');
      
      if (errorContainer && errorMessageElement) {
        errorMessageElement.textContent = 'サーバー通信失敗: ' + errorMessage;
        errorContainer.style.display = 'flex';
      }
    } catch (e) {
      console.error('エラー表示に失敗しました:', e);
    }
    
    // エラー報告APIを呼び出す（ただし、エラーが発生している場合はスキップ）
    try {
      const callbackName = 'jsonpCallback_reportError_' + Date.now();
      const script = document.createElement('script');
      
      window[callbackName] = (data) => {
        try {
          delete window[callbackName]; // コールバック関数を削除
          if (script && script.parentNode) {
            script.parentNode.removeChild(script); // スクリプトタグを削除
          }
          console.log('Error reported to server:', data);
        } catch (e) {
          console.error('Error cleanup failed:', e);
        }
      };

      const currentUrl = apiUrlManager.getCurrentUrl();
      let url = `${currentUrl}?callback=${callbackName}&func=reportError&params=${encodeURIComponent(JSON.stringify([errorMessage]))}&userAgent=${encodeURIComponent(navigator.userAgent || '')}`;
      script.src = url;
      document.head.appendChild(script);
    } catch (e) {
      console.error('Error reporting failed:', e);
    }
  }

  static async getAllTimeslotsForGroup(group) {
    const response = await this._callApi('getAllTimeslotsForGroup', [group]);
    return response.data; // データを返す
  }

  static async testApi() {
    const response = await this._callApi('testApi');
    return response.data;
  }

  static async verifyModePassword(mode, password) {
    const response = await this._callApi('verifyModePassword', [mode, password]);
    return response;
  }

  static async getSeatData(group, day, timeslot, isAdmin, isSuperAdmin = false) {
    const response = await this._callApi('getSeatData', [group, day, timeslot, isAdmin, isSuperAdmin]);
    return response;
  }

  static async assignWalkInSeat(group, day, timeslot) {
    const response = await this._callApi('assignWalkInSeat', [group, day, timeslot]);
    return response;
  }

  static async reserveSeats(group, day, timeslot, selectedSeats) {
    const response = await this._callApi('reserveSeats', [group, day, timeslot, selectedSeats]);
    return response;
  }

  static async checkInSeat(group, day, timeslot, seatId) {
    const response = await this._callApi('checkInSeat', [group, day, timeslot, seatId]);
    return response;
  }

  static async checkInMultipleSeats(group, day, timeslot, seatIds) {
    const response = await this._callApi('checkInMultipleSeats', [group, day, timeslot, seatIds]);
    return response;
  }

  static async assignWalkInSeats(group, day, timeslot, count) {
    const response = await this._callApi('assignWalkInSeats', [group, day, timeslot, count]);
    return response;
  }

  static async assignWalkInConsecutiveSeats(group, day, timeslot, count) {
    const response = await this._callApi('assignWalkInConsecutiveSeats', [group, day, timeslot, count]);
    return response;
  }

  static async updateSeatData(group, day, timeslot, seatId, columnC, columnD, columnE) {
    const response = await this._callApi('updateSeatData', [group, day, timeslot, seatId, columnC, columnD, columnE]);
    return response;
  }

  // 最適化された座席データ取得（最小限のデータ）
  static async getSeatDataMinimal(group, day, timeslot, isAdmin = false) {
    const response = await this._callApi('getSeatDataMinimal', [group, day, timeslot, isAdmin]);
    return response;
  }

  // 複数座席の一括更新
  static async updateMultipleSeats(group, day, timeslot, updates) {
    const response = await this._callApi('updateMultipleSeats', [group, day, timeslot, updates]);
    return response;
  }

  // GASの疎通テスト用関数
  static async testGASConnection() {
    try {
      console.log('GAS疎通テスト開始...');
      const response = await this._callApi('testApi');
      console.log('GAS疎通テスト成功:', response);
      return { success: true, data: response };
    } catch (error) {
      console.error('GAS疎通テスト失敗:', error);
      return { success: false, error: error.message };
    }
  }

  // デバッグ用関数
  static async debugSpreadsheetStructure(group, day, timeslot) {
    return this._callApi('debugSpreadsheetStructure', [group, day, timeslot]);
  }

  // 管理者向け通知をサーバー経由でブロードキャスト
  static async broadcastAdminNotice(message, details) {
    try {
      return await this._callApi('broadcastAdminNotice', [message, details || {}]);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // 管理者向け通知を取得（ポーリング）
  static async fetchAdminNotices(sinceTimestamp) {
    if (!FEATURE_FLAGS.adminNoticesEnabled) {
      return { success: false, error: 'adminNotices disabled' };
    }
    try {
      const resp = await this._callApi('fetchAdminNotices', [sinceTimestamp || 0]);
      return resp;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // URL管理システムの情報を取得
  static getUrlManagerInfo() {
    return apiUrlManager.getCurrentUrlInfo();
  }

  // 手動でURLをランダム選択
  static selectRandomUrl() {
    apiUrlManager.selectRandomUrl();
    return apiUrlManager.getCurrentUrlInfo();
  }

  // 利用可能なURL一覧を取得
  static getAllUrls() {
    return apiUrlManager.getAllUrls();
  }

  // 満席検知機能
  static async getFullCapacityTimeslots() {
    const response = await this._callApi('getFullCapacityTimeslots', [], { timeoutMs: null });
    return response;
  }

  // 満席通知設定
  static async setFullCapacityNotification(email, enabled = true) {
    const response = await this._callApi('setFullCapacityNotification', [email, enabled]);
    return response;
  }

  // 満席通知設定取得
  static async getFullCapacityNotificationSettings() {
    const response = await this._callApi('getFullCapacityNotificationSettings', []);
    return response;
  }

  // 強化されたステータス監視システム用の新しいAPI
  static async sendStatusNotificationEmail(emailData) {
    try {
      const hardcodedList = Array.isArray(FULL_CAPACITY_NOTIFICATION_EMAILS) ? FULL_CAPACITY_NOTIFICATION_EMAILS : [];
      const provided = (emailData && Array.isArray(emailData.emails)) ? emailData.emails : [];
      const merged = Array.from(new Set([
        ...hardcodedList.map(e => String(e || '').trim()).filter(Boolean),
        ...provided.map(e => String(e || '').trim()).filter(Boolean)
      ]));

      if (!merged.length) {
        const err = '通知先メールアドレスが設定されていません';
        this._reportError(err);
        return { success: false, error: err };
      }

      const sanitizeNumber = (v, d = 0) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : d;
      };
      const payload = { ...(emailData || {}), emails: merged };
      // 統計/サマリーの安全化
      if (payload.statistics && typeof payload.statistics === 'object') {
        payload.statistics = {
          totalChecks: sanitizeNumber(payload.statistics.totalChecks, 0),
          totalNotifications: sanitizeNumber(payload.statistics.totalNotifications, 0),
          averageEmptySeats: sanitizeNumber(payload.statistics.averageEmptySeats, 0),
          lastCheckTime: payload.statistics.lastCheckTime || null
        };
      }
      if (payload.summary && typeof payload.summary === 'object') {
        payload.summary = {
          totalTimeslots: sanitizeNumber(payload.summary.totalTimeslots, 0),
          fullCapacity: sanitizeNumber(payload.summary.fullCapacity, 0),
          criticalCapacity: sanitizeNumber(payload.summary.criticalCapacity, 0),
          warningCapacity: sanitizeNumber(payload.summary.warningCapacity, 0),
          normalCapacity: sanitizeNumber(payload.summary.normalCapacity, 0),
          totalSeats: sanitizeNumber(payload.summary.totalSeats, 0),
          totalOccupied: sanitizeNumber(payload.summary.totalOccupied, 0),
          totalEmpty: sanitizeNumber(payload.summary.totalEmpty, 0)
        };
      }

      const shouldRetry = (err, attempt) => {
        const msg = (err && err.message) || '';
        // success:false や timeout を含む場合はリトライ対象
        return attempt < 3 && /timeout|offline|fail|HTTP|script_error|JSONP|network/i.test(msg);
      };

      const task = async () => {
        const resp = await this._callApi('sendStatusNotificationEmail', [payload], { timeoutMs: null });
        if (!resp || resp.success === false) {
          const errMsg = (resp && (resp.error || resp.message)) || 'メール送信に失敗しました';
          throw new Error(errMsg);
        }
        return resp;
      };

      const response = await this._retryWithBackoff(task, shouldRetry, { retries: 3, baseDelayMs: 500, maxDelayMs: 3000, jitter: true });
      return response;
    } catch (e) {
      const finalMsg = `通知メール送信に失敗しました: ${e.message || e}`;
      try { this._reportError(finalMsg); } catch (_) {}
      return { success: false, error: finalMsg };
    }
  }

  static async getDetailedCapacityAnalysis(group = null, day = null, timeslot = null) {
    const response = await this._callApi('getDetailedCapacityAnalysis', [group, day, timeslot], { timeoutMs: null });
    return response;
  }

  static async getCapacityStatistics() {
    const response = await this._callApi('getCapacityStatistics', [], { timeoutMs: null });
    return response;
  }

  // 危険コマンド実行
}

export default GasAPI;

// Expose GasAPI to window for non-module consumers (e.g., OfflineSync waiters)
if (typeof window !== 'undefined') {
  try { window.GasAPI = GasAPI; } catch (_) {}
}

// 安全なコンソールコマンド（最高管理者パスワードが必要）
if (typeof window !== 'undefined') {
  window.SeatApp = window.SeatApp || {};
  window.SeatApp.lock = async (password) => {
    if (!password) { console.warn('SeatApp.lock requires superadmin password'); return; }
    return GasAPI.setSystemLock(true, password);
  };
  window.SeatApp.unlock = async (password) => {
    if (!password) { console.warn('SeatApp.unlock requires superadmin password'); return; }
    return GasAPI.setSystemLock(false, password);
  };
  window.SeatApp.status = async () => GasAPI.getSystemLock();
  // 危険コマンド（ブラウザコンソール専用）
  window.SeatApp.exec = async (action, payload, password) => {
    return GasAPI._callApi('execDangerCommand', [action, payload, password]);
  };
  
  // URL管理システムのコンソールコマンド
  window.SeatApp.urlInfo = () => GasAPI.getUrlManagerInfo();
  window.SeatApp.selectRandomUrl = () => GasAPI.selectRandomUrl();
  window.SeatApp.getAllUrls = () => GasAPI.getAllUrls();
}


