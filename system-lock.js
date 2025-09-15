// system-lock.js - システムロック機能
import errorHandler from './error-handler.js';

class SystemLock {
  constructor() {
    // 初回ロック確認の完了を通知するPromise
    try {
      if (!window.systemLockReady) {
        window.systemLockReady = new Promise((resolve) => {
          this._resolveReady = resolve;
        });
      }
    } catch (_) {}
    this._readyResolved = false;
    this.init();
  }

  async init() {
    // ロック状態の監視は即座に開始（他機能と同時実行）
    this.startSystemLockWatcher();
  }

  async startSystemLockWatcher() {
    try {
      const { default: GasAPI } = await import('./api.js');
      let domObserver = null;
      
      const ensureGate = () => {
        if (!document.getElementById('system-lock-gate')) {
          const gate = document.createElement('div');
          gate.id = 'system-lock-gate';
          gate.style.position = 'fixed';
          gate.style.inset = '0';
          gate.style.zIndex = '99999';
          gate.style.background = 'rgba(0,0,0,0.85)';
          gate.style.display = 'flex';
          gate.style.alignItems = 'center';
          gate.style.justifyContent = 'center';
          gate.style.pointerEvents = 'all';
          gate.innerHTML = '<div style="background:#fff;padding:24px;border-radius:8px;max-width:360px;width:90%;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.3)"><h3 style="margin:0 0 12px 0;">システムはロックされています</h3><p style="margin:0 0 16px 0;color:#555;font-size:14px;">アクセス権限がありません</p></div>';
          document.body.appendChild(gate);
        }
      };

      const resolveReadyOnce = () => {
        if (!this._readyResolved && this._resolveReady) {
          try { this._resolveReady(); } catch (_) {}
          this._readyResolved = true;
        }
      };

      let _lockCheckInFlight = false;
      const tick = async () => {
        try {
          // バックグラウンドタブではスキップ
          try { if (document && document.visibilityState === 'hidden') { return; } } catch (_) {}
          if (_lockCheckInFlight) { return; }
          _lockCheckInFlight = true;
          // オフライン時は通信を行わない
          try { if (typeof navigator !== 'undefined' && navigator && navigator.onLine === false) { return; } } catch (_) {}
          const status = await GasAPI.getSystemLock();
          if (status && status.success && status.locked) {
            ensureGate();
            // ロック中のみDOM監視を有効化
            if (!domObserver) {
              domObserver = new MutationObserver(() => {
                if (!document.getElementById('system-lock-gate')) ensureGate();
              });
              domObserver.observe(document.body, { childList: true });
            }
          } else {
            const gate = document.getElementById('system-lock-gate');
            if (gate) gate.remove();
            if (domObserver) { domObserver.disconnect(); domObserver = null; }
          }
        } catch (error) {
          errorHandler.handleError(error, 'lock', () => {
            console.warn('System lock check failed, maintaining lock state for safety');
          });
        } finally {
          _lockCheckInFlight = false;
          // 初回チェック完了を通知
          resolveReadyOnce();
        }
      };

      // 初回は即座に実行（他機能と同時実行）
      tick();
      // ポーリング間隔は30秒（低負荷）
      setInterval(tick, 30000);
    } catch (error) {
      errorHandler.handleError(error, 'lock', () => {
        console.warn('Failed to start system lock watcher, disabling lock feature');
      });
      // 例外時も待機中の初期化を解除
      if (!this._readyResolved && this._resolveReady) {
        try { this._resolveReady(); } catch (_) {}
        this._readyResolved = true;
      }
    }
  }
}

// システムロックインスタンスの作成
const systemLock = new SystemLock();

// グローバルに公開
window.systemLock = systemLock;
