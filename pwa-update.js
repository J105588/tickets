// pwa-update.js - PWA更新通知システム
class PWAUpdateManager {
    constructor() {
        this.registration = null;
        this.updateAvailable = false;
        this.updateNotification = null;
        this.loadingModal = null;
        this.init();
    }

    async init() {
        if ('serviceWorker' in navigator) {
            try {
                this.registration = await navigator.serviceWorker.register('./sw.js');
                this.setupEventListeners();
                this.checkForUpdates();
            } catch (error) {
                console.warn('Service Worker registration failed:', error);
            }
        }
    }

    setupEventListeners() {
        // Service Workerからのメッセージを監視
        navigator.serviceWorker.addEventListener('message', (event) => {
            const { type, version, timestamp } = event.data;
            
            switch (type) {
                case 'UPDATE_AVAILABLE':
                    this.handleUpdateAvailable(version, timestamp);
                    break;
                case 'RELOAD':
                    this.handleReload();
                    break;
            }
        });

        // Service Workerの更新を監視
        if (this.registration) {
            this.registration.addEventListener('updatefound', () => {
                this.handleUpdateFound();
            });
        }
    }

    async checkForUpdates() {
        if (this.registration) {
            try {
                await this.registration.update();
            } catch (error) {
                console.warn('Update check failed:', error);
            }
        }
    }

