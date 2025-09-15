// optimized-api.js - 最適化されたAPIクラス
import { GAS_API_URLS, DEBUG_MODE, debugLog, apiUrlManager } from './config.js';
import audit from './audit-logger.js';
import apiCache from './api-cache.js';

class OptimizedGasAPI {
  static _callApi(functionName, params = []) {
    return new Promise((resolve, reject) => {
      try {
        // オフライン時はオフライン同期システムに処理を委譲
        try { 
          if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) { 
            if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
              console.log('[Optimized API] オフライン状態を検知、オフライン同期システムに委譲');
              return resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
            } else {
              return resolve({ success: false, error: 'offline', offline: true });
            }
          } 
        } catch (_) {}
        
        // ネットワーク接続状態をチェック
        if (typeof navigator !== 'undefined' && navigator && !navigator.onLine) {
          console.log('[Optimized API] ネットワーク接続なし、オフライン同期システムに委譲');
          if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
            return resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
          } else {
            return resolve({ success: false, error: 'offline', offline: true });
          }
        }
        
        debugLog(`Optimized API Call: ${functionName}`, params);

        const callbackName = 'jsonpCallback_' + functionName + '_' + Date.now();
        const encodedParams = encodeURIComponent(JSON.stringify(params));
        const encodedFuncName = encodeURIComponent(functionName);
        const uaParam = (() => { try { return encodeURIComponent(navigator.userAgent || ''); } catch (_) { return ''; } })();
        
        window[callbackName] = (data) => {
          debugLog(`Optimized API Response: ${functionName}`, data);
          try {
            try { clearTimeout(timeoutId); } catch (e) {}
            delete window[callbackName];
            if (script && script.parentNode) {
              script.parentNode.removeChild(script);
            }
            
            if (data && typeof data === 'object') {
              try { audit.wrapApiCall(functionName, params, data); } catch (_) {}
              resolve(data);
            } else {
              console.warn(`Invalid API response for ${functionName}:`, data);
              resolve({ success: false, error: '無効なAPIレスポンスです', data: data });
            }
          } catch (e) {
            console.error('API response cleanup failed:', e);
            resolve({ success: false, error: 'API応答の処理中にエラーが発生しました: ' + e.message });
          }
        };

        const urls = Array.isArray(GAS_API_URLS) && GAS_API_URLS.length > 0 ? GAS_API_URLS : [];
        const cacheBuster = `_=${Date.now()}`;
        const formData = `func=${encodedFuncName}&params=${encodedParams}`;
        
        const currentUrl = apiUrlManager.getCurrentUrl();
        let currentUrlIndex = urls.indexOf(currentUrl);
        if (currentUrlIndex === -1) {
          currentUrlIndex = 0;
        }
        
        let fullUrl = `${currentUrl}?callback=${callbackName}&${formData}&userAgent=${uaParam}&${cacheBuster}`;

        const script = document.createElement('script');
        script.src = fullUrl;
        script.async = true;
        
        let timeoutId = setTimeout(() => {
          console.error('API call timeout:', { functionName, fullUrl });
          try {
            window[callbackName] = function noop() { /* late JSONP ignored */ };
            setTimeout(() => { try { delete window[callbackName]; } catch (_) {} }, 60000);
            if (script && script.parentNode) {
              script.parentNode.removeChild(script);
            }
          } catch (e) {}
          
          if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
            console.log('[Optimized API] タイムアウト、オフライン同期システムに委譲');
            resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
          } else {
            resolve({ success: false, error: `JSONPタイムアウト: ${functionName}`, timeout: true });
          }
        }, 10000); // API通信最優先: タイムアウトを10秒に短縮

