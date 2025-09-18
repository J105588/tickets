/**
 * 当日券発行画面のメイン処理
 */

import GasAPI from './api.js'; // GasAPIをインポート
import { DemoMode } from './config.js';
import { loadSidebar, toggleSidebar, showModeChangeModal, applyModeChange, closeModeModal } from './sidebar.js';

// URLパラメータ取得
const urlParams = new URLSearchParams(window.location.search);
const requestedGroup = urlParams.get('group') || '';
// ガード：DEMOモード時に見本演劇以外は拒否
DemoMode.guardGroupAccessOrRedirect(requestedGroup, `walkin.html?group=${encodeURIComponent(DemoMode.demoGroup)}&day=${urlParams.get('day')||'1'}&timeslot=${urlParams.get('timeslot')||'A'}`);
// DEMOモード時は見本演劇を強制
let GROUP = DemoMode.enforceGroup(requestedGroup);
const DAY = urlParams.get('day');
const TIMESLOT = urlParams.get('timeslot');

// ゲネプロモード時の時間帯・グループ偽装
const DISPLAY_TIMESLOT = TIMESLOT; // 表示用の時間帯
const ACTUAL_TIMESLOT = DemoMode.enforceGeneproTimeslot(TIMESLOT); // 実際にAPIで使用する時間帯
const ACTUAL_GROUP = DemoMode.enforceGeneproGroupForAPI(GROUP); // 実際にAPIで使用するグループ

let _isIssuingWalkin = false;

// 初期化
window.onload = async () => {
  try {
    if (window.systemLockReady && typeof window.systemLockReady.then === 'function') {
      await window.systemLockReady;
    }
  } catch (_) {}
  
  // サイドバー読み込み
  loadSidebar();
  // DEMO/ゲネプロモードアクティブ時に通知
  try { 
    if (DemoMode.isActive() || DemoMode.isGeneproActive()) {
      DemoMode.showNotificationIfNeeded();
    }
  } catch (_) {}
  
  // 表示情報設定
  const groupName = isNaN(parseInt(GROUP)) ? GROUP : GROUP + '組';
  const displayTimeslot = DemoMode.isGeneproActive() ? DISPLAY_TIMESLOT : TIMESLOT;
  document.getElementById('performance-info').textContent = `${groupName} ${DAY}日目 ${displayTimeslot}`;
  document.getElementById('reservation-details').innerHTML = `
    座席が確保されました<br>
    ${groupName} ${DAY}日目 ${displayTimeslot}
  `;
  
  // 当日券モードのアクセス制限をチェック
  const hasAccess = checkWalkinModeAccess();
  
  // アクセス権限がない場合は、以降の処理をスキップ
  if (!hasAccess) {
    return;
  }
  
  // モード変更時のイベントリスナーを追加
  window.addEventListener('storage', (e) => {
    if (e.key === 'currentMode') {
      const newHasAccess = checkWalkinModeAccess();
      if (!newHasAccess) {
        return; // アクセス権限がなくなった場合は自動的にリダイレクトされる
      }
    }
  });

  // 枚数 +/- ボタンイベント
  const input = document.getElementById('walkin-count');
  const decBtn = document.getElementById('qty-decrease');
  const incBtn = document.getElementById('qty-increase');
  const min = parseInt(input?.getAttribute('min') || '1', 10);
  const max = parseInt(input?.getAttribute('max') || '6', 10);

  const clamp = (v) => Math.max(min, Math.min(max, v));

  if (decBtn && input) {
    decBtn.addEventListener('click', () => {
      const current = parseInt(input.value || '1', 10) || 1;
      input.value = String(clamp(current - 1));
      input.dispatchEvent(new Event('change'));
    });
  }
  if (incBtn && input) {
    incBtn.addEventListener('click', () => {
      const current = parseInt(input.value || '1', 10) || 1;
      input.value = String(clamp(current + 1));
      input.dispatchEvent(new Event('change'));
    });
  }
  if (input) {
    input.addEventListener('input', () => {
      const v = parseInt(input.value || '1', 10);
      if (isNaN(v)) {
        input.value = String(min);
      } else {
        input.value = String(clamp(v));
      }
    });
  }

  // オフラインインジケーター初期化（軽量処理）
  initializeOfflineIndicator();
};