    handleUpdateFound() {
        const newWorker = this.registration.installing;
        if (newWorker) {
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    this.showUpdateNotification();
                }
            });
        }
    }

    handleUpdateAvailable(version, timestamp) {
        console.log(`Update available: ${version} at ${new Date(timestamp).toLocaleString()}`);
        this.showUpdateNotification();
    }

    showUpdateNotification() {
        if (this.updateNotification) {
            return; // 既に表示中
        }

        this.updateAvailable = true;
        this.createUpdateNotification();
    }

    createUpdateNotification() {
        // 通知要素を作成
        const notification = document.createElement('div');
        notification.id = 'pwa-update-notification';
        notification.className = 'pwa-update-notification';
        notification.innerHTML = `
            <div class="pwa-update-content">
                <div class="pwa-update-icon">
                    <div class="pwa-update-spinner"></div>
                </div>
                <div class="pwa-update-text">
                    <div class="pwa-update-title">システム更新が利用可能です</div>
                    <div class="pwa-update-description">最新の機能と改善を利用するために更新してください</div>
                </div>
                <div class="pwa-update-actions">
                    <button class="pwa-update-btn pwa-update-btn-primary" onclick="pwaUpdateManager.applyUpdate()">
                        今すぐ更新
                    </button>
                    <button class="pwa-update-btn pwa-update-btn-secondary" onclick="pwaUpdateManager.dismissUpdate()">
                        後で
                    </button>
                </div>
                <button class="pwa-update-close" onclick="pwaUpdateManager.dismissUpdate()">&times;</button>
            </div>
        `;

        // スタイルを追加
        this.addUpdateStyles();

        // DOMに追加
        document.body.appendChild(notification);

        // アニメーション表示
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        this.updateNotification = notification;

        // 監査ログに記録
        try {
            if (window.audit && window.audit.log) {
                window.audit.log('ui', 'pwa_update_notification', { 
                    action: 'show',
                    timestamp: Date.now()
                });
            }
        } catch (e) {
            console.warn('Failed to log PWA update notification:', e);
        }
    }

    addUpdateStyles() {
        if (document.getElementById('pwa-update-styles')) {
            return; // 既に追加済み
        }

        const styles = document.createElement('style');
        styles.id = 'pwa-update-styles';
        styles.textContent = `
            .pwa-update-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                max-width: 400px;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                z-index: 10000;
                transform: translateX(100%);
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.1);
            }

            .pwa-update-notification.show {
                transform: translateX(0);
                opacity: 1;
            }

            .pwa-update-content {
                padding: 20px;
                position: relative;
            }

            .pwa-update-icon {
                margin-bottom: 12px;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .pwa-update-spinner {
                width: 24px;
                height: 24px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top: 3px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }

            .pwa-update-title {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 4px;
            }

            .pwa-update-description {
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 16px;
                line-height: 1.4;
            }

            .pwa-update-actions {
                display: flex;
                gap: 8px;
                margin-bottom: 8px;
            }

            .pwa-update-btn {
                padding: 8px 16px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                flex: 1;
            }

            .pwa-update-btn-primary {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            .pwa-update-btn-primary:hover {
                background: rgba(255, 255, 255, 0.3);
                transform: translateY(-1px);
            }

            .pwa-update-btn-secondary {
                background: transparent;
                color: rgba(255, 255, 255, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.2);
            }

            .pwa-update-btn-secondary:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }

            .pwa-update-close {
                position: absolute;
                top: 12px;
                right: 12px;
                background: none;
                border: none;
                color: rgba(255, 255, 255, 0.7);
                font-size: 20px;
                cursor: pointer;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }

            .pwa-update-close:hover {
                background: rgba(255, 255, 255, 0.1);
                color: white;
            }

            .pwa-update-error-icon {
                width: 24px;
                height: 24px;
                background: rgba(255, 255, 255, 0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
                font-weight: bold;
                color: white;
            }

            .pwa-update-loading-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 20000;
                backdrop-filter: blur(5px);
            }

            .pwa-update-loading-content {
                background: white;
                padding: 40px;
                border-radius: 12px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                max-width: 300px;
                width: 90%;
            }

            .pwa-update-loading-spinner {
                width: 40px;
                height: 40px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #667eea;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 20px;
            }

            .pwa-update-loading-title {
                font-size: 18px;
                font-weight: 600;
                color: #333;
                margin-bottom: 8px;
            }

            .pwa-update-loading-description {
                font-size: 14px;
                color: #666;
                line-height: 1.4;
            }

            @media (max-width: 480px) {
                .pwa-update-notification {
                    top: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
            }
        `;

        document.head.appendChild(styles);
    }

    async applyUpdate() {
        if (!this.updateAvailable) {
            return;
        }

        try {
            // 更新中のロードモーダルを表示
            this.showUpdateLoadingModal();

            // Service Workerに更新を指示
            if (this.registration && this.registration.waiting) {
                this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            // 監査ログに記録
            try {
                if (window.audit && window.audit.log) {
                    window.audit.log('ui', 'pwa_update_notification', { 
                        action: 'apply',
                        timestamp: Date.now()
                    });
                }
            } catch (e) {
                console.warn('Failed to log PWA update apply:', e);
            }

            // 少し待ってからリロード
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (error) {
            console.error('Failed to apply update:', error);
            this.hideUpdateLoadingModal();
            this.showUpdateError();
        }
    }

    dismissUpdate() {
        if (this.updateNotification) {
            this.updateNotification.classList.remove('show');
            setTimeout(() => {
                if (this.updateNotification && this.updateNotification.parentNode) {
                    this.updateNotification.parentNode.removeChild(this.updateNotification);
                }
                this.updateNotification = null;
            }, 300);
        }

        // 監査ログに記録
        try {
            if (window.audit && window.audit.log) {
                window.audit.log('ui', 'pwa_update_notification', { 
                    action: 'dismiss',
                    timestamp: Date.now()
                });
            }
        } catch (e) {
            console.warn('Failed to log PWA update dismiss:', e);
        }
    }

    showUpdateError() {
        const notification = document.getElementById('pwa-update-notification');
        if (notification) {
            const content = notification.querySelector('.pwa-update-content');
            content.innerHTML = `
                <div class="pwa-update-icon">
                    <div class="pwa-update-error-icon">!</div>
                </div>
                <div class="pwa-update-text">
                    <div class="pwa-update-title">更新に失敗しました</div>
                    <div class="pwa-update-description">ページを手動でリロードしてください</div>
                </div>
                <div class="pwa-update-actions">
                    <button class="pwa-update-btn pwa-update-btn-primary" onclick="window.location.reload()">
                        リロード
                    </button>
                    <button class="pwa-update-btn pwa-update-btn-secondary" onclick="pwaUpdateManager.dismissUpdate()">
                        閉じる
                    </button>
                </div>
            `;
        }
    }

    showUpdateLoadingModal() {
        // 既存の通知を非表示
        if (this.updateNotification) {
            this.updateNotification.style.display = 'none';
        }

        // ロードモーダルを作成
        const loadingModal = document.createElement('div');
        loadingModal.id = 'pwa-update-loading-modal';
        loadingModal.className = 'pwa-update-loading-modal';
        loadingModal.innerHTML = `
            <div class="pwa-update-loading-content">
                <div class="pwa-update-loading-spinner"></div>
                <div class="pwa-update-loading-title">システムを更新中...</div>
                <div class="pwa-update-loading-description">最新の機能を読み込んでいます<br>しばらくお待ちください</div>
            </div>
        `;

        document.body.appendChild(loadingModal);
        this.loadingModal = loadingModal;
    }

    hideUpdateLoadingModal() {
        if (this.loadingModal && this.loadingModal.parentNode) {
            this.loadingModal.parentNode.removeChild(this.loadingModal);
            this.loadingModal = null;
        }
    }

    // 手動で更新チェック
    async manualUpdateCheck() {
        await this.checkForUpdates();
        
        // Service Workerに更新チェックを指示
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CHECK_UPDATE' });
        }
    }
}

// グローバルインスタンスを作成
window.pwaUpdateManager = new PWAUpdateManager();

// 定期的な更新チェック（5分間隔）
setInterval(() => {
    if (window.pwaUpdateManager) {
        window.pwaUpdateManager.checkForUpdates();
    }
}, 5 * 60 * 1000);

// ページ可視性変更時の更新チェック
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && window.pwaUpdateManager) {
        window.pwaUpdateManager.checkForUpdates();
    }
});

export default PWAUpdateManager;
