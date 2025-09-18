// seats-main.js - 最適化版
import GasAPI from './api.js';
import { loadSidebar, toggleSidebar, showModeChangeModal, applyModeChange, closeModeModal } from './sidebar.js';
import { apiUrlManager, DEBUG_MODE, debugLog, DemoMode } from './config.js';
import uiOptimizer from './ui-optimizer.js';

/**
 * 座席選択画面のメイン処理
 */
const urlParams = new URLSearchParams(window.location.search);
const requestedGroup = urlParams.get('group') || '';
// DEMOモードで許可外の場合ブロックしてリダイレクト
DemoMode.guardGroupAccessOrRedirect(requestedGroup, `seats.html?group=${encodeURIComponent(DemoMode.demoGroup)}&day=${urlParams.get('day')||'1'}&timeslot=${urlParams.get('timeslot')||'A'}`);
// DEMOモード時は見本演劇を強制
let GROUP = DemoMode.enforceGroup(requestedGroup || '見本演劇');
const DAY = urlParams.get('day') || '1';
const TIMESLOT = urlParams.get('timeslot') || 'A';
const IS_ADMIN = urlParams.get('admin') === 'true';

// ゲネプロモード時の時間帯・グループ偽装
const DISPLAY_TIMESLOT = TIMESLOT; // 表示用の時間帯
const ACTUAL_TIMESLOT = DemoMode.enforceGeneproTimeslot(TIMESLOT); // 実際にAPIで使用する時間帯
const ACTUAL_GROUP = DemoMode.enforceGeneproGroupForAPI(GROUP); // 実際にAPIで使用するグループ

let selectedSeats = [];
let isAutoRefreshEnabled = true;
let autoRefreshInterval = null;
let lastUpdateTime = null;
let isRefreshing = false;
let settingsOpen = false;
let isUserInteracting = false; // ユーザーが操作中かどうか
let interactionTimeout = null; // 操作終了を検知するためのタイマー

// APIエンドポイントを設定
const apiEndpoint = apiUrlManager.getCurrentUrl();
// OptimizedGasAPIはstaticメソッドを使用するため、インスタンス化は不要

  // 初期化
  window.onload = async () => {
    loadSidebar();
    
    // DEMO/ゲネプロモードアクティブ時に通知
    try { 
      if (DemoMode.isActive() || DemoMode.isGeneproActive()) {
        DemoMode.showNotificationIfNeeded();
      }
    } catch (_) {}

    // オフライン状態インジケーターの初期化
    initializeOfflineIndicator();

  const groupName = isNaN(parseInt(GROUP)) ? GROUP : GROUP + '組';
  const performanceInfo = document.getElementById('performance-info');
  if (performanceInfo) {
    // ゲネプロモード時は表示用の時間帯を使用
    const displayTimeslot = DemoMode.isGeneproActive() ? DISPLAY_TIMESLOT : TIMESLOT;
    performanceInfo.textContent = `${groupName} ${DAY}日目 ${displayTimeslot}`;
  }

  // 現在のモードを取得
  const currentMode = localStorage.getItem('currentMode') || 'normal';
  const isAdminMode = currentMode === 'admin' || IS_ADMIN;
  const isSuperAdminMode = currentMode === 'superadmin';
  const isWalkinMode = currentMode === 'walkin';

  // 通常モード用のクラスを付与（非空席をグレー表示するため）
  try {
    const isNormal = !isAdminMode && !isSuperAdminMode && !isWalkinMode;
    document.body.classList.toggle('normal-mode', isNormal);
  } catch (_) {}

  // 管理者モードの表示制御
  const adminIndicator = document.getElementById('admin-indicator');
  const superAdminIndicator = document.getElementById('superadmin-indicator');
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const submitButton = document.getElementById('submit-button');
  const checkInSelectedBtn = document.getElementById('check-in-selected-btn');
  const walkinButton = document.getElementById('walkin-button');
  
  if (isSuperAdminMode) {
    if (superAdminIndicator) superAdminIndicator.style.display = 'block';
    if (adminIndicator) adminIndicator.style.display = 'none';
    if (adminLoginBtn) adminLoginBtn.style.display = 'none';
    if (submitButton) submitButton.style.display = 'none';
    if (checkInSelectedBtn) checkInSelectedBtn.style.display = 'none';
    if (walkinButton) {
      walkinButton.style.display = 'block';
    }
  } else if (isAdminMode) {
    if (adminIndicator) adminIndicator.style.display = 'block';
    if (superAdminIndicator) superAdminIndicator.style.display = 'none';
    if (adminLoginBtn) adminLoginBtn.style.display = 'none';
    if (submitButton) submitButton.style.display = 'none';
    if (checkInSelectedBtn) checkInSelectedBtn.style.display = 'block';
    if (walkinButton) walkinButton.style.display = 'none';
  } else if (isWalkinMode) {
    if (adminIndicator) adminIndicator.style.display = 'none';
    if (superAdminIndicator) superAdminIndicator.style.display = 'none';
    if (adminLoginBtn) adminLoginBtn.style.display = 'none';
    if (submitButton) submitButton.style.display = 'none';
    if (checkInSelectedBtn) checkInSelectedBtn.style.display = 'none';
    if (walkinButton) {
      walkinButton.style.display = 'block';
    }
  } else {
    if (adminIndicator) adminIndicator.style.display = 'none';
    if (superAdminIndicator) superAdminIndicator.style.display = 'none';
    if (adminLoginBtn) adminLoginBtn.style.display = 'block';
    if (submitButton) submitButton.style.display = 'block';
    if (checkInSelectedBtn) checkInSelectedBtn.style.display = 'none';
    if (walkinButton) walkinButton.style.display = 'none';
  }

  showLoader(true);

  try {
    // URL変更をチェック
    checkForUrlChange();
    
    // 現在のモードを取得して管理者権限を判定
    const currentMode = localStorage.getItem('currentMode') || 'normal';
    const isAdminMode = currentMode === 'admin' || IS_ADMIN;
    const isSuperAdminMode = currentMode === 'superadmin';
    
    // オフライン時はキャッシュから復元（サーバーへ取りに行かない）
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = (window.readCache ? window.readCache(GROUP, DAY, TIMESLOT) : null);
      if (cached && cached.seatMap) {
        console.log('[Offline] キャッシュから座席データを復元:', {
          seatCount: Object.keys(cached.seatMap).length,
          cacheAge: cached.cachedAt ? Math.round((Date.now() - cached.cachedAt) / 1000) + '秒前' : '不明'
        });
        
        // オフライン時の座席データ復元強化
        const restoredSeatMap = {};
        Object.entries(cached.seatMap).forEach(([seatId, seatData]) => {
          if (seatData && typeof seatData === 'object') {
            restoredSeatMap[seatId] = {
              id: seatId,
              status: seatData.status || 'available',
              name: seatData.name || null,
              offlineRestored: true, // オフライン復元フラグ
              ...seatData
            };
          }
        });
        
        if (Object.keys(restoredSeatMap).length > 0) {
          console.log('[Offline] 座席データ復元完了:', Object.keys(restoredSeatMap).length + '席');
          drawSeatMap(restoredSeatMap);
          updateLastUpdateTime();
          
          // オフライン復元通知を表示
          showOfflineRestoreNotification(Object.keys(restoredSeatMap).length);
          
          const toggleCheckbox = document.getElementById('auto-refresh-toggle-checkbox');
          if (toggleCheckbox) {
            toggleCheckbox.checked = isAutoRefreshEnabled;
            toggleCheckbox.addEventListener('change', toggleAutoRefresh);
          }
          startAutoRefresh();
          return;
        }
      }
      // キャッシュがない場合のみ以降の処理に進む
    }
    
    console.log('GasAPI.getSeatData呼び出し:', { GROUP: ACTUAL_GROUP, DAY, TIMESLOT: ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode });
    const seatData = await GasAPI.getSeatData(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode);
    
    // 詳細なデバッグ情報をコンソールに出力
    console.log("===== 座席データ詳細情報 =====");
    console.log("Received seatData:", seatData);
    
    if (seatData.seatMap) {
      console.log("座席マップ構造:", Object.keys(seatData.seatMap));
      console.log("座席データサンプル:", Object.values(seatData.seatMap).slice(0, 3));
    } else {
      console.log("座席マップが存在しません");
    }
    console.log("===== 座席データ詳細情報終了 =====");
    
    // エラーハンドリングの改善
    if (!seatData || seatData.success === false) {
      // オフライン委譲レスポンス: キャッシュから復元
      if (seatData && seatData.offline && seatData.error === 'offline_delegate') {
        const cached = (window.readCache ? window.readCache(GROUP, DAY, TIMESLOT) : null);
        if (cached && cached.seatMap) {
          console.log('[Offline] オフライン委譲検出、キャッシュから座席データを復元');
          drawSeatMap(cached.seatMap);
          updateLastUpdateTime();
          const toggleCheckbox = document.getElementById('auto-refresh-toggle-checkbox');
          if (toggleCheckbox) {
            toggleCheckbox.checked = isAutoRefreshEnabled;
            toggleCheckbox.addEventListener('change', toggleAutoRefresh);
          }
          startAutoRefresh();
          return;
        }
      }
      const errorMsg = seatData?.error || seatData?.message || 'データ読み込みに失敗しました';
      console.error('座席データ読み込み失敗:', errorMsg);
      
      // エラー表示を改善
      const errorContainer = document.getElementById('error-container');
      const errorMessage = document.getElementById('error-message');
      if (errorContainer && errorMessage) {
        errorMessage.textContent = `データ読み込み失敗: ${errorMsg}`;
        errorContainer.style.display = 'flex';
      } else {
        // エラーコンテナがない場合はアラートで表示
        alert(`座席データの読み込みに失敗しました: ${errorMsg}`);
      }
      
      // エラー時でも基本的なUIは表示
      showLoader(false);
      return;
    }

    // オンライン取得成功時はキャッシュに保存
    try { if (window.writeCache) { window.writeCache(GROUP, DAY, TIMESLOT, seatData); } } catch (_) {}
    drawSeatMap(seatData.seatMap);
    updateLastUpdateTime();
    updateSelectedSeatsDisplay(); // 初期化時に選択された座席数を更新
    
    // 自動更新設定の初期化
    const toggleCheckbox = document.getElementById('auto-refresh-toggle-checkbox');
    if (toggleCheckbox) {
      toggleCheckbox.checked = isAutoRefreshEnabled;
      toggleCheckbox.addEventListener('change', toggleAutoRefresh);
    }
    
    // 最終更新時間の初期表示
    updateLastUpdateTime();
    
      startAutoRefresh();
} catch (error) {
  console.error('サーバー通信失敗:', error);
    
    // エラー表示を改善
    const errorContainer = document.getElementById('error-container');
    const errorMessage = document.getElementById('error-message');
    if (errorContainer && errorMessage) {
      errorMessage.textContent = `サーバー通信失敗: ${error.message}`;
      errorContainer.style.display = 'flex';
    } else {
      // エラーコンテナがない場合はアラートで表示
      alert(`サーバー通信に失敗しました: ${error.message}`);
    }
  } finally {
    showLoader(false);
  }
};

