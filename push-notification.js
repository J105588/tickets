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
        } catch (error) {
            console.error('初期化エラー:', error);
        }
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

    // iOS向けのホーム画面追加ガイドを表示
    showIOSInstallGuide() {
        // iOSデバイスかつSafariブラウザの場合のみ表示
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

        if (isIOS && isSafari) {
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
        // iOSの場合はホーム画面追加ガイドを表示
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (isIOS) {
            this.showIOSInstallGuide();
            return false;
        }

        // 通知権限を要求
        const permissionGranted = await this.requestNotificationPermission();
        if (!permissionGranted) {
            return false;
        }

        // プッシュ通知を購読
        return await this.subscribe();
    }
}

// グローバルインスタンスを作成
const pushNotificationManager = new PushNotificationManager();

// グローバルに公開
window.pushNotificationManager = pushNotificationManager;