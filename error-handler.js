/**
 * エラーハンドリングユーティリティ
 * システム全体でエラーが発生しても支障なく動作するための機能
 */

class ErrorHandler {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorWindow = 60000; // 1分間
    this.lastErrorTime = 0;
  }

  /**
   * エラーを安全に処理
   * @param {Error} error - エラーオブジェクト
   * @param {string} context - エラーが発生したコンテキスト
   * @param {Function} fallback - フォールバック処理
   */
  handleError(error, context = 'unknown', fallback = null) {
    const now = Date.now();
    
    // エラー頻度を制限
    if (now - this.lastErrorTime < this.errorWindow) {
      this.errorCount++;
      if (this.errorCount > this.maxErrors) {
        console.warn(`Too many errors in ${this.errorWindow}ms, suppressing further errors`);
        return;
      }
    } else {
      this.errorCount = 1;
      this.lastErrorTime = now;
    }

    // エラーログ
    console.error(`[${context}] Error:`, error);
    
    // ユーザーへの通知（必要に応じて）
    this.showUserFriendlyError(error, context);
    
    // フォールバック処理
    if (fallback && typeof fallback === 'function') {
      try {
        fallback(error);
      } catch (fallbackError) {
        console.error('Fallback function also failed:', fallbackError);
      }
    }
  }

  /**
   * ユーザーフレンドリーなエラー表示
   */
  showUserFriendlyError(error, context) {
    // 重要なエラーのみユーザーに通知
    const criticalErrors = ['network', 'api', 'data'];
    if (!criticalErrors.includes(context)) {
      return;
    }

    // 既存のエラー表示があれば更新、なければ作成
    let errorContainer = document.getElementById('global-error-container');
    if (!errorContainer) {
      errorContainer = document.createElement('div');
      errorContainer.id = 'global-error-container';
      errorContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #f8d7da;
        color: #721c24;
        padding: 12px 16px;
        border: 1px solid #f5c6cb;
        border-radius: 4px;
        z-index: 10000;
        max-width: 300px;
        font-size: 14px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      `;
      document.body.appendChild(errorContainer);
    }

    const message = this.getErrorMessage(error, context);
    errorContainer.innerHTML = `
      <div style="margin-bottom: 8px;"><strong>エラーが発生しました</strong></div>
      <div style="margin-bottom: 8px;">${message}</div>
      <button onclick="this.parentElement.remove()" style="background: #721c24; color: white; border: none; padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 12px;">閉じる</button>
    `;

    // 5秒後に自動で消す
    setTimeout(() => {
      if (errorContainer && errorContainer.parentElement) {
        errorContainer.remove();
      }
    }, 5000);
  }

  /**
   * エラーメッセージを取得
   */
  getErrorMessage(error, context) {
    const messages = {
      network: 'ネットワーク接続に問題があります。インターネット接続を確認してください。',
      api: 'サーバーとの通信に失敗しました。しばらく時間をおいて再度お試しください。',
      data: 'データの読み込みに失敗しました。ページを再読み込みしてください。',
      cache: 'キャッシュの処理に失敗しました。',
      lock: 'システムロックの確認に失敗しました。',
      unknown: '予期しないエラーが発生しました。'
    };

    return messages[context] || messages.unknown;
  }

  /**
   * API呼び出しの安全なラッパー
   */
  async safeApiCall(apiFunction, ...args) {
    try {
      const result = await apiFunction(...args);
      
      // APIレスポンスのエラーチェック
      if (result && result.success === false) {
        this.handleError(new Error(result.error || 'API呼び出しに失敗しました'), 'api');
        return { success: false, error: result.error };
      }
      
      return result;
    } catch (error) {
      this.handleError(error, 'api');
      return { success: false, error: error.message };
    }
  }

  /**
   * DOM操作の安全なラッパー
   */
  safeDomOperation(operation) {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, 'dom');
      return null;
    }
  }

  /**
   * ローカルストレージの安全な操作
   */
  safeStorageOperation(operation) {
    try {
      return operation();
    } catch (error) {
      this.handleError(error, 'storage');
      return null;
    }
  }

  /**
   * ネットワーク状態の確認
   */
  checkNetworkStatus() {
    return navigator.onLine;
  }

  /**
   * オフライン時の処理
   */
  handleOffline() {
    if (!this.checkNetworkStatus()) {
      this.showUserFriendlyError(new Error('オフラインです'), 'network');
    }
  }

  /**
   * グローバルエラーハンドラーの設定
   */
  setupGlobalHandlers() {
    // 未処理のエラーをキャッチ
    window.addEventListener('error', (event) => {
      this.handleError(event.error, 'global');
    });

    // Promiseの未処理エラーをキャッチ
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(new Error(event.reason), 'promise');
      event.preventDefault();
    });

    // ネットワーク状態の監視
    window.addEventListener('online', () => {
      console.log('ネットワーク接続が復旧しました');
    });

    window.addEventListener('offline', () => {
      this.handleOffline();
    });
  }
}

// グローバルインスタンス
const errorHandler = new ErrorHandler();

// 初期化
if (typeof window !== 'undefined') {
  errorHandler.setupGlobalHandlers();
}

export default errorHandler;