// 最終アップデート時間を取得
function updateLastUpdateTime() {
  lastUpdateTime = new Date();
  const lastUpdateEl = document.getElementById('last-update-display');
  if (lastUpdateEl) {
    lastUpdateEl.textContent = `最終更新: ${lastUpdateTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    console.warn('最終更新時間を表示する要素が見つかりません');
  }
}

// ローダー表示制御
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

// 座席マップを描画する関数
function drawSeatMap(seatMap) {
  const container = document.getElementById('seat-map-container');
  if (!container) {
    console.error('座席マップコンテナが見つかりません');
    return;
  }
  container.innerHTML = '';

  const layout = {
    rows: ['A', 'B', 'C', 'D', 'E'],
    cols: 12,
    passageAfter: 6
  };

  const seatSection = document.createElement('div');
  seatSection.className = 'seat-section';

  layout.rows.forEach(rowLabel => {
      const rowEl = document.createElement('div');
      rowEl.className = 'seat-row';
      
      for (let i = 1; i <= layout.cols; i++) {
          let seatId;
          
          if (rowLabel === 'E') {
              // E列は4,5,6,7,8,9の位置に1,2,3,4,5,6が配置される
              if (i >= 4 && i <= 9) {
                  const eSeatNumber = i - 3; // 1,2,3,4,5,6
                  seatId = 'E' + eSeatNumber;
              } else {
                  // 1,2,3,10,11,12の位置は空席（通路または使用不可）
                  const emptySpace = document.createElement('div');
                  emptySpace.className = 'empty-space';
                  rowEl.appendChild(emptySpace);
                  continue;
              }
          } else {
              // A-D列は通常通り1-12の位置
              seatId = rowLabel + i;
          }
          
          const seatData = seatMap[seatId] || { id: seatId, status: 'unavailable', name: null };
          rowEl.appendChild(createSeatElement(seatData));

          if (i === layout.passageAfter) {
              const passage = document.createElement('div');
              passage.className = 'passage';
              rowEl.appendChild(passage);
          }
      }
      seatSection.appendChild(rowEl);
  });

  container.appendChild(seatSection);
}

// 自動更新機能の実装（最適化版）
function startAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
  
  // ユーザーが操作中でない場合のみ自動更新を開始
  if (isAutoRefreshEnabled && isPageVisible && !isUserInteracting) {
    autoRefreshInterval = setInterval(async () => {
      if (isRefreshing || !isPageVisible || isUserInteracting) return; // 操作中は更新しない
      
      isRefreshing = true;
      try {
        // 現在のモードを取得して管理者権限を判定
        const currentMode = localStorage.getItem('currentMode') || 'normal';
        const isAdminMode = currentMode === 'admin' || IS_ADMIN;
        const isSuperAdminMode = currentMode === 'superadmin';
        
        // オフライン時はネットワークに行かずキャッシュのみ
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          const cached = (window.readCache ? window.readCache(GROUP, DAY, TIMESLOT) : null);
          if (cached && cached.seatMap) {
            console.log('[Offline] 自動更新でキャッシュから座席データを復元:', {
              seatCount: Object.keys(cached.seatMap).length,
              cacheAge: cached.cachedAt ? Math.round((Date.now() - cached.cachedAt) / 1000) + '秒前' : '不明'
            });
            
            // オフライン時の座席データ復元強化
            const restoredSeatMap = {};
            Object.entries(cached.seatMap).forEach(([seatId, seatData]) => {
              if (seatData && typeof seatData === 'object') {
                restoredSeatMap[seatId] = {
                  id: seatId,
                  status: seatData.status || 'available',
                  name: seatData.name || null,
                  offlineRestored: true, // オフライン復元フラグ
                  ...seatData
                };
              }
            });
            
            if (Object.keys(restoredSeatMap).length > 0) {
              updateSeatMapWithMinimalData(restoredSeatMap);
              updateLastUpdateTime();
            }
          }
          return;
        }

        // URL変更をチェック
        checkForUrlChange();
        
        // 最適化: 通常の自動更新時は最小限のデータを取得
        let seatData;
        if (isAdminMode || isSuperAdminMode) {
          // 管理者モードの場合は完全なデータを取得
          seatData = await GasAPI.getSeatData(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode);
        } else {
          // 通常モードの場合は最小限のデータを取得（高速化）
          seatData = await GasAPI.getSeatDataMinimal(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode);
        }
        
        if (seatData.success) {
          try { if (window.writeCache) { window.writeCache(GROUP, DAY, TIMESLOT, seatData); } } catch (_) {}
          // 最小限データの場合は既存の座席データとマージ
          if (seatData.seatMap && Object.keys(seatData.seatMap).length > 0) {
            // 既存の座席データを保持しつつ、ステータスのみ更新
            updateSeatMapWithMinimalData(seatData.seatMap);
          } else {
            // 完全なデータの場合は通常通り更新
            drawSeatMap(seatData.seatMap);
          }
          updateLastUpdateTime();
        }
      } catch (error) {
        console.error('自動更新エラー:', error);
      } finally {
        isRefreshing = false;
      }
    }, 30000); // 30秒ごとに更新
  }
}

// 最小限データで座席マップを更新する関数
function updateSeatMapWithMinimalData(minimalSeatMap) {
  // 既存の座席要素を取得
  const existingSeats = document.querySelectorAll('.seat');
  
  existingSeats.forEach(seatEl => {
    const seatId = seatEl.dataset.id;
    const minimalData = minimalSeatMap[seatId];
    
    if (minimalData) {
      // ステータスのみ更新（色とクラス）
      const currentStatus = seatEl.dataset.status;
      if (currentStatus !== minimalData.status) {
        // ステータスが変更された場合のみ更新
        seatEl.dataset.status = minimalData.status;
        
        // クラスを更新（CSSは `.seat.available` 等を参照）
        seatEl.className = 'seat';
        seatEl.classList.add(minimalData.status);
        
        // 色を更新
        updateSeatColor(seatEl, minimalData.status);
        
        // ステータステキストも更新
        updateSeatStatusText(seatEl, minimalData.status);
      }
    }
  });
}

// 完全なデータで座席マップを更新する関数
function updateSeatMapWithCompleteData(completeSeatMap) {
  // 既存の座席要素を取得
  const existingSeats = document.querySelectorAll('.seat');
  
  existingSeats.forEach(seatEl => {
    const seatId = seatEl.dataset.id;
    const completeData = completeSeatMap[seatId];
    
    if (completeData) {
      // ステータスが変更された場合のみ更新
      const currentStatus = seatEl.dataset.status;
      if (currentStatus !== completeData.status) {
        // ステータスを更新
        seatEl.dataset.status = completeData.status;
        
        // クラスを更新
        seatEl.className = 'seat';
        seatEl.classList.add(completeData.status);
        
        // 色を更新
        updateSeatColor(seatEl, completeData.status);
        
        // ステータステキストを更新
        updateSeatStatusText(seatEl, completeData.status);
      }
      
      // 名前を更新（管理者モードと最高管理者モードで表示）
      updateSeatName(seatEl, completeData);
      
      // その他のデータを更新（最高管理者モード用）
      updateSeatAdditionalData(seatEl, completeData);
      
      // チェックイン可能フラグを更新
      updateSeatCheckinFlag(seatEl, completeData);
    }
  });
}

// 自動更新の切り替え
function toggleAutoRefresh() {
  isAutoRefreshEnabled = !isAutoRefreshEnabled;
  const toggleBtn = document.getElementById('auto-refresh-toggle-checkbox');
  
  if (toggleBtn) {
    toggleBtn.checked = isAutoRefreshEnabled;
  }
  
  if (isAutoRefreshEnabled && isPageVisible) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
}

// 座席要素を作成する関数
function createSeatElement(seatData) {
  const seat = document.createElement('div');
  seat.className = `seat ${seatData.status}`;
  seat.dataset.id = seatData.id;

  // fuck 山田一
  // 座席IDを表示
  const seatIdEl = document.createElement('div');
  seatIdEl.className = 'seat-id';
  seatIdEl.textContent = seatData.id;
  seat.appendChild(seatIdEl);
  
  // 管理者モードでチェックイン可能な座席を選択可能にする
  const currentMode = localStorage.getItem('currentMode') || 'normal';
  const isAdminMode = currentMode === 'admin' || IS_ADMIN;
  
  if (isAdminMode && (seatData.status === 'to-be-checked-in' || seatData.status === 'reserved')) {
    // チェックイン可能な座席を選択可能にする
    seat.classList.add('checkin-selectable');
    seat.dataset.seatName = seatData.name || '';
  }
  
  // 最高管理者モード用にC、D、E列のデータを保存
  if (seatData.columnC !== undefined) {
    seat.dataset.columnC = seatData.columnC;
  }
  if (seatData.columnD !== undefined) {
    seat.dataset.columnD = seatData.columnD;
  }
  if (seatData.columnE !== undefined) {
    seat.dataset.columnE = seatData.columnE;
  }
  
  // 名前を表示（管理者モードと最高管理者モードで同じ表示）
  if (seatData.name && seatData.status !== 'available') {
    const nameEl = document.createElement('div');
    nameEl.className = 'seat-name';
    
    // 名前が長すぎる場合は省略表示
    if (seatData.name.length > 8) {
      nameEl.textContent = seatData.name.substring(0, 8) + '...';
      nameEl.title = seatData.name; // ツールチップで全文表示
    } else {
      nameEl.textContent = seatData.name;
    }
    
    seat.appendChild(nameEl);
  }
  
  seat.addEventListener('click', () => handleSeatClick(seatData));
  return seat;
}

// 座席クリック時の処理
function handleSeatClick(seatData) {
  const currentMode = localStorage.getItem('currentMode') || 'normal';
  const isAdminMode = currentMode === 'admin' || IS_ADMIN;
  const isSuperAdminMode = currentMode === 'superadmin';
  
  if (isSuperAdminMode) {
    // 最高管理者モード：座席データ編集
    handleSuperAdminSeatClick(seatData);
  } else if (isAdminMode) {
    // 管理者モード：チェックイン可能な座席を選択
    handleAdminSeatClick(seatData);
  } else {
    // 通常モード：予約可能な座席を選択
    handleNormalSeatClick(seatData);
  }
}

// 最高管理者モードでの座席クリック処理
function handleSuperAdminSeatClick(seatData) {
  console.log('[最高管理者] 座席クリック:', seatData);
  
  // 任意の座席を選択可能
  const seatElement = document.querySelector(`[data-id="${seatData.id}"]`);
  if (!seatElement) {
    console.error('[最高管理者] 座席要素が見つかりません:', seatData.id);
    return;
  }

  // ユーザー操作開始
  startUserInteraction();

  // 既存のモーダルがあれば閉じる
  closeSeatEditModal();

  // 座席の選択状態を設定（編集用）
  // 他の座席の選択をクリア
  document.querySelectorAll('.seat.selected-for-edit').forEach(seat => {
    seat.classList.remove('selected-for-edit');
  });
  
  // 現在の座席を選択状態にする
  seatElement.classList.add('selected-for-edit');
  console.log('[最高管理者] 座席選択状態を設定:', seatData.id);

  // 編集モーダルを表示
  showSeatEditModal(seatData);
}

// 管理者モードでの座席クリック処理
function handleAdminSeatClick(seatData) {
  // チェックイン可能な座席のみ選択可能（確保ステータスも含む）
  if (seatData.status !== 'to-be-checked-in' && seatData.status !== 'reserved') {
    console.log('この座席はチェックインできません:', seatData.status);
    return;
  }

  const seatElement = document.querySelector(`[data-id="${seatData.id}"]`);
  if (!seatElement) return;

  // ユーザー操作開始
  startUserInteraction();

  // 座席の選択状態を切り替え
  if (seatElement.classList.contains('selected-for-checkin')) {
    // 選択解除
    seatElement.classList.remove('selected-for-checkin');
    selectedSeats = selectedSeats.filter(id => id !== seatData.id);
  } else {
    // 選択
    seatElement.classList.add('selected-for-checkin');
    selectedSeats.push(seatData.id);
  }

  // 選択された座席数を表示
  updateSelectedSeatsDisplay();
  
  console.log('チェックイン対象座席:', selectedSeats);
}

// 通常モードでの座席クリック処理
function handleNormalSeatClick(seatData) {
  // 利用可能な座席のみ選択可能
  if (seatData.status !== 'available') {
    console.log('この座席は選択できません:', seatData.status);
    // ユーザーに分かりやすいメッセージを表示
    const statusMessages = {
      'reserved': 'この座席は既に予約されています',
      'to-be-checked-in': 'この座席は既に予約されています',
      'checked-in': 'この座席は既にチェックイン済みです',
      'unavailable': 'この座席は利用できません'
    };
    const message = statusMessages[seatData.status] || 'この座席は選択できません';
    alert(message);
    return;
  }

  const seatElement = document.querySelector(`[data-id="${seatData.id}"]`);
  if (!seatElement) return;

  // ユーザー操作開始
  startUserInteraction();

  // 座席の選択状態を切り替え
  if (seatElement.classList.contains('selected')) {
    // 選択解除
    seatElement.classList.remove('selected');
    selectedSeats = selectedSeats.filter(id => id !== seatData.id);
  } else {
    // 選択
    seatElement.classList.add('selected');
    selectedSeats.push(seatData.id);
  }

  // 選択された座席数を表示
  updateSelectedSeatsDisplay();
  
  console.log('選択された座席:', selectedSeats);
}

// 選択された座席数の表示を更新
function updateSelectedSeatsDisplay() {
  const submitButton = document.getElementById('submit-button');
  if (submitButton) {
    if (selectedSeats.length > 0) {
      submitButton.textContent = `この席で予約する (${selectedSeats.length}席: ${selectedSeats.join(', ')})`;
      submitButton.disabled = false;
    } else {
      submitButton.textContent = 'この席で予約する';
      submitButton.disabled = true;
    }
  }
}

// グローバル関数として設定
window.showLoader = showLoader;
window.toggleAutoRefresh = toggleAutoRefresh;
window.checkInSelected = checkInSelected;
window.confirmReservation = confirmReservation;
window.promptForAdminPassword = promptForAdminPassword;
window.toggleAutoRefreshSettings = toggleAutoRefreshSettings;
window.closeAutoRefreshSettings = closeAutoRefreshSettings;
window.manualRefresh = manualRefresh;
window.showModeChangeModal = showModeChangeModal;
window.closeModeModal = closeModeModal;
window.applyModeChange = applyModeChange;
window.startUserInteraction = startUserInteraction;
window.endUserInteraction = endUserInteraction;
window.showSeatEditModal = showSeatEditModal;
window.closeSeatEditModal = closeSeatEditModal;
window.updateSeatData = updateSeatData;
window.showUrlChangeAnimation = showUrlChangeAnimation;

// デバッグ用：グローバル関数の登録確認
console.log('[Seats Main] グローバル関数登録完了:', {
  showUrlChangeAnimation: typeof window.showUrlChangeAnimation,
  manualRefresh: typeof window.manualRefresh
});

// 自動更新設定メニューの表示制御
function toggleAutoRefreshSettings() {
  const panel = document.getElementById('auto-refresh-settings-panel');
  const overlay = document.getElementById('auto-refresh-overlay');
  
  if (panel.classList.contains('show')) {
    closeAutoRefreshSettings();
  } else {
    panel.classList.add('show');
    if (overlay) overlay.classList.add('show');
  }
}

// 自動更新設定メニューを閉じる
function closeAutoRefreshSettings() {
  const panel = document.getElementById('auto-refresh-settings-panel');
  const overlay = document.getElementById('auto-refresh-overlay');
  
  if (panel) panel.classList.remove('show');
  if (overlay) overlay.classList.remove('show');
}

// 手動更新
async function manualRefresh() {
  if (isRefreshing) return;
  
  isRefreshing = true;
  showLoader(true);
  
  try {
    // 手動更新時は必ず異なるURLを選択
    const oldUrl = apiUrlManager.getCurrentUrl();
    console.log('[Manual Refresh] 更新前URL:', oldUrl);
    
    apiUrlManager.selectRandomUrl();
    const newUrl = apiUrlManager.getCurrentUrl();
    console.log('[Manual Refresh] 更新後URL:', newUrl);
    
    // URL変更をチェック
    console.log('[Manual Refresh] checkForUrlChange を呼び出し');
    checkForUrlChange();
    
    // 手動更新時は直接アニメーションを表示
    if (oldUrl !== newUrl) {
      console.log('[Manual Refresh] 直接アニメーション表示');
      showUrlChangeAnimation(oldUrl, newUrl, 'random');
    }
    
    const currentMode = localStorage.getItem('currentMode') || 'normal';
    const isAdminMode = currentMode === 'admin' || IS_ADMIN;
    const isSuperAdminMode = currentMode === 'superadmin';
    
    // オフライン時はキャッシュから復元
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = (window.readCache ? window.readCache(GROUP, DAY, TIMESLOT) : null);
      if (cached && cached.seatMap) {
        console.log('[Offline] 手動更新でキャッシュを使用');
        drawSeatMap(cached.seatMap);
        updateLastUpdateTime();
        alert('オフラインのためキャッシュから表示しています');
        return;
      }
    }
    
    const seatData = await GasAPI.getSeatData(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode);
    
    if (seatData.success) {
      try { if (window.writeCache) { window.writeCache(GROUP, DAY, TIMESLOT, seatData); } } catch (_) {}
      drawSeatMap(seatData.seatMap);
      updateLastUpdateTime();
      alert('座席データを更新しました');
    }
  } catch (error) {
    console.error('手動更新エラー:', error);
    alert('更新に失敗しました: ' + error.message);
  } finally {
    showLoader(false);
    isRefreshing = false;
  }
}

// 画面の可視性変更を監視
let isPageVisible = true;
document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
  if (isPageVisible && isAutoRefreshEnabled) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// ESCキーで設定メニューを閉じる
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAutoRefreshSettings();
  }
});

// 自動更新の停止
function stopAutoRefresh() {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

// 管理者パスワード入力関数
function promptForAdminPassword() {
  // サイドバーのモード変更モーダルを表示
  showModeChangeModal();
  
  // 管理者モードを選択状態にする
  setTimeout(() => {
    const adminRadio = document.querySelector('input[name="mode"][value="admin"]');
    if (adminRadio) {
      adminRadio.checked = true;
    }
  }, 100);
}

// 複数同時チェックイン機能（最適化版）
async function checkInSelected() {
  const selectedSeatElements = document.querySelectorAll('.seat.selected-for-checkin');
  if (selectedSeatElements.length === 0) {
    alert('チェックインする座席を選択してください。');
    return;
  }

  const selectedSeats = Array.from(selectedSeatElements).map(seatEl => ({
    id: seatEl.dataset.id,
    name: seatEl.dataset.seatName
  }));

  // 選択された座席の一覧を表示
  const seatList = selectedSeats.map(seat => `${seat.id}：${seat.name}`).join('\n');
  const confirmMessage = `以下の座席をチェックインしますか？\n\n${seatList}`;
  
  if (!confirm(confirmMessage)) {
    return;
  }

  // 楽観的更新：即座にUIを更新（チェックイン済みとして表示）
  const seatIds = selectedSeats.map(seat => seat.id);
  
  // 選択された座席を即座にチェックイン済みとして表示
  selectedSeatElements.forEach(seatEl => {
    const seatId = seatEl.dataset.id;
    const seatData = {
      id: seatId,
      status: 'checked-in',
      name: seatEl.dataset.seatName || '',
      columnC: seatEl.dataset.columnC || '',
      columnD: seatEl.dataset.seatName || '',
      columnE: '済' // チェックイン済みとして設定
    };
    
    // 座席要素を更新
    updateSeatElement(seatEl, seatData);
    
    // 選択状態をクリア
    seatEl.classList.remove('selected-for-checkin');
  });

  // 選択表示を更新
  updateSelectedSeatsDisplay();
  
  // ローダーを表示（軽量版）
  showLoader(true);
  
  try {
    // バックグラウンドでAPI呼び出し
    const response = await GasAPI.checkInMultipleSeats(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, seatIds);
    
    if (response.success) {
      // 成功時：即座に成功メッセージを表示（ローダーは非表示）
      showLoader(false);
      
      // 成功通知を表示（非ブロッキング）
      showSuccessNotification(`チェックインが完了しました！\n\n${response.message}`);
      
      // バックグラウンドで座席データを再取得（サイレント更新）
      setTimeout(async () => {
        try {
          const currentMode = localStorage.getItem('currentMode') || 'normal';
          const isAdminMode = currentMode === 'admin' || IS_ADMIN;
          const isSuperAdminMode = currentMode === 'superadmin';
          
          const seatData = await GasAPI.getSeatData(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode);
          
          if (seatData.success) {
            // サイレント更新：座席マップを再描画
            drawSeatMap(seatData.seatMap);
            updateLastUpdateTime();
          }
        } catch (error) {
          console.warn('バックグラウンド更新エラー（非致命的）:', error);
        }
      }, 1000); // 1秒後にバックグラウンド更新
      
    } else {
      // オフライン委譲レスポンスの処理
      if (response.error === 'offline_delegate' && response.functionName && response.params) {
        console.log('[チェックイン] オフライン委譲レスポンスを処理中...');
        
        // オフライン同期システムに操作を追加
        if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
          const operationId = window.OfflineSyncV2.addOperation({
            type: response.functionName,
            args: response.params
          });
          
          showLoader(false);
          showSuccessNotification('オフラインでチェックインを受け付けました。オンライン復帰時に自動同期されます。');
          
          // 座席データを再取得してUIを復元
          await refreshSeatData();
          return;
        }
      }
      
      // オフライン委譲レスポンスの処理
      if (response.error === 'offline_delegate' && response.functionName && response.params) {
        console.log('[チェックイン] オフライン委譲レスポンスを処理中...');
        
        // オフライン同期システムに操作を追加
        if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
          const operationId = window.OfflineSyncV2.addOperation({
            type: response.functionName,
            args: response.params
          });
          
          showLoader(false);
          showSuccessNotification('オフラインでチェックインを受け付けました。オンライン復帰時に自動同期されます。');
          
          // 座席データを再取得してUIを復元
          await refreshSeatData();
          return;
        }
      }
    }
  } catch (error) {
    console.error('チェックインエラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      error: error.error,
      success: error.success,
      stack: error.stack
    });
    
    // エラー時：UIを元に戻す
    showLoader(false);
    const errorMessage = error.message || error.error || '不明なエラーが発生しました';
    showErrorNotification(`チェックインエラー：\n${errorMessage}`);
    
    // 座席データを再取得してUIを復元
    await refreshSeatData();
  }
  
  // ユーザー操作終了
  endUserInteraction();
}

// 予約確認・実行関数（最適化版）
async function confirmReservation() {
  if (selectedSeats.length === 0) {
    alert('予約する座席を選択してください。\n\n利用可能な座席（緑色）をクリックして選択してから、予約ボタンを押してください。');
    return;
  }

  const confirmMessage = `以下の座席で予約しますか？\n\n${selectedSeats.join(', ')}`;
  if (!confirm(confirmMessage)) {
    return;
  }

  // 選択された座席のコピーを作成（API呼び出し用）
  const seatsToReserve = [...selectedSeats];
  
  // 楽観的更新：即座にUIを更新（予約済みとして表示）
  
  // 選択された座席を即座に予約済みとして表示
  selectedSeats.forEach(seatId => {
    const seatEl = document.querySelector(`[data-id="${seatId}"]`);
    if (seatEl) {
      const seatData = {
        id: seatId,
        status: 'reserved',
        name: '予約中...',
        columnC: '予約済',
        columnD: '予約中...',
        columnE: ''
      };
      
      // 座席要素を更新
      updateSeatElement(seatEl, seatData);
    }
  });

  // 選択をクリア
  selectedSeats = [];
  updateSelectedSeatsDisplay();
  
  // ローダーを表示（軽量版）
  showLoader(true);
  
  try {
    const response = await GasAPI.reserveSeats(GROUP, DAY, ACTUAL_TIMESLOT, seatsToReserve);
    
    if (response.success) {
      // 成功時：即座に成功メッセージを表示（ローダーは非表示）
      showLoader(false);
      
      // 成功通知を表示（非ブロッキング）
      showSuccessNotification(response.message || '予約が完了しました！');
      
      // バックグラウンドで座席データを再取得（サイレント更新）
      setTimeout(async () => {
        try {
          const currentMode = localStorage.getItem('currentMode') || 'normal';
          const isAdminMode = currentMode === 'admin' || IS_ADMIN;
          const isSuperAdminMode = currentMode === 'superadmin';
          
          const seatData = await GasAPI.getSeatData(ACTUAL_GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode);
          
          if (seatData.success) {
            // サイレント更新：座席マップを再描画
            drawSeatMap(seatData.seatMap);
            updateLastUpdateTime();
          }
        } catch (error) {
          console.warn('バックグラウンド更新エラー（非致命的）:', error);
        }
      }, 1000); // 1秒後にバックグラウンド更新
      
    } else {
      // オフライン委譲レスポンスの処理
      if (response.error === 'offline_delegate' && response.functionName && response.params) {
        console.log('[予約] オフライン委譲レスポンスを処理中...');
        
        // オフライン同期システムに操作を追加
        if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
          const operationId = window.OfflineSyncV2.addOperation({
            type: response.functionName,
            args: response.params
          });
          
          showLoader(false);
          showSuccessNotification('オフラインで予約を受け付けました。オンライン復帰時に自動同期されます。');
          
          // 座席データを再取得してUIを復元
          await refreshSeatData();
          return;
        }
      }
      
      // オフライン委譲レスポンスの処理
      if (response.error === 'offline_delegate' && response.functionName && response.params) {
        console.log('[予約] オフライン委譲レスポンスを処理中...');
        
        // オフライン同期システムに操作を追加
        if (window.OfflineSyncV2 && window.OfflineSyncV2.addOperation) {
          const operationId = window.OfflineSyncV2.addOperation({
            type: response.functionName,
            args: response.params
          });
          
          showLoader(false);
          showSuccessNotification('オフラインで予約を受け付けました。オンライン復帰時に自動同期されます。');
          
          // 座席データを再取得してUIを復元
          await refreshSeatData();
          return;
        }
      }
    }
  } catch (error) {
    console.error('予約エラー:', error);
    console.error('エラー詳細:', {
      message: error.message,
      error: error.error,
      success: error.success,
      stack: error.stack
    });
    
    // エラー時：UIを元に戻す
    showLoader(false);
    const errorMessage = error.message || error.error || '不明なエラーが発生しました';
    showErrorNotification(`予約エラー：\n${errorMessage}`);
    
    // 座席データを再取得してUIを復元
    await refreshSeatData();
  }
  
  // ユーザー操作終了
  endUserInteraction();
}

// ユーザー操作の開始を検知
function startUserInteraction() {
  isUserInteracting = true;
  
  // 既存のタイマーをクリア
  if (interactionTimeout) {
    clearTimeout(interactionTimeout);
  }
  
  // 操作終了を検知するタイマーを設定（5秒後）
  interactionTimeout = setTimeout(() => {
    isUserInteracting = false;
    // 操作終了後、自動更新を再開
    if (isAutoRefreshEnabled && isPageVisible) {
      startAutoRefresh();
    }
  }, 5000);
  
  // 操作中は自動更新を停止
  stopAutoRefresh();
}

// 座席編集モーダルを表示する関数
function showSeatEditModal(seatData) {
  console.log('[最高管理者] モーダル表示開始:', seatData);
  
  // モーダルのHTMLを作成（最初はshowクラスなし）
  const modalHTML = `
    <div id="seat-edit-modal" class="modal">
      <div class="modal-content" style="max-width: 500px;">
        <h3>座席データ編集 - ${seatData.id}</h3>
        <div class="seat-edit-form">
          <div class="form-group">
            <label for="column-c">C列: ステータス（空、確保、予約済など）</label>
            <input type="text" id="column-c" value="${seatData.columnC || ''}" placeholder="例: 予約済">
          </div>
          <div class="form-group">
            <label for="column-d">D列: 予約名・備考</label>
            <input type="text" id="column-d" value="${seatData.columnD || ''}" placeholder="例: 田中太郎">
          </div>
          <div class="form-group">
            <label for="column-e">E列: チェックイン状態・その他</label>
            <input type="text" id="column-e" value="${seatData.columnE || ''}" placeholder="例: 済">
          </div>
        </div>
        <div class="modal-buttons">
          <button class="btn-primary" onclick="updateSeatData('${seatData.id}')">確定</button>
          <button class="btn-secondary" onclick="closeSeatEditModal()">キャンセル</button>
        </div>
      </div>
    </div>
  `;
  
  // モーダルを表示（アニメーション有効化のため、挿入後にreflowを挟んでshowクラス付与）
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  console.log('[最高管理者] モーダルHTMLを追加');
  
  // アニメーションを開始するため、次のフレームでshowクラスを追加
  requestAnimationFrame(() => {
    const modalEl = document.getElementById('seat-edit-modal');
    if (modalEl) {
      modalEl.classList.add('show');
      console.log('[最高管理者] アニメーション開始');
    }
  });
  
  // モーダルの背景クリックで閉じる機能を追加
  const modal = document.getElementById('seat-edit-modal');
  if (modal) {
    console.log('[最高管理者] モーダル要素を取得:', modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSeatEditModal();
      }
    });
  } else {
    console.error('[最高管理者] モーダル要素が見つかりません');
  }
}

// 座席編集モーダルを閉じる関数
function closeSeatEditModal() {
  const modal = document.getElementById('seat-edit-modal');
  if (modal) {
    try {
      // 退出アニメーションを再生
      modal.classList.add('closing');
      console.log('[最高管理者] 閉じるアニメーション開始');
      
      // アニメーション完了後にモーダルを削除
      setTimeout(() => { 
        try { 
          modal.remove(); 
          console.log('[最高管理者] モーダル削除完了');
        } catch (_) {} 
      }, 250); // CSSのアニメーション時間と合わせる
    } catch (_) {
      modal.remove();
    }
  }
  
  // 最高管理者モードの座席選択状態をクリア
  document.querySelectorAll('.seat.selected-for-edit').forEach(seat => {
    seat.classList.remove('selected-for-edit');
  });
}

// 座席データを更新する関数
async function updateSeatData(seatId) {
  const columnC = document.getElementById('column-c').value;
  const columnD = document.getElementById('column-d').value;
  const columnE = document.getElementById('column-e').value;
  
  // 確認ダイアログを表示
  const confirmMessage = `座席 ${seatId} のデータを以下の内容で更新しますか？\n\nC列: ${columnC}\nD列: ${columnD}\nE列: ${columnE}`;
  
  if (!confirm(confirmMessage)) {
    return;
  }
  
  showLoader(true);
  
  try {
    const response = await GasAPI.updateSeatData(GROUP, DAY, ACTUAL_TIMESLOT, seatId, columnC, columnD, columnE);
    
    if (response.success) {
      alert('座席データを更新しました！');
      closeSeatEditModal();
      
      // 最高管理者モードの座席選択状態をクリア
      document.querySelectorAll('.seat.selected-for-edit').forEach(seat => {
        seat.classList.remove('selected-for-edit');
      });
      
      // 座席データを再読み込み
      const currentMode = localStorage.getItem('currentMode') || 'normal';
      const isAdminMode = currentMode === 'admin' || IS_ADMIN;
      const isSuperAdminMode = currentMode === 'superadmin';
      const seatData = await GasAPI.getSeatData(GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode);
      
      if (seatData.success) {
        drawSeatMap(seatData.seatMap);
        updateLastUpdateTime();
      }
    } else {
      alert(`更新エラー：\n${response.message}`);
    }
  } catch (error) {
    console.error('座席データ更新エラー:', error);
    alert(`更新エラー：\n${error.message}`);
  } finally {
    showLoader(false);
  }
}

// ユーザー操作の終了を検知
function endUserInteraction() {
  isUserInteracting = false;
  if (interactionTimeout) {
    clearTimeout(interactionTimeout);
    interactionTimeout = null;
  }
  
  // 操作終了後、自動更新を再開
  if (isAutoRefreshEnabled && isPageVisible) {
    startAutoRefresh();
  }
}

// 当日券ページへのナビゲーション
function navigateToWalkin() {
  const currentMode = localStorage.getItem('currentMode') || 'normal';
  
  if (currentMode !== 'walkin' && currentMode !== 'superadmin') {
    alert('当日券発行には当日券モードまたは最高管理者モードでのログインが必要です。\nサイドバーからモードを変更してください。');
    return;
  }
  
  // 現在のURLパラメータを使用して当日券ページに遷移
  window.location.href = `walkin.html?group=${GROUP}&day=${DAY}&timeslot=${TIMESLOT}`;
}



// グローバル関数として登録
window.navigateToWalkin = navigateToWalkin;

// 座席要素を更新する関数（楽観的更新用）
function updateSeatElement(seatEl, seatData) {
  if (!seatEl || !seatData) return;
  
  // データ属性を更新
  seatEl.dataset.seatName = seatData.name || '';
  seatEl.dataset.columnC = seatData.columnC || '';
  seatEl.dataset.columnD = seatData.columnD || '';
  seatEl.dataset.columnE = seatData.columnE || '';
  
  // クラスを更新
  seatEl.className = 'seat';
  seatEl.classList.add(seatData.status);
  
  // 座席名を更新
  const nameEl = seatEl.querySelector('.seat-name');
  if (nameEl) {
    nameEl.textContent = seatData.name || '';
  }
  
  // ステータス表示を更新
  const statusEl = seatEl.querySelector('.seat-status');
  if (statusEl) {
    statusEl.textContent = getStatusText(seatData.status);
  }
  
  // 色を更新
  updateSeatColor(seatEl, seatData.status);
}

// 座席の色を更新する関数
function updateSeatColor(seatEl, status) {
  // 既存の色クラスを削除
  seatEl.classList.remove('available', 'reserved', 'checked-in', 'unavailable');
  
  // 新しいステータスクラスを追加
  seatEl.classList.add(status);
}

// 座席のステータステキストを更新する関数
function updateSeatStatusText(seatEl, status) {
  // ステータス表示要素を取得
  const statusEl = seatEl.querySelector('.seat-status');
  if (statusEl) {
    statusEl.textContent = getStatusText(status);
  }
}

// 座席の名前を更新する関数
function updateSeatName(seatEl, seatData) {
  const currentMode = localStorage.getItem('currentMode') || 'normal';
  const isAdminMode = currentMode === 'admin' || IS_ADMIN;
  const isSuperAdminMode = currentMode === 'superadmin';
  
  // 管理者モードまたは最高管理者モードで、かつ予約済み以上の座席の場合のみ名前を表示
  if ((isAdminMode || isSuperAdminMode) && seatData.name && seatData.status !== 'available') {
    let nameEl = seatEl.querySelector('.seat-name');
    
    // 名前要素が存在しない場合は作成
    if (!nameEl) {
      nameEl = document.createElement('div');
      nameEl.className = 'seat-name';
      seatEl.appendChild(nameEl);
    }
    
    // 名前を更新
    if (seatData.name.length > 8) {
      nameEl.textContent = seatData.name.substring(0, 8) + '...';
      nameEl.title = seatData.name; // ツールチップで全文表示
    } else {
      nameEl.textContent = seatData.name;
    }
  } else {
    // 通常モードまたは名前が不要な場合は名前要素を削除
    const nameEl = seatEl.querySelector('.seat-name');
    if (nameEl) {
      nameEl.remove();
    }
  }
}

// 座席の追加データを更新する関数（最高管理者モード用）
function updateSeatAdditionalData(seatEl, seatData) {
  const currentMode = localStorage.getItem('currentMode') || 'normal';
  const isSuperAdminMode = currentMode === 'superadmin';
  
  if (isSuperAdminMode) {
    // C、D、E列のデータを更新
    if (seatData.columnC !== undefined) {
      seatEl.dataset.columnC = seatData.columnC;
    }
    if (seatData.columnD !== undefined) {
      seatEl.dataset.columnD = seatData.columnD;
    }
    if (seatData.columnE !== undefined) {
      seatEl.dataset.columnE = seatData.columnE;
    }
  }
}

// 座席のチェックイン可能フラグを更新する関数
function updateSeatCheckinFlag(seatEl, seatData) {
  const currentMode = localStorage.getItem('currentMode') || 'normal';
  const isAdminMode = currentMode === 'admin' || IS_ADMIN;
  
  if (isAdminMode && (seatData.status === 'to-be-checked-in' || seatData.status === 'reserved')) {
    // チェックイン可能な座席を選択可能にする
    seatEl.classList.add('checkin-selectable');
    seatEl.dataset.seatName = seatData.name || '';
  } else {
    // チェックイン不可能な場合はフラグを削除
    seatEl.classList.remove('checkin-selectable');
    delete seatEl.dataset.seatName;
  }
}

// ステータスのテキストを取得する関数
function getStatusText(status) {
  const statusMap = {
    'available': '予約可能',
    'reserved': '予約済',
    'checked-in': 'チェックイン済',
    'unavailable': '設定なし'
  };
  return statusMap[status] || '不明';
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

// オフライン復元通知を表示する関数
function showOfflineRestoreNotification(seatCount) {
  const notification = document.createElement('div');
  notification.className = 'offline-restore-notification';
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px; color: #fff;">●</span>
      <div>
        <div style="font-weight: 600; margin-bottom: 2px;">オフライン復元完了</div>
        <div style="font-size: 12px; opacity: 0.9;">${seatCount}席のデータをキャッシュから復元しました</div>
      </div>
    </div>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    font-size: 14px;
    max-width: 320px;
    word-wrap: break-word;
    animation: slideInLeft 0.3s ease-out;
  `;

  // アニメーション用のCSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideInLeft {
      from {
        transform: translateX(-100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // 4秒後に自動削除
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideInLeft 0.3s ease-out reverse';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        if (style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 300);
    }
  }, 4000);
}

// 座席データを再取得してUIを復元する関数
async function refreshSeatData() {
  try {
    const currentMode = localStorage.getItem('currentMode') || 'normal';
    const isAdminMode = currentMode === 'admin' || IS_ADMIN;
    const isSuperAdminMode = currentMode === 'superadmin';
    
    // 手動更新時も最小限のデータで十分な場合は最小限データを使用
    let seatData;
    if (isAdminMode || isSuperAdminMode) {
      // 管理者モードの場合は完全なデータを取得
      seatData = await GasAPI.getSeatData(GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode, isSuperAdminMode);
    } else {
      // 通常モードの場合は最小限のデータを取得（高速化）
      seatData = await GasAPI.getSeatDataMinimal(GROUP, DAY, ACTUAL_TIMESLOT, isAdminMode);
    }
    
    if (seatData.success) {
      // 最小限データの場合は既存の座席データとマージ
      if (seatData.seatMap && Object.keys(seatData.seatMap).length > 0) {
        // 既存の座席データを保持しつつ、ステータスのみ更新
        updateSeatMapWithMinimalData(seatData.seatMap);
      } else {
        // 完全なデータの場合は通常通り更新
        drawSeatMap(seatData.seatMap);
      }
      updateLastUpdateTime();
    }
  } catch (error) {
    console.error('座席データ復元エラー:', error);
  }
}

// URL変更時のアニメーション通知を表示する関数
function showUrlChangeAnimation(oldUrl, newUrl, changeType = 'rotation') {
  console.log('[Animation] showUrlChangeAnimation 呼び出し:', { oldUrl, newUrl, changeType });
  
  // 通知要素を作成
  const notification = document.createElement('div');
  notification.className = 'url-change-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    max-width: 90vw;
    text-align: center;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
  `;

  // アイコンとメッセージを設定
  const icon = changeType === 'rotation' ? '↻' : '⚡';
  const message = changeType === 'rotation' ? 'API URL ローテーション' : 'API URL ランダム選択';
  
  // スクリプトIDを抽出（/macros/s/以降の部分）
  const scriptId = newUrl.split('/macros/s/')[1]?.split('/')[0] || 'unknown';
  const displayId = scriptId.substring(0, 8) + '...';
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span style="font-size: 16px; font-weight: bold;">${icon}</span>
      <span>${message}</span>
      <span style="opacity: 0.8; font-size: 12px;">(${displayId})</span>
    </div>
  `;

  // 通知表示用のCSS
  if (!document.getElementById('url-change-animation-styles')) {
    const style = document.createElement('style');
    style.id = 'url-change-animation-styles';
    style.textContent = `
      @keyframes slideInDown {
        from {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
      }
      @keyframes slideOutUp {
        from {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
        }
        to {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px);
        }
      }
      .url-change-notification {
        animation: slideInDown 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
      .url-change-notification.hiding {
        animation: slideOutUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
      }
    `;
    document.head.appendChild(style);
  }

  // 通知を表示
  console.log('[Animation] 通知要素をDOMに追加');
  document.body.appendChild(notification);

  // アニメーション開始
  console.log('[Animation] アニメーション開始');
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(-50%) translateY(0)';
    console.log('[Animation] アニメーション適用完了');
  });

  // 3秒後に自動で消す
  setTimeout(() => {
    notification.classList.add('hiding');
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  }, 3000);

  // クリックで即座に消す
  notification.addEventListener('click', () => {
    notification.classList.add('hiding');
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 300);
  });
}

