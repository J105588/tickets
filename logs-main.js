// logs-main.js - ログ表示システムのメイン処理

import GasAPI from './api.js';
import { loadSidebar, toggleSidebar } from './sidebar.js';

// グローバル変数
let currentLogs = [];
let autoRefreshInterval = null;
let isAutoRefreshEnabled = false;

// 初期化
window.onload = async () => {
  try {
    // サイドバー読み込み
    loadSidebar();
    
    // グローバル関数を登録
    window.toggleSidebar = toggleSidebar;
    window.refreshLogs = refreshLogs;
    window.toggleAutoRefresh = toggleAutoRefresh;
    window.applyFilters = applyFilters;
    window.showLogDetail = showLogDetail;
    window.closeLogDetail = closeLogDetail;
    
    // 初期データ読み込み
    await loadStatistics();
    await loadLogs();
    
    // フィルター用の操作一覧を取得
    await loadOperationList();
    
    // イベントリスナー設定
    setupEventListeners();
    
    console.log('ログ表示システム初期化完了');
  } catch (error) {
    console.error('初期化エラー:', error);
    showError('初期化に失敗しました: ' + error.message);
  }
};

// イベントリスナー設定
function setupEventListeners() {
  // フィルター変更時のイベント
  document.getElementById('operation-filter').addEventListener('change', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  document.getElementById('limit-filter').addEventListener('change', applyFilters);
  
  // モーダル外クリックで閉じる
  document.getElementById('log-detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'log-detail-modal') {
      closeLogDetail();
    }
  });
  
  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeLogDetail();
    }
  });
}

// 統計情報を読み込み
async function loadStatistics() {
  try {
    const response = await GasAPI._callApi('getClientAuditStatistics', []);
    
    if (response.success) {
      updateStatistics(response.statistics);
    } else {
      console.warn('統計情報の取得に失敗:', response.message);
    }
  } catch (error) {
    console.error('統計情報読み込みエラー:', error);
  }
}

// 統計情報を更新
function updateStatistics(stats) {
  document.getElementById('total-operations').textContent = stats.totalOperations || 0;
  document.getElementById('success-count').textContent = stats.successCount || 0;
  document.getElementById('error-count').textContent = stats.errorCount || 0;
  document.getElementById('last-update').textContent = new Date().toLocaleTimeString('ja-JP');
}

