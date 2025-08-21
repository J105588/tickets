// timeslot-main.js

// 必要なモジュールをインポートします
// GasAPIは将来的に使う可能性を考慮してインポートしていますが、現時点では直接使っていません。
import GasAPI from './api.js';
import { loadSidebar, toggleSidebar } from './sidebar.js';
// timeslot-schedules.jsは getAllTimeslotsForGroup を提供すると仮定します。
// もしファイル名や関数名が違う場合は、ここを修正してください。
import { getAllTimeslotsForGroup } from './timeslot-schedules.js';

// --- 初期化処理 (ページの読み込み時に自動で実行されます) ---

const urlParams = new URLSearchParams(window.location.search);
const group = urlParams.get('group');

// 組名をページのタイトル部分に表示
document.getElementById('group-name').textContent = isNaN(parseInt(group)) ? group : group + '組';

// サイドバーを読み込んでページに配置
loadSidebar();

// 時間帯データを読み込んで表示
loadTimeslots(group);

// --- グローバル関数の登録 ---
// HTMLの onclick="..." から呼び出せるように、関数をwindowオブジェクトに登録します。
window.toggleSidebar = toggleSidebar;
window.selectTimeslot = selectTimeslot;

// --- 関数定義 ---

/**
 * ユーザーが時間帯を選択したときに呼び出される関数
 * @param {number | string} day - 日 (例: 1)
 * @param {string} timeslot - 時間帯 (例: 'A')
 */
function selectTimeslot(day, timeslot) {
  // URLから管理者モードかどうかを判断
  const isAdmin = urlParams.get('admin') === 'true';
  let targetPage = 'seats.html';
  let additionalParams = '';

  // 管理者モードなら、移動先のURLにもadmin=trueパラメータを付与
  if (isAdmin) {
    additionalParams = '&admin=true';
  }

  const url = `${targetPage}?group=${encodeURIComponent(group)}&day=${day}&timeslot=${timeslot}${additionalParams}`;
  window.location.href = url;
}

/**
 * 指定された組の時間帯データを取得し、ページに表示する関数
 * @param {string} group - 組名 (例: '1', '見本演劇')
 */
function loadTimeslots(group) {
  const container = document.getElementById('timeslot-container');
  // timeslot-schedules.jsから時間割データを取得
  const timeslots = getAllTimeslotsForGroup(group);

  if (!timeslots || timeslots.length === 0) {
    container.innerHTML = '<p class="description">この組に設定された公演時間帯がありません。</p>';
    return;
  }

  // 時間割データを「日」ごとにグループ分けする
  const timeslotsByDay = timeslots.reduce((acc, ts) => {
    (acc[ts.day] = acc[ts.day] || []).push(ts);
    return acc;
  }, {});

  // 表示するHTMLを生成
  let html = '';
  for (const day in timeslotsByDay) {
    html += `
      <div class="timeslot-section">
        <h2>${getDayName(day)}</h2>
        <div class="grid-container">
    `;
    
    for (const ts of timeslotsByDay[day]) {
      // javascript:void(0) は、リンクをクリックしてもページ遷移しないためのおまじない
      html += `<a class="grid-item" href="javascript:void(0)" onclick="selectTimeslot('${ts.day}', '${ts.timeslot}')">${ts.displayName}</a>`;
    }
    
    html += `
        </div>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

/**
 * 数字の日付を「N日目」という文字列に変換するヘルパー関数
 * @param {number | string} day 
 * @returns {string}
 */
function getDayName(day) {
  return day == 1 ? '1日目' : '2日目';
}
