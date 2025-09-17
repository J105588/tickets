// push-notification.js - Web Push API を使用したプッシュ通知機能

class PushNotificationManager {
    constructor() {
        this.swRegistration = null;
        this.isSubscribed = false;
        this.vapidPublicKey = null; // サーバーから取得するVAPID公開キー
        this.init();
    }

    async init() {
        // Service Workerのサポートチェック
        if (!('serviceWorker' in navigator)) {
            console.warn('Service Workerはサポートされていません');
            return;
        }

        // プッシュ通知のサポートチェック
        if (!('PushManager' in window)) {
            console.warn('Push通知はサポートされていません');
            return;
        }

        try {
            // Service Workerの登録を取得
            this.swRegistration = await navigator.serviceWorker.getRegistration();
            if (!this.swRegistration) {
                console.warn('Service Workerが登録されていません');
                return;
            }

            // 購読状態を確認
            this.updateSubscriptionStatus();

            // VAPID公開キーを取得（実際の実装ではサーバーから取得する）
            this.getVapidPublicKey();

            // UIの初期化
            this.initializeUI();

            // Service Workerからのメッセージを監視
            this.setupServiceWorkerMessageListener();
        } catch (error) {
            console.error('初期化エラー:', error);
        }
    }

    // Service Workerからのメッセージを監視
    setupServiceWorkerMessageListener() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'ADMIN_MODE_STATUS') {
                    this.handleAdminModeStatus(event.data.isAdmin);
                }
            });
        }
    }

    // 管理者モード状態の処理
    handleAdminModeStatus(isAdmin) {
        if (isAdmin) {
            // 管理者モードが有効な場合、通知コンテナを表示
            const container = document.getElementById('push-notification-container');
            if (container) {
                container.style.display = 'block';
            }
        } else {
            // 管理者モードが無効な場合、通知コンテナを非表示
            const container = document.getElementById('push-notification-container');
            if (container) {
                container.style.display = 'none';
            }
        }
    }

    // UIの初期化
    initializeUI() {
        // 通知コンテナを表示（管理者モードでのみ）
        this.updateNotificationContainerVisibility();

        // ボタンのイベントリスナーを設定
        const enableBtn = document.getElementById('enable-push-btn');
        const testBtn = document.getElementById('test-notification-btn');

        if (enableBtn) {
            enableBtn.addEventListener('click', () => {
                this.enablePushNotifications();
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.sendTestNotification();
            });
        }

        // 初期状態を設定
        this.updateNotificationUI(this.isSubscribed);

        // 管理者モードの変更を監視
        this.startAdminModeMonitoring();
    }

    // 管理者モードの監視を開始
    startAdminModeMonitoring() {
        // 定期的に管理者モードの状態をチェック
        this.adminModeInterval = setInterval(() => {
            this.updateNotificationContainerVisibility();
        }, 1000);

        // 管理者モードの変更イベントを監視
        this.setupAdminModeEventListeners();
    }

    // 管理者モードの変更イベントを監視
    setupAdminModeEventListeners() {
        // localStorageの変更を監視
        window.addEventListener('storage', (event) => {
            if (event.key === 'isSuperAdmin') {
                this.updateNotificationContainerVisibility();
            }
        });

        // グローバル変数の変更を監視
        let lastAdminState = window.isSuperAdmin;
        setInterval(() => {
            if (window.isSuperAdmin !== lastAdminState) {
                lastAdminState = window.isSuperAdmin;
                this.updateNotificationContainerVisibility();
            }
        }, 500);
    }

    // 通知コンテナの表示/非表示を更新
    updateNotificationContainerVisibility() {
        const container = document.getElementById('push-notification-container');
        if (!container) {
            console.log('[Admin Check] 通知コンテナが見つかりません');
            return;
        }

        // 管理者モードかどうかをチェック
        const isAdminMode = this.checkAdminMode();
        
        console.log('[Admin Check] 通知コンテナの表示状態を更新:', {
            isAdminMode: isAdminMode,
            currentDisplay: container.style.display
        });
        
        if (isAdminMode) {
            container.style.display = 'block';
            console.log('[Admin Check] 通知コンテナを表示しました');
        } else {
            container.style.display = 'none';
            console.log('[Admin Check] 通知コンテナを非表示にしました');
        }
    }

    // 管理者モードかどうかをチェック
    checkAdminMode() {
        // 複数の方法で管理者モードをチェック
        if (typeof window !== 'undefined') {
            // 1. グローバル変数でチェック
            if (window.isSuperAdmin === true) {
                console.log('[Admin Check] グローバル変数で管理者モードを検出');
                return true;
            }

            // 2. localStorageでチェック
            if (localStorage.getItem('isSuperAdmin') === 'true') {
                console.log('[Admin Check] localStorageで管理者モードを検出');
                return true;
            }

            // 3. URLパラメータでチェック
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('superadmin') === 'true') {
                console.log('[Admin Check] URLパラメータで管理者モードを検出');
                return true;
            }

            // 4. Service Workerの管理者クライアントIDでチェック
            if (this.swRegistration && this.swRegistration.active) {
                // Service Workerに管理者モードの確認を送信
                this.swRegistration.active.postMessage({
                    type: 'CHECK_ADMIN_MODE'
                });
            }

            // 5. デバッグ用: コンソールから管理者モードを有効にできる
            if (window.enableSuperAdminMode) {
                console.log('[Admin Check] デバッグ用の管理者モードが有効です');
                return true;
            }

            // デバッグ情報を出力
            console.log('[Admin Check] 管理者モード検出結果:', {
                windowIsSuperAdmin: window.isSuperAdmin,
                localStorageIsSuperAdmin: localStorage.getItem('isSuperAdmin'),
                urlSuperadmin: urlParams.get('superadmin'),
                currentUrl: window.location.href,
                enableSuperAdminMode: window.enableSuperAdminMode
            });
        }

        console.log('[Admin Check] 管理者モードではありません');
        return false;
    }

    // VAPID公開キーをサーバーから取得
    async getVapidPublicKey() {
        try {
            // 実際の実装ではサーバーからVAPID公開キーを取得する
            // 例: const response = await fetch('/api/vapid-public-key');
            // this.vapidPublicKey = await response.text();
            
            // 仮の実装（実際の実装では適切なキーに置き換える）
            this.vapidPublicKey = 'BLVYBGTnKCPj0CQCxMJ4jLRLGBGw7ede9Uhr1Cc-nkEoQJVG9kMHHR0D9OYYIb4mHNAVhK_qQdera8vUcNUYpTU';
        } catch (error) {
            console.error('VAPID公開キーの取得に失敗:', error);
        }
    }

    // 購読状態を更新
    async updateSubscriptionStatus() {
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            this.isSubscribed = subscription !== null;
            console.log('プッシュ通知購読状態:', this.isSubscribed ? '購読中' : '未購読');
        } catch (error) {
            console.error('購読状態の確認に失敗:', error);
        }
    }

    // Base64文字列をUint8Array（バイナリデータ）に変換
    urlB64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // プッシュ通知を購読
    async subscribe() {
        try {
            if (!this.swRegistration) {
                console.warn('Service Workerが登録されていません');
                return false;
            }

            if (!this.vapidPublicKey) {
                console.warn('VAPID公開キーが設定されていません');
                return false;
            }

            // 既に購読している場合は解除してから再購読
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
            }

            // 新しい購読を作成
            const applicationServerKey = this.urlB64ToUint8Array(this.vapidPublicKey);
            const newSubscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            console.log('プッシュ通知を購読しました:', newSubscription);
            this.isSubscribed = true;

            // サーバーに購読情報を送信（実際の実装ではサーバーに送信する）
            this.sendSubscriptionToServer(newSubscription);
            return true;
        } catch (error) {
            console.error('プッシュ通知の購読に失敗:', error);
            return false;
        }
    }

    // 購読を解除
    async unsubscribe() {
        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (!subscription) {
                console.warn('購読が見つかりません');
                return false;
            }

            // 購読を解除
            await subscription.unsubscribe();
            console.log('プッシュ通知の購読を解除しました');
            this.isSubscribed = false;

            // サーバーに購読解除を通知（実際の実装ではサーバーに送信する）
            this.removeSubscriptionFromServer(subscription);
            return true;
        } catch (error) {
            console.error('プッシュ通知の購読解除に失敗:', error);
            return false;
        }
    }

    // サーバーに購読情報を送信
    async sendSubscriptionToServer(subscription) {
        try {
            // GasAPIを使用して購読情報を送信
            if (typeof GasAPI !== 'undefined') {
                const response = await GasAPI.callFunction('registerPushSubscription', {
                    subscription: JSON.stringify(subscription)
                });
                console.log('サーバーに購読情報を送信しました:', response);
                return response;
            } else {
                console.log('サーバーに購読情報を送信:', subscription);
            }
        } catch (error) {
            console.error('購読情報の送信に失敗:', error);
        }
    }

    // サーバーから購読情報を削除
    async removeSubscriptionFromServer(subscription) {
        try {
            // GasAPIを使用して購読情報を削除
            if (typeof GasAPI !== 'undefined') {
                const response = await GasAPI.callFunction('unregisterPushSubscription', {
                    subscription: JSON.stringify(subscription)
                });
                console.log('サーバーから購読情報を削除しました:', response);
                return response;
            } else {
                console.log('サーバーから購読情報を削除:', subscription);
            }
        } catch (error) {
            console.error('購読情報の削除に失敗:', error);
        }
    }

    // 通知権限を要求
    async requestNotificationPermission() {
        try {
            // iOSの場合はスタンドアロンモードかどうかをチェック
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isStandalone = window.navigator.standalone === true;
            
            if (isIOS && !isStandalone) {
                console.log('iOSブラウザモードでは通知権限を要求しません');
                return false;
            }

            // 既に権限が設定されている場合はそのまま返す
            if (Notification.permission === 'granted') {
                console.log('通知権限は既に許可されています');
                return true;
            }

            if (Notification.permission === 'denied') {
                console.warn('通知権限は既に拒否されています');
                return false;
            }

            // 権限を要求
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('通知権限が許可されました');
                return true;
            } else {
                console.warn('通知権限が拒否されました');
                return false;
            }
        } catch (error) {
            console.error('通知権限の要求に失敗:', error);
            return false;
        }
    }

    // iOS向けの通知方式を改善
    async handleIOSNotifications() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone === true;

        if (isIOS) {
            // スタンドアロンモード（ホーム画面から起動）の場合
            if (isStandalone) {
                // 通常のWeb Push APIを試行
                const permissionGranted = await this.requestNotificationPermission();
                if (permissionGranted) {
                    return await this.subscribe();
                }
            } else {
                // ブラウザモードの場合、代替通知方式を使用
                return await this.setupIOSAlternativeNotifications();
            }
        }
        return false;
    }

    // iOS向けの代替通知方式（ブラウザ内通知）
    async setupIOSAlternativeNotifications() {
        // ブラウザ内での通知表示システムを設定
        this.setupInAppNotificationSystem();
        
        // 定期的なチェックでサーバーから通知を取得
        this.startIOSNotificationPolling();
        
        return true;
    }

    // アプリ内通知システムの設定
    setupInAppNotificationSystem() {
        // 通知コンテナを作成
        if (!document.getElementById('ios-notification-container')) {
            const container = document.createElement('div');
            container.id = 'ios-notification-container';
            container.className = 'ios-notification-container';
            document.body.appendChild(container);

            // スタイルを追加
            const style = document.createElement('style');
            style.textContent = `
                .ios-notification-container {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 10000;
                    max-width: 350px;
                }
                .ios-notification {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    margin-bottom: 10px;
                    padding: 16px;
                    border-left: 4px solid #007bff;
                    animation: slideInRight 0.3s ease-out;
                    position: relative;
                }
                .ios-notification-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .ios-notification-title {
                    font-weight: 600;
                    font-size: 16px;
                    color: #333;
                    margin: 0;
                }
                .ios-notification-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #666;
                    padding: 0;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ios-notification-body {
                    color: #666;
                    font-size: 14px;
                    line-height: 1.4;
                    margin: 0;
                }
                .ios-notification-actions {
                    margin-top: 12px;
                    display: flex;
                    gap: 8px;
                }
                .ios-notification-btn {
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-size: 14px;
                    cursor: pointer;
                    flex: 1;
                }
                .ios-notification-btn.secondary {
                    background: #6c757d;
                }
                @keyframes slideInRight {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
                .ios-notification.removing {
                    animation: slideOutRight 0.3s ease-in forwards;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // iOS向けの通知ポーリング開始
    startIOSNotificationPolling() {
        // 30秒ごとにサーバーから新しい通知をチェック
        setInterval(async () => {
            try {
                if (typeof GasAPI !== 'undefined') {
                    const response = await GasAPI.callFunction('getPendingNotifications', {
                        userId: this.getUserId() || 'anonymous'
                    });
                    if (response && response.notifications) {
                        response.notifications.forEach(notification => {
                            this.showIOSNotification(notification);
                        });
                    }
                }
            } catch (error) {
                console.log('通知ポーリングエラー:', error);
            }
        }, 30000);
    }

    // iOS向けの通知表示
    showIOSNotification(notification) {
        const container = document.getElementById('ios-notification-container');
        if (!container) return;

        const notificationEl = document.createElement('div');
        notificationEl.className = 'ios-notification';
        notificationEl.innerHTML = `
            <div class="ios-notification-header">
                <h4 class="ios-notification-title">${notification.title || '新しい通知'}</h4>
                <button class="ios-notification-close" onclick="this.closest('.ios-notification').classList.add('removing'); setTimeout(() => this.closest('.ios-notification').remove(), 300)">&times;</button>
            </div>
            <p class="ios-notification-body">${notification.body || notification.message || ''}</p>
            ${notification.actions ? `
                <div class="ios-notification-actions">
                    ${notification.actions.map(action => 
                        `<button class="ios-notification-btn ${action.primary ? '' : 'secondary'}" onclick="window.pushNotificationManager.handleIOSNotificationAction('${action.action}', '${notification.id || ''}')">${action.title}</button>`
                    ).join('')}
                </div>
            ` : ''}
        `;

        container.appendChild(notificationEl);

        // 5秒後に自動で閉じる
        setTimeout(() => {
            if (notificationEl.parentNode) {
                notificationEl.classList.add('removing');
                setTimeout(() => notificationEl.remove(), 300);
            }
        }, 5000);
    }

    // iOS通知のアクション処理
    handleIOSNotificationAction(action, notificationId) {
        switch (action) {
            case 'view':
                // 関連ページに移動
                window.location.href = '/seats.html';
                break;
            case 'update':
                // 更新処理
                window.location.reload();
                break;
            case 'close':
                // 通知を閉じる
                break;
        }
        
        // サーバーにアクションを通知
        if (typeof GasAPI !== 'undefined') {
            GasAPI.callFunction('handleNotificationAction', {
                notificationId: notificationId,
                action: action
            }).catch(console.error);
        }
    }

    // ユーザーIDを取得（実際の実装では適切な方法で取得）
    getUserId() {
        return localStorage.getItem('userId') || 'anonymous';
    }

    // 満席通知の自動配信を開始
    startFullAlertMonitoring() {
        // 既存の監視を停止
        if (this.fullAlertInterval) {
            clearInterval(this.fullAlertInterval);
        }

        // 30秒ごとに満席状況をチェック
        this.fullAlertInterval = setInterval(async () => {
            try {
                await this.checkFullAlertStatus();
            } catch (error) {
                console.error('満席状況のチェックに失敗:', error);
            }
        }, 30000);

        console.log('満席通知の自動監視を開始しました');
    }

    // 満席状況をチェック
    async checkFullAlertStatus() {
        try {
            if (typeof GasAPI !== 'undefined') {
                const response = await GasAPI.callFunction('checkFullAlertStatus', {
                    userId: this.getUserId()
                });
                
                if (response && response.fullAlerts) {
                    response.fullAlerts.forEach(alert => {
                        this.sendFullAlertNotification(alert);
                    });
                }
            } else {
                // GasAPIが利用できない場合のフォールバック
                console.warn('GasAPIが利用できません。ローカル通知のみ動作します。');
            }
        } catch (error) {
            console.error('満席状況の取得に失敗:', error);
            this.logNotificationError('check_full_alert', null, error);
            
            // リトライ機能
            this.scheduleRetry('checkFullAlertStatus', 60000); // 1分後にリトライ
        }
    }

    // リトライ機能
    scheduleRetry(methodName, delay) {
        if (this.retryTimeouts) {
            clearTimeout(this.retryTimeouts[methodName]);
        } else {
            this.retryTimeouts = {};
        }

        this.retryTimeouts[methodName] = setTimeout(async () => {
            try {
                console.log(`${methodName}のリトライを実行します`);
                await this[methodName]();
            } catch (error) {
                console.error(`${methodName}のリトライに失敗:`, error);
                // 指数バックオフで次回のリトライをスケジュール
                const nextDelay = Math.min(delay * 2, 300000); // 最大5分
                this.scheduleRetry(methodName, nextDelay);
            }
        }, delay);
    }

    // 満席通知を送信
    async sendFullAlertNotification(alertData) {
        try {
            const notificationData = {
                type: 'full_alert',
                title: '満席になりました',
                body: `${alertData.group} ${alertData.day}-${alertData.timeslot} が満席になりました`,
                group: alertData.group,
                day: alertData.day,
                timeslot: alertData.timeslot,
                timestamp: Date.now()
            };

            // Service Workerに満席通知を送信
            if (this.swRegistration && this.swRegistration.active) {
                this.swRegistration.active.postMessage({
                    type: 'FULL_ALERT',
                    group: alertData.group,
                    day: alertData.day,
                    timeslot: alertData.timeslot
                });
                console.log('満席通知を送信しました:', alertData);
            }

            // ローカルでも通知を表示（フォールバック）
            this.showLocalFullAlertNotification(notificationData);

            // 通知の送信ログを記録
            this.logNotificationSent('full_alert', alertData);

        } catch (error) {
            console.error('満席通知の送信に失敗:', error);
            this.logNotificationError('full_alert', alertData, error);
        }
    }

    // ローカルで満席通知を表示
    showLocalFullAlertNotification(data) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIOS) {
            // iOS向けのアプリ内通知
            this.showIOSNotification({
                title: data.title,
                body: data.body,
                id: 'full-alert-' + Date.now(),
                actions: [
                    { action: 'view', title: '確認する', primary: true },
                    { action: 'close', title: '閉じる' }
                ]
            });
        } else {
            // 通常のブラウザ通知
            if (Notification.permission === 'granted') {
                new Notification(data.title, {
                    body: data.body,
                    icon: '/icon-192x192.png',
                    tag: 'full-alert',
                    requireInteraction: true,
                    actions: [
                        { action: 'view', title: '確認する' },
                        { action: 'close', title: '閉じる' }
                    ]
                });
            }
        }
    }

    // 通知送信のログを記録
    logNotificationSent(type, data) {
        const log = {
            type: type,
            data: data,
            timestamp: Date.now(),
            success: true
        };
        
        // ローカルストレージにログを保存
        const logs = JSON.parse(localStorage.getItem('notificationLogs') || '[]');
        logs.push(log);
        
        // 最新100件のみ保持
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('notificationLogs', JSON.stringify(logs));
        console.log('通知送信ログを記録しました:', log);
    }

    // 通知エラーのログを記録
    logNotificationError(type, data, error) {
        const log = {
            type: type,
            data: data,
            error: error.message || error,
            timestamp: Date.now(),
            success: false
        };
        
        // ローカルストレージにログを保存
        const logs = JSON.parse(localStorage.getItem('notificationLogs') || '[]');
        logs.push(log);
        
        // 最新100件のみ保持
        if (logs.length > 100) {
            logs.splice(0, logs.length - 100);
        }
        
        localStorage.setItem('notificationLogs', JSON.stringify(logs));
        console.error('通知エラーログを記録しました:', log);
    }

    // 通知ログを取得
    getNotificationLogs() {
        return JSON.parse(localStorage.getItem('notificationLogs') || '[]');
    }

    // 満席通知の監視を停止
    stopFullAlertMonitoring() {
        if (this.fullAlertInterval) {
            clearInterval(this.fullAlertInterval);
            this.fullAlertInterval = null;
            console.log('満席通知の自動監視を停止しました');
        }
    }

    // iOS向けのホーム画面追加ガイドを表示（フォールバック）
    showIOSInstallGuide() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const isStandalone = window.navigator.standalone === true;

        if (isIOS && isSafari && !isStandalone) {
            const guide = document.createElement('div');
            guide.className = 'ios-install-guide';
            guide.innerHTML = `
                <div class="ios-guide-content">
                    <div class="ios-guide-header">
                        <h3>プッシュ通知を有効にするには</h3>
                        <button class="ios-guide-close" onclick="this.parentElement.parentElement.parentElement.remove()">&times;</button>
                    </div>
                    <div class="ios-guide-body">
                        <p>iOSでプッシュ通知を受け取るには、このウェブサイトをホーム画面に追加する必要があります。</p>
                        <ol>
                            <li>下部の <strong>共有</strong> ボタン <span class="ios-share-icon">↑</span> をタップ</li>
                            <li><strong>ホーム画面に追加</strong> を選択</li>
                            <li><strong>追加</strong> をタップ</li>
                            <li>ホーム画面からアプリを開いて通知を許可</li>
                        </ol>
                        <p><strong>または</strong>、現在のブラウザ内でも通知を受け取ることができます。</p>
                    </div>
                </div>
            `;

            // スタイルを追加
            const style = document.createElement('style');
            style.textContent = `
                .ios-install-guide {
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 90%;
                    max-width: 400px;
                    background: white;
                    border-radius: 10px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
                    z-index: 10000;
                    animation: slideUp 0.3s ease-out;
                }
                .ios-guide-content {
                    padding: 20px;
                }
                .ios-guide-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                .ios-guide-header h3 {
                    margin: 0;
                    font-size: 18px;
                }
                .ios-guide-close {
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                }
                .ios-guide-body p {
                    margin-bottom: 15px;
                }
                .ios-guide-body ol {
                    padding-left: 20px;
                }
                .ios-guide-body li {
                    margin-bottom: 8px;
                }
                .ios-share-icon {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    line-height: 20px;
                    text-align: center;
                    border: 1px solid #ccc;
                    border-radius: 5px;
                }
                @keyframes slideUp {
                    from {
                        transform: translate(-50%, 100%);
                        opacity: 0;
                    }
                    to {
                        transform: translate(-50%, 0);
                        opacity: 1;
                    }
                }
            `;

            document.head.appendChild(style);
            document.body.appendChild(guide);
        }
    }

    // プッシュ通知の購読を開始（ユーザーアクションから呼び出す）
    async enablePushNotifications() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIOS) {
            // iOS向けの通知方式を処理
            const result = await this.handleIOSNotifications();
            if (!result) {
                // フォールバックとしてホーム画面追加ガイドを表示
            this.showIOSInstallGuide();
            }
            if (result) {
                this.updateNotificationUI(true);
                // 満席通知の自動監視を開始
                this.startFullAlertMonitoring();
                // 自動でテスト送信を実行
                setTimeout(() => {
                    this.sendTestNotification();
                }, 2000); // 2秒後にテスト送信
            }
            return result;
        }

        // その他のプラットフォームでは通常のWeb Push APIを使用
        const permissionGranted = await this.requestNotificationPermission();
        if (!permissionGranted) {
            return false;
        }

        const subscribed = await this.subscribe();
        if (subscribed) {
            this.updateNotificationUI(true);
            // 満席通知の自動監視を開始
            this.startFullAlertMonitoring();
            // 自動でテスト送信を実行
            setTimeout(() => {
                this.sendTestNotification();
            }, 2000); // 2秒後にテスト送信
        }
        return subscribed;
    }

    // 通知UIの更新
    updateNotificationUI(isEnabled) {
        const container = document.getElementById('push-notification-container');
        const enableBtn = document.getElementById('enable-push-btn');
        const testBtn = document.getElementById('test-notification-btn');
        const statusDiv = document.getElementById('notification-status');
        const statusText = document.getElementById('status-text');

        if (container && enableBtn && testBtn && statusDiv && statusText) {
            if (isEnabled) {
                enableBtn.style.display = 'none';
                testBtn.style.display = 'block';
                statusDiv.style.display = 'block';
                statusText.textContent = '通知状態: 有効';
                statusText.style.color = '#28a745';
            } else {
                enableBtn.style.display = 'block';
                testBtn.style.display = 'none';
                statusDiv.style.display = 'block';
                statusText.textContent = '通知状態: 無効';
                statusText.style.color = '#dc3545';
            }
        }
    }

    // 試験配信を送信
    async sendTestNotification() {
        try {
            console.log('試験配信を送信中...');
            
            // 試験配信のデータ
            const testData = {
                type: 'test_notification',
                title: '試験配信',
                body: '満席通知システムのテストです。この通知が表示されれば正常に動作しています。',
                timestamp: Date.now()
            };

            // Service Workerに試験配信を送信
            if (this.swRegistration && this.swRegistration.active) {
                this.swRegistration.active.postMessage({
                    type: 'TEST_NOTIFICATION',
                    notification: JSON.stringify(testData)
                });
                console.log('Service Workerに試験配信を送信しました');
            }

            // サーバーに試験配信を送信（オプション）
            if (typeof GasAPI !== 'undefined') {
                try {
                    const response = await GasAPI.callFunction('sendTestNotification', {
                        notification: JSON.stringify(testData)
                    });
                    console.log('サーバーへの試験配信の送信結果:', response);
                } catch (serverError) {
                    console.warn('サーバーへの送信は失敗しましたが、ローカル通知は送信されます:', serverError);
                }
            }

            // ローカルでも試験通知を表示（フォールバック）
            this.showLocalTestNotification(testData);
            
            // 成功メッセージを表示
            this.showNotificationMessage('試験配信を送信しました', 'success');
            return true;
        } catch (error) {
            console.error('試験配信の送信に失敗:', error);
            this.showNotificationMessage('試験配信の送信に失敗しました', 'error');
            return false;
        }
    }

    // ローカルで試験通知を表示
    showLocalTestNotification(data) {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIOS) {
            // iOS向けのアプリ内通知
            this.showIOSNotification({
                title: data.title,
                body: data.body,
                id: 'test-' + Date.now()
            });
        } else {
            // 通常のブラウザ通知
            if (Notification.permission === 'granted') {
                new Notification(data.title, {
                    body: data.body,
                    icon: '/icon-192x192.png',
                    tag: 'test-notification'
                });
            }
        }
    }

    // 通知メッセージを表示
    showNotificationMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `notification-message ${type}`;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 10001;
            animation: slideInDown 0.3s ease-out;
            max-width: 90vw;
            text-align: center;
        `;

        const colors = {
            success: '#28a745',
            error: '#dc3545',
            info: '#007bff'
        };

        messageEl.style.backgroundColor = colors[type] || colors.info;

        messageEl.textContent = message;
        document.body.appendChild(messageEl);

        // 3秒後に自動で消す
        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.style.animation = 'slideOutUp 0.3s ease-in forwards';
                setTimeout(() => messageEl.remove(), 300);
            }
        }, 3000);
    }
}

// グローバルインスタンスを作成
const pushNotificationManager = new PushNotificationManager();

// グローバルに公開
window.pushNotificationManager = pushNotificationManager;

// デバッグ用の関数を公開
window.enableSuperAdminMode = function() {
    console.log('管理者モードを有効にしました');
    window.isSuperAdmin = true;
    localStorage.setItem('isSuperAdmin', 'true');
    pushNotificationManager.updateNotificationContainerVisibility();
};

window.disableSuperAdminMode = function() {
    console.log('管理者モードを無効にしました');
    window.isSuperAdmin = false;
    localStorage.removeItem('isSuperAdmin');
    pushNotificationManager.updateNotificationContainerVisibility();
};

window.checkAdminStatus = function() {
    console.log('現在の管理者モード状態:', pushNotificationManager.checkAdminMode());
    return pushNotificationManager.checkAdminMode();
};