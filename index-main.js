import { loadSidebar, toggleSidebar, showModeChangeModal } from './sidebar.js';    
import { DemoMode } from './config.js';

// プッシュ通知マネージャーのインスタンス
let pushNotificationManager;

(async () => {
  try {
    if (window.systemLockReady && typeof window.systemLockReady.then === 'function') {
      await window.systemLockReady;
    }
  } catch (_) {}
  // DEMOモードでクエリが無い最初のURLなら demo=1 を付与
  try { DemoMode.ensureDemoParamInLocation(); } catch (_) {}
  loadSidebar();

  // DEMOアクティブ時はindexで毎回通知を表示（セッション抑制を無効化）
  try { if (DemoMode.isActive()) DemoMode.showNotificationIfNeeded(true); } catch (_) {}

  // プッシュ通知の初期化
  initPushNotification();

  // グローバルスコープに関数を登録
  window.toggleSidebar = toggleSidebar;
  window.showModeChangeModal = showModeChangeModal;
  window.togglePushNotification = togglePushNotification;
})();

// プッシュ通知の初期化
async function initPushNotification() {
  try {
    // プッシュ通知マネージャーのインスタンスを作成
    if (typeof PushNotificationManager !== 'undefined') {
      pushNotificationManager = new PushNotificationManager();
      
      // 購読状態に応じてボタンの表示を更新
      const subscriptionButton = document.getElementById('push-notification-toggle');
      if (subscriptionButton) {
        // 購読状態が確認できるまで少し待機
        setTimeout(() => {
          updatePushButtonState();
        }, 1000);
      }
    }
  } catch (error) {
    console.error('プッシュ通知の初期化に失敗:', error);
  }
}

// プッシュ通知の購読状態に応じてボタンの表示を更新
function updatePushButtonState() {
  const subscriptionButton = document.getElementById('push-notification-toggle');
  if (!subscriptionButton || !pushNotificationManager) return;
  
  if (pushNotificationManager.isSubscribed) {
    subscriptionButton.textContent = '満席通知を無効にする';
    subscriptionButton.classList.remove('btn-primary');
    subscriptionButton.classList.add('btn-secondary');
  } else {
    subscriptionButton.textContent = '満席通知を有効にする';
    subscriptionButton.classList.remove('btn-secondary');
    subscriptionButton.classList.add('btn-primary');
  }
}

// プッシュ通知の購読/解除を切り替える
async function togglePushNotification() {
  if (!pushNotificationManager) return;
  
  try {
    const subscriptionButton = document.getElementById('push-notification-toggle');
    if (subscriptionButton) {
      subscriptionButton.disabled = true;
    }
    
    if (pushNotificationManager.isSubscribed) {
      // 購読解除
      await pushNotificationManager.unsubscribe();
    } else {
      // iOS Safariの場合、ホーム画面への追加を促す
      if (isIOSSafari() && !isInStandaloneMode()) {
        showAddToHomeScreenPrompt();
        if (subscriptionButton) {
          subscriptionButton.disabled = false;
        }
        return;
      }
      
      // 通知権限をリクエスト
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // 購読
        await pushNotificationManager.subscribe();
      }
    }
    
    // ボタンの表示を更新
    updatePushButtonState();
  } catch (error) {
    console.error('プッシュ通知の切り替えに失敗:', error);
  } finally {
    const subscriptionButton = document.getElementById('push-notification-toggle');
    if (subscriptionButton) {
      subscriptionButton.disabled = false;
    }
  }
}

// iOS Safariかどうかを判定
function isIOSSafari() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream && /Safari/.test(ua) && !/Chrome/.test(ua);
}

// スタンドアロンモード（ホーム画面から起動）かどうかを判定
function isInStandaloneMode() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

// ホーム画面への追加を促すプロンプトを表示
function showAddToHomeScreenPrompt() {
  const modal = document.getElementById('ios-homescreen-modal');
  if (modal) {
    modal.classList.add('show');
  } else {
    // モーダルがない場合はアラートで代用
    alert('iOSでプッシュ通知を受け取るには、このウェブサイトをホーム画面に追加してください。\n\n「共有」ボタンをタップし、「ホーム画面に追加」を選択してください。');
  }
}