// ログを読み込み
async function loadLogs() {
  try {
    showLoading(true);
    
    const limit = parseInt(document.getElementById('limit-filter').value) || 100;
    const type = document.getElementById('operation-filter').value || null;
    const response = await GasAPI._callApi('getClientAuditLogs', [limit, type, null]);
    
    if (response.success) {
      currentLogs = response.logs || [];
      updateLogsTable();
      updateLogsCount();
    } else {
      console.error('ログ取得エラー:', response.message);
      showError('ログの取得に失敗しました: ' + response.message);
    }
  } catch (error) {
    console.error('ログ読み込みエラー:', error);
    showError('ログの読み込みに失敗しました: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// 操作一覧を読み込み（フィルター用）
async function loadOperationList() {
  try {
    const response = await GasAPI._callApi('getOperationLogs', [1000]); // 多めに取得
    
    if (response.success && response.logs) {
      const operations = [...new Set(response.logs.map(log => log.type))].sort();
      const operationFilter = document.getElementById('operation-filter');
      
      // 既存のオプションをクリア（"すべて"以外）
      while (operationFilter.children.length > 1) {
        operationFilter.removeChild(operationFilter.lastChild);
      }
      
      // 操作一覧を追加
      operations.forEach(operation => {
        const option = document.createElement('option');
        option.value = operation;
        option.textContent = operation;
        operationFilter.appendChild(option);
      });
    }
  } catch (error) {
    console.error('操作一覧読み込みエラー:', error);
  }
}

// ログテーブルを更新
function updateLogsTable() {
  const tbody = document.getElementById('logs-table-body');
  
  if (currentLogs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="no-data">ログがありません</td></tr>';
    return;
  }
  
  tbody.innerHTML = currentLogs.map(log => {
    const timestamp = new Date(log.timestamp).toLocaleString('ja-JP');
    const shortMeta = truncateJson(log.metadata, 80);
    return `
      <tr>
        <td>${timestamp}</td>
        <td>${log.type}</td>
        <td>${log.action}</td>
        <td><code>${shortMeta}</code></td>
        <td>${log.sessionId || '-'}</td>
        <td>${log.ipAddress || '-'}</td>
        <td><button class="detail-btn" onclick="showLogDetail('${log.timestamp}')">詳細</button></td>
      </tr>
    `;
  }).join('');
}

// JSON文字列を短縮
function truncateJson(jsonStr, maxLength) {
  if (!jsonStr || jsonStr === 'null') return '-';
  
  try {
    const parsed = JSON.parse(jsonStr);
    const str = JSON.stringify(parsed, null, 2);
    return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;
  } catch (e) {
    return jsonStr.length > maxLength ? jsonStr.substring(0, maxLength) + '...' : jsonStr;
  }
}

// ログ件数を更新
function updateLogsCount() {
  document.getElementById('logs-count').textContent = `${currentLogs.length}件`;
}

// ログ詳細を表示
function showLogDetail(timestamp) {
  const log = currentLogs.find(l => l.timestamp === timestamp);
  if (!log) return;
  
  // モーダルにデータを設定
  document.getElementById('detail-timestamp').textContent = new Date(log.timestamp).toLocaleString('ja-JP');
  document.getElementById('detail-operation').textContent = `${log.type} / ${log.action}`;
  document.getElementById('detail-status').innerHTML = '';
  document.getElementById('detail-ip').textContent = log.ipAddress || '-';
  
  // JSON表示
  try {
    const meta = JSON.parse(log.metadata);
    document.getElementById('detail-parameters').textContent = JSON.stringify(meta, null, 2);
  } catch (e) {
    document.getElementById('detail-parameters').textContent = log.metadata;
  }
  
  document.getElementById('detail-result').textContent = '';
  
  document.getElementById('detail-useragent').textContent = log.userAgent;
  
  // モーダルを表示
  document.getElementById('log-detail-modal').classList.add('show');
}

// ログ詳細を閉じる
function closeLogDetail() {
  document.getElementById('log-detail-modal').classList.remove('show');
}

// フィルターを適用
async function applyFilters() {
  await loadLogs();
}

// ログを更新
async function refreshLogs() {
  await loadStatistics();
  await loadLogs();
}

// 自動更新を切り替え
function toggleAutoRefresh() {
  isAutoRefreshEnabled = !isAutoRefreshEnabled;
  const button = document.getElementById('auto-refresh-btn');
  
  if (isAutoRefreshEnabled) {
    button.textContent = '自動更新: ON';
    button.classList.add('active');
    autoRefreshInterval = setInterval(refreshLogs, 30000); // 30秒ごと
  } else {
    button.textContent = '自動更新: OFF';
    button.classList.remove('active');
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  }
}

// ローディング表示
function showLoading(show) {
  const loading = document.getElementById('logs-loading');
  if (show) {
    loading.style.display = 'inline';
  } else {
    loading.style.display = 'none';
  }
}

// エラー表示
function showError(message) {
  const errorContainer = document.getElementById('error-container');
  const errorMessage = document.getElementById('error-message');
  
  if (errorContainer && errorMessage) {
    errorMessage.textContent = message;
    errorContainer.style.display = 'flex';
  } else {
    alert(message);
  }
}

// ページが非表示になったら自動更新を停止
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isAutoRefreshEnabled) {
    // ページが非表示の時は自動更新を一時停止
    if (autoRefreshInterval) {
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
    }
  } else if (!document.hidden && isAutoRefreshEnabled) {
    // ページが表示されたら自動更新を再開
    autoRefreshInterval = setInterval(refreshLogs, 30000);
  }
});

// ページ離脱時に自動更新を停止
window.addEventListener('beforeunload', () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
});