// 当日券モードのアクセス制限をチェックする関数
function checkWalkinModeAccess() {
  const currentMode = localStorage.getItem('currentMode');
  
  if (currentMode !== 'walkin' && currentMode !== 'superadmin') {
    // アクセス権限がない場合は、座席選択ページにリダイレクト
    const urlParams = new URLSearchParams(window.location.search);
    const group = urlParams.get('group');
    const day = urlParams.get('day');
    const timeslot = urlParams.get('timeslot');
    
    if (group && day && timeslot) {
      // 座席選択ページにリダイレクト
      window.location.href = `seats.html?group=${group}&day=${day}&timeslot=${timeslot}`;
    } else {
      // パラメータがない場合は組選択ページにリダイレクト
      window.location.href = 'index.html';
    }
    
    // リダイレクト前にメッセージを表示
    alert('当日券発行には当日券モードまたは最高管理者モードでのログインが必要です。\n座席選択ページに移動します。');
    return false;
  }
  
  // アクセス権限がある場合は、ボタンを有効化
  const walkinBtn = document.getElementById('walkin-open-modal-btn');
  if (walkinBtn) {
    walkinBtn.disabled = false;
    walkinBtn.textContent = '当日券を発行する';
    walkinBtn.classList.remove('disabled-mode');
  }
  
  return true;
}

function showLoader(visible) {
  const loader = document.getElementById('loading-modal');
  if (loader) {
    if (visible) {
      loader.classList.add('show');
    } else {
      loader.classList.remove('show');
    }
  }
}

// モーダルを開く関数
function openWalkinOptionModal() {
  const modal = document.getElementById('walkin-option-modal');
  if (modal) modal.classList.add('show');
}

// モーダルを閉じる関数
function closeWalkinOptionModal() {
  const modal = document.getElementById('walkin-option-modal');
  if (modal) modal.classList.remove('show');
}

// 連続席で当日券を発行する関数
async function issueWalkinConsecutive() {
  closeWalkinOptionModal();
  if (_isIssuingWalkin) return;
  _isIssuingWalkin = true;

  const reservationResult = document.getElementById('reservation-result');
  const reservedSeatEl = document.getElementById('reserved-seat');
  const countInput = document.getElementById('walkin-count');
  const num = Math.max(1, Math.min(6, parseInt(countInput ? countInput.value : '1', 10) || 1));

  showLoader(true);
  reservationResult.classList.remove('show');

  try {
    const response = await GasAPI.assignWalkInConsecutiveSeats(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, num);
    
    // オフライン委譲レスポンスの処理
    if (response.error === 'offline_delegate' && response.functionName && response.params) {
      if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
        const operationId = window.OfflineSyncV2.addOperation({ 
          type: response.functionName, 
          args: response.params 
        });
        showLoader(false);
        showSuccessNotification('オフラインで当日券を受け付けました。オンライン復帰時に自動同期されます。');
        
        // オフライン時の仮の座席表示（実際の座席は同期後に確定）
        reservedSeatEl.textContent = `オフライン処理中 (ID: ${operationId})`;
        reservationResult.classList.add('show');
        return;
      }
    }

    // ローカル処理成功時の座席表示
    if (response.success && response.offline && response.seatIds) {
      showLoader(false);
      showSuccessNotification(response.message || '座席が確保されました。');

      const seats = response.seatIds;
      let seatDisplay = '';
      
      if (seats.length === 1) {
        seatDisplay = seats[0];
      } else {
        seatDisplay = seats.join(' / ');
      }
      
      // ローカル処理であることを示すマークを追加
      if (response.localProcessing) {
        seatDisplay += ' (ローカル処理)';
      }
      
      reservedSeatEl.textContent = seatDisplay;
      reservationResult.classList.add('show');
      return;
    }
    
    if (response.success) {
      showLoader(false);
      showSuccessNotification(response.message || '座席が確保されました。');

      let seats = [];
      if (response.seatId) seats = [response.seatId];
      if (response.seatIds && Array.isArray(response.seatIds)) seats = response.seatIds;

      if (seats.length === 1) {
        reservedSeatEl.textContent = seats[0];
      } else {
        reservedSeatEl.textContent = seats.join(' / ');
      }
      reservationResult.classList.add('show');
    } else {
      showLoader(false);
      // ローカル処理のエラーメッセージを適切に表示
      if (response.needsOnlineData) {
        showErrorNotification('座席データがキャッシュされていません。オンライン時に座席データを取得してから再試行してください。');
      } else {
        showErrorNotification(response.message || '連続席が見つかりませんでした。');
      }
    }
  } catch (error) {
    console.error('連続席発行エラー:', error);
    showLoader(false);
    showErrorNotification(`連続席発行中にエラーが発生しました: ${error.message || '不明なエラー'}`);
  } finally {
    _isIssuingWalkin = false;
  }
}

// どこでもよい（ランダム）で当日券を発行する関数
async function issueWalkinAnywhere() {
  closeWalkinOptionModal();
  if (_isIssuingWalkin) return;
  _isIssuingWalkin = true;

  const reservationResult = document.getElementById('reservation-result');
  const reservedSeatEl = document.getElementById('reserved-seat');
  const countInput = document.getElementById('walkin-count');
  const num = Math.max(1, Math.min(6, parseInt(countInput ? countInput.value : '1', 10) || 1));

  showLoader(true);
  reservationResult.classList.remove('show');

  try {
    let response;
    if (num === 1) {
      response = await GasAPI.assignWalkInSeat(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT);
    } else {
      response = await GasAPI.assignWalkInSeats(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, num);
    }

    // オフライン委譲レスポンスの処理
    if (response.error === 'offline_delegate' && response.functionName && response.params) {
      if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
        const operationId = window.OfflineSyncV2.addOperation({ 
          type: response.functionName, 
          args: response.params 
        });
        showLoader(false);
        showSuccessNotification('オフラインで当日券を受け付けました。オンライン復帰時に自動同期されます。');
        
        // オフライン時の仮の座席表示（実際の座席は同期後に確定）
        reservedSeatEl.textContent = `オフライン処理中 (ID: ${operationId})`;
        reservationResult.classList.add('show');
        return;
      }
    }

    // ローカル処理成功時の座席表示
    if (response.success && response.offline && (response.seatIds || response.seatId)) {
      showLoader(false);
      showSuccessNotification(response.message || '座席が確保されました。');

      let seats = [];
      if (response.seatId) seats = [response.seatId];
      if (response.seatIds && Array.isArray(response.seatIds)) seats = response.seatIds;

      let seatDisplay = '';
      if (seats.length === 1) {
        seatDisplay = seats[0];
      } else {
        seatDisplay = seats.join(' / ');
      }
      
      // ローカル処理であることを示すマークを追加
      if (response.localProcessing) {
        seatDisplay += ' (ローカル処理)';
      }
      
      reservedSeatEl.textContent = seatDisplay;
      reservationResult.classList.add('show');
      return;
    }

    if (response.success) {
      showLoader(false);
      showSuccessNotification(response.message || '座席が確保されました。');

      let seats = [];
      if (response.seatId) seats = [response.seatId];
      if (response.seatIds && Array.isArray(response.seatIds)) seats = response.seatIds;

      if (seats.length === 1) {
        reservedSeatEl.textContent = seats[0];
      } else {
        reservedSeatEl.textContent = seats.join(' / ');
      }
      reservationResult.classList.add('show');
    } else {
      showLoader(false);
      // ローカル処理のエラーメッセージを適切に表示
      if (response.needsOnlineData) {
        showErrorNotification('座席データがキャッシュされていません。オンライン時に座席データを取得してから再試行してください。');
      } else {
        showErrorNotification(response.message || '空席が見つかりませんでした。');
      }
    }
  } catch (error) {
    console.error('当日券発行エラー:', error);
    showLoader(false);
    const errorMessage = error.message || '不明なエラーが発生しました';
    showErrorNotification(`当日券発行中にエラーが発生しました: ${errorMessage}`);
  } finally {
    _isIssuingWalkin = false;
  }
}

// オフライン状態インジケーターの制御（軽量版）
function initializeOfflineIndicator() {
  const indicator = document.getElementById('offline-indicator');
  const progressBar = document.getElementById('sync-progress-bar');
  if (!indicator || !progressBar) return;

  const updateOfflineStatus = () => {
    const isOnline = navigator.onLine;
    if (isOnline) {
      indicator.style.display = 'none';
      indicator.textContent = 'オンライン';
      indicator.classList.add('online');
    } else {
      indicator.style.display = 'block';
      indicator.textContent = 'オフライン';
      indicator.classList.remove('online');
    }
  };

  updateOfflineStatus();
  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);

  if (window.OfflineSyncV2) {
    const checkSyncStatus = () => {
      const status = window.OfflineSyncV2.getStatus();
      if (status.syncInProgress) {
        progressBar.style.display = 'block';
        const progress = progressBar.querySelector('.progress');
        if (progress) progress.style.width = '100%';
      } else {
        progressBar.style.display = 'none';
        const progress = progressBar.querySelector('.progress');
        if (progress) progress.style.width = '0%';
      }
    };
    setInterval(checkSyncStatus, 1000);
    checkSyncStatus();
  }
}

// 成功通知を表示する関数（非ブロッキング）
function showSuccessNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'success-notification';
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.background = '#d4edda';
  notification.style.color = '#155724';
  notification.style.border = '1px solid #c3e6cb';
  notification.style.borderRadius = '5px';
  notification.style.padding = '15px 20px';
  notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  notification.style.zIndex = '10001';
  notification.style.maxWidth = '400px';
  
  notification.innerHTML = `
    <div class="notification-content" style="display: flex; align-items: center; gap: 10px;">
      <span class="notification-icon" style="font-size: 1.2em; color: #28a745;">✓</span>
      <span class="notification-message" style="flex: 1; font-size: 0.9em;">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #155724; font-size: 1.2em; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s;">×</button>
    </div>
  `;
  
  // 通知を表示
  document.body.appendChild(notification);
  
  // 4秒後に自動で消す
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 4000);
}

// エラー通知を表示する関数（非ブロッキング）
function showErrorNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'error-notification';
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.right = '20px';
  notification.style.background = '#f8d7da';
  notification.style.color = '#721c24';
  notification.style.border = '1px solid #f5c6cb';
  notification.style.borderRadius = '5px';
  notification.style.padding = '15px 20px';
  notification.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  notification.style.zIndex = '10001';
  notification.style.maxWidth = '400px';
  
  notification.innerHTML = `
    <div class="notification-content" style="display: flex; align-items: center; gap: 10px;">
      <span class="notification-icon" style="font-size: 1.2em; color: #dc3545;">✗</span>
      <span class="notification-message" style="flex: 1; font-size: 0.9em;">${message}</span>
      <button class="notification-close" onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #721c24; font-size: 1.2em; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background-color 0.2s;">×</button>
    </div>
  `;
  
  // 通知を表示
  document.body.appendChild(notification);
  
  // 5秒後に自動で消す
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// グローバル関数として設定
window.showLoader = showLoader;
window.toggleSidebar = toggleSidebar;

// グローバル関数登録（HTMLから呼ぶ）
window.issueWalkinConsecutive = issueWalkinConsecutive;
window.issueWalkinAnywhere = issueWalkinAnywhere;

// グローバル登録
window.openWalkinOptionModal = openWalkinOptionModal;
window.closeWalkinOptionModal = closeWalkinOptionModal;
