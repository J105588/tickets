/**
 * 当日券発行画面のメイン処理
 */

import GasAPI from './api.js'; // GasAPIをインポート
import { loadSidebar } from './sidebar.js'; // loadSidebarをインポート

// URLパラメータ取得
const urlParams = new URLSearchParams(window.location.search);
const GROUP = urlParams.get('group');
const DAY = urlParams.get('day');
const TIMESLOT = urlParams.get('timeslot');

// 初期化
window.onload = () => {
  // サイドバー読み込み
  loadSidebar();
  
  // 表示情報設定
  const groupName = isNaN(parseInt(GROUP)) ? GROUP : GROUP + '組';
  document.getElementById('performance-info').textContent = `${groupName} ${DAY}日目 ${TIMESLOT}`;
  document.getElementById('reservation-details').innerHTML = `
    座席が確保されました<br>
    ${groupName} ${DAY}日目 ${TIMESLOT}
  `;
};

function showLoader(visible) {
  const loader = document.getElementById('loading-modal');
  loader.style.display = visible ? 'block' : 'none';
}

async function issueWalkinTicket() {
  const walkinBtn = document.getElementById('walkin-btn');
  const reservationResult = document.getElementById('reservation-result');
  const reservedSeatEl = document.getElementById('reserved-seat');
  
  walkinBtn.disabled = true;
  walkinBtn.textContent = '空席を検索中...';
  showLoader(true);
  
  reservationResult.classList.remove('show');

  try {
    const response = await GasAPI.assignWalkInSeat(GROUP, DAY, TIMESLOT);
    
    alert(response.message);
    
    if (response.success) {
      walkinBtn.textContent = `発行完了 (座席: ${response.seatId || '不明'})`;
      walkinBtn.style.background = '#28a745';
      
      if (response.seatId) {
        reservedSeatEl.textContent = response.seatId;
        reservationResult.classList.add('show');
      }
      
      setTimeout(() => {
        walkinBtn.disabled = false;
        walkinBtn.textContent = '再度、空席を探して当日券を発行する';
        walkinBtn.style.background = '#28a745';
      }, 3000);
    } else {
      walkinBtn.disabled = false;
      walkinBtn.textContent = '再度、空席を探す';
    }
  } catch (error) {
    alert("エラーが発生しました: " + error.message);
    walkinBtn.disabled = false;
    walkinBtn.textContent = '空席を探して当日券を発行する';
  } finally {
    showLoader(false);
  }
}