// URL変更を監視する関数
let lastKnownUrl = apiUrlManager.getCurrentUrl();
function checkForUrlChange() {
  const currentUrl = apiUrlManager.getCurrentUrl();
  console.log('[URL Change Check] 現在のURL:', currentUrl);
  console.log('[URL Change Check] 前回のURL:', lastKnownUrl);
  
  if (currentUrl !== lastKnownUrl) {
    console.log('[URL Change] 検知:', lastKnownUrl, '→', currentUrl);
    console.log('[URL Change] showUrlChangeAnimation を呼び出し');
    showUrlChangeAnimation(lastKnownUrl, currentUrl, 'rotation');
    lastKnownUrl = currentUrl;
  } else {
    console.log('[URL Change] 変更なし');
  }
}

// オフライン状態インジケーターの制御
function initializeOfflineIndicator() {
  const indicator = document.getElementById('offline-indicator');
  const progressBar = document.getElementById('sync-progress-bar');
  
  if (!indicator || !progressBar) return;
  
  // オフライン状態の監視
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
  
  // 初期状態の設定
  updateOfflineStatus();
  
  // イベントリスナーの設定
  window.addEventListener('online', updateOfflineStatus);
  window.addEventListener('offline', updateOfflineStatus);
  
  // オフライン同期システムの状態監視
  if (window.OfflineSyncV2) {
    const checkSyncStatus = () => {
      const status = window.OfflineSyncV2.getStatus();
      
      if (status.syncInProgress) {
        progressBar.style.display = 'block';
        const progress = progressBar.querySelector('.progress');
        if (progress) {
          progress.style.width = '100%';
        }
      } else {
        progressBar.style.display = 'none';
        const progress = progressBar.querySelector('.progress');
        if (progress) {
          progress.style.width = '0%';
        }
      }
    };
    
    // 定期的に状態をチェック
    setInterval(checkSyncStatus, 1000);
    
  // 初期状態のチェック
  checkSyncStatus();
  
  // URL変更の定期チェック（30秒ごと）
  setInterval(checkForUrlChange, 30000);
}
}