        script.onerror = (error) => {
          console.error('API call error:', error, { functionName, fullUrl });
          try {
            if (Array.isArray(urls) && urls.length > 1) {
              const currentUrl = apiUrlManager.getCurrentUrl();
              const currentUrlIndexInArray = urls.indexOf(currentUrl);
              
              let nextUrlIndex;
              do {
                nextUrlIndex = Math.floor(Math.random() * urls.length);
              } while (nextUrlIndex === currentUrlIndexInArray && urls.length > 1);
              
              const nextUrl = `${urls[nextUrlIndex]}?callback=${callbackName}&${formData}&userAgent=${uaParam}&${cacheBuster}`;
              console.warn('Failing over to different GAS url:', nextUrl);
              script.src = nextUrl;
              return;
            }

            delete window[callbackName];
            if (script && script.parentNode) {
              script.parentNode.removeChild(script);
            }
            clearTimeout(timeoutId);
            
            if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
              console.log('[Optimized API] エラー、オフライン同期システムに委譲');
              resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
            } else {
              resolve({ success: false, error: `JSONPリクエストに失敗しました: ${functionName}` });
            }
          } catch (e) {
            console.error('API error cleanup failed:', e);
            resolve({ success: false, error: 'APIエラー処理中に例外が発生しました: ' + e.message });
          }
        };
        
        (document.head || document.body || document.documentElement).appendChild(script);
      } catch (err) {
        console.error('API call exception:', err);
        if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
          console.log('[Optimized API] 例外、オフライン同期システムに委譲');
          resolve({ success: false, error: 'offline_delegate', offline: true, functionName, params });
        } else {
          resolve({ success: false, error: `API呼び出し例外: ${err.message}`, exception: true });
        }
      }
    });
  }

  // キャッシュ対応のAPI呼び出し
  static async _callApiWithCache(functionName, params = []) {
    return apiCache.deduplicateRequest(functionName, params, () => {
      return this._callApi(functionName, params);
    });
  }

  // 最適化された座席データ取得
  static async getSeatData(group, day, timeslot, isAdmin, isSuperAdmin = false) {
    const params = [group, day, timeslot, isAdmin, isSuperAdmin];
    return this._callApiWithCache('getSeatData', params);
  }

  // 最適化された座席データ取得（最小限）
  static async getSeatDataMinimal(group, day, timeslot, isAdmin = false) {
    const params = [group, day, timeslot, isAdmin];
    return this._callApiWithCache('getSeatDataMinimal', params);
  }

  // 最適化された時間帯データ取得
  static async getAllTimeslotsForGroup(group) {
    const params = [group];
    const response = await this._callApiWithCache('getAllTimeslotsForGroup', params);
    return response.data;
  }

  // システムロック状態取得（短いキャッシュ時間）
  static async getSystemLock() {
    const params = [];
    return this._callApiWithCache('getSystemLock', params);
  }

  // システムロック設定（キャッシュクリア）
  static async setSystemLock(shouldLock, password) {
    const response = await this._callApi('setSystemLock', [shouldLock === true, password || '']);
    // システムロック変更時はキャッシュをクリア
    apiCache.clearFunctionCache('getSystemLock');
    return response;
  }

  // 座席予約（キャッシュクリア）
  static async reserveSeats(group, day, timeslot, selectedSeats) {
    const response = await this._callApi('reserveSeats', [group, day, timeslot, selectedSeats]);
    // 座席データ変更時はキャッシュをクリア
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // チェックイン（キャッシュクリア）
  static async checkInSeat(group, day, timeslot, seatId) {
    const response = await this._callApi('checkInSeat', [group, day, timeslot, seatId]);
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // 複数座席チェックイン（キャッシュクリア）
  static async checkInMultipleSeats(group, day, timeslot, seatIds) {
    const response = await this._callApi('checkInMultipleSeats', [group, day, timeslot, seatIds]);
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // 当日券割り当て（キャッシュクリア）
  static async assignWalkInSeat(group, day, timeslot) {
    const response = await this._callApi('assignWalkInSeat', [group, day, timeslot]);
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // 複数当日券割り当て（キャッシュクリア）
  static async assignWalkInSeats(group, day, timeslot, count) {
    const response = await this._callApi('assignWalkInSeats', [group, day, timeslot, count]);
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // 連続座席当日券割り当て（キャッシュクリア）
  static async assignWalkInConsecutiveSeats(group, day, timeslot, count) {
    const response = await this._callApi('assignWalkInConsecutiveSeats', [group, day, timeslot, count]);
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // 座席データ更新（キャッシュクリア）
  static async updateSeatData(group, day, timeslot, seatId, columnC, columnD, columnE) {
    const response = await this._callApi('updateSeatData', [group, day, timeslot, seatId, columnC, columnD, columnE]);
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // 複数座席一括更新（キャッシュクリア）
  static async updateMultipleSeats(group, day, timeslot, updates) {
    const response = await this._callApi('updateMultipleSeats', [group, day, timeslot, updates]);
    apiCache.clearFunctionCache('getSeatData');
    apiCache.clearFunctionCache('getSeatDataMinimal');
    return response;
  }

  // その他のメソッド（キャッシュなし）
  static async testApi() {
    const response = await this._callApi('testApi');
    return response.data;
  }

  static async verifyModePassword(mode, password) {
    return this._callApi('verifyModePassword', [mode, password]);
  }

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

  static async debugSpreadsheetStructure(group, day, timeslot) {
    return this._callApi('debugSpreadsheetStructure', [group, day, timeslot]);
  }

  static async broadcastAdminNotice(message, details) {
    try {
      return await this._callApi('broadcastAdminNotice', [message, details || {}]);
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  static async fetchAdminNotices(sinceTimestamp) {
    try {
      const resp = await this._callApi('fetchAdminNotices', [sinceTimestamp || 0]);
      return resp;
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  // URL管理システム
  static getUrlManagerInfo() {
    return apiUrlManager.getCurrentUrlInfo();
  }

  static selectRandomUrl() {
    apiUrlManager.selectRandomUrl();
    return apiUrlManager.getCurrentUrlInfo();
  }

  static getAllUrls() {
    return apiUrlManager.getAllUrls();
  }

  // キャッシュ管理
  static clearCache() {
    apiCache.clearAll();
  }

  static getCacheStats() {
    return apiCache.getStats();
  }
}

export default OptimizedGasAPI;

// グローバルに公開（後方互換性のため）
if (typeof window !== 'undefined') {
  try { window.GasAPI = OptimizedGasAPI; } catch (_) {}
}
