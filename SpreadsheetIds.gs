// ==== スプレッドシートID管理ファイル ====
// [修正済] キーの形式を 'group-day-timeslot' に変更
// [追加] 操作対象のシート名を定数として定義

// 操作対象のシート名（固定）
const TARGET_SEAT_SHEET_NAME = "Seats";  // リネーム: 値は"Seats"に統一
const LOG_SHEET_NAME = "ParentApplications";

// 座席管理用スプレッドシートID
const SEAT_SHEET_IDS = {
  // 1組
  "1-1-A": "YOUR_SHEET_ID_HERE", "1-1-B": "YOUR_SHEET_ID_HERE", "1-1-C": "YOUR_SHEET_ID_HERE",
  "1-2-D": "YOUR_SHEET_ID_HERE", "1-2-E": "YOUR_SHEET_ID_HERE", "1-2-F": "YOUR_SHEET_ID_HERE",
  // 2組
  "2-1-A": "YOUR_SHEET_ID_HERE", "2-1-B": "YOUR_SHEET_ID_HERE", "2-1-C": "YOUR_SHEET_ID_HERE",
  "2-2-D": "YOUR_SHEET_ID_HERE", "2-2-E": "YOUR_SHEET_ID_HERE", "2-2-F": "YOUR_SHEET_ID_HERE",
  // 3組
  "3-1-A": "YOUR_SHEET_ID_HERE", "3-1-B": "YOUR_SHEET_ID_HERE", "3-1-C": "YOUR_SHEET_ID_HERE",
  "3-2-D": "YOUR_SHEET_ID_HERE", "3-2-E": "YOUR_SHEET_ID_HERE", "3-2-F": "YOUR_SHEET_ID_HERE",
  // 4組
  "4-1-A": "YOUR_SHEET_ID_HERE", "4-1-B": "YOUR_SHEET_ID_HERE", "4-1-C": "YOUR_SHEET_ID_HERE",
  "4-2-D": "YOUR_SHEET_ID_HERE", "4-2-E": "YOUR_SHEET_ID_HERE", "4-2-F": "YOUR_SHEET_ID_HERE",
  // 5組
  "5-1-A": "YOUR_SHEET_ID_HERE", "5-1-B": "YOUR_SHEET_ID_HERE", "5-1-C": "YOUR_SHEET_ID_HERE",
  "5-2-D": "YOUR_SHEET_ID_HERE", "5-2-E": "YOUR_SHEET_ID_HERE", "5-2-F": "YOUR_SHEET_ID_HERE",
  // 6組
  "6-1-A": "YOUR_SHEET_ID_HERE", "6-1-B": "YOUR_SHEET_ID_HERE", "6-1-C": "YOUR_SHEET_ID_HERE",
  "6-2-D": "YOUR_SHEET_ID_HERE", "6-2-E": "YOUR_SHEET_ID_HERE", "6-2-F": "YOUR_SHEET_ID_HERE",
  // 7組
  "7-1-A": "YOUR_SHEET_ID_HERE", "7-1-B": "YOUR_SHEET_ID_HERE", "7-1-C": "YOUR_SHEET_ID_HERE",
  "7-2-D": "YOUR_SHEET_ID_HERE", "7-2-E": "YOUR_SHEET_ID_HERE", "7-2-F": "YOUR_SHEET_ID_HERE",
  // 8組
  "8-1-A": "YOUR_SHEET_ID_HERE", "8-1-B": "YOUR_SHEET_ID_HERE", "8-1-C": "YOUR_SHEET_ID_HERE",
  "8-2-D": "YOUR_SHEET_ID_HERE", "8-2-E": "YOUR_SHEET_ID_HERE", "8-2-F": "YOUR_SHEET_ID_HERE",
  // 見本演劇
  "見本演劇-1-A": "1-lBQMuwjs0YnOpSt3nI8jQmHyNOqUNHiP3i2xXMcbmA",
  "見本演劇-1-B": "164pnCFDZKmrHlwU0J857NzxRHBeFgdKLzxCwM7DKZmo"
};

// ログ用スプレッドシートID (キーを座席シートと合わせる)
const LOG_SHEET_IDS = {
  "1-1-A": "YOUR_LOG_ID_HERE", "1-1-B": "YOUR_LOG_ID_HERE", // ... 各公演に対応するID
};

// スプレッドシートIDを取得する関数
function getSeatSheetId(group, day, timeslot) {
  const key = `${group}-${day}-${timeslot}`;
  let id = SEAT_SHEET_IDS[key];
  
  // デバッグ情報を出力
  console.log(`getSeatSheetId: 検索キー=${key}, 結果=${id || 'なし'}`);
  
  // IDが見つからない場合、テスト用の「見本演劇」のIDを使用
  if (!id || id === "YOUR_SHEET_ID_HERE") {
    if (group === '見本演劇') {
      // 見本演劇のIDを使用
      const testKey = `見本演劇-${day}-${timeslot}`;
      id = SEAT_SHEET_IDS[testKey];
      console.log(`テスト用キーで再検索: ${testKey}, 結果=${id || 'なし'}`);
      
      if (id && id !== "YOUR_SHEET_ID_HERE") {
        return id;
      }
    }
    
    // それでもIDが見つからない場合はエラー
    throw new Error(`座席シートIDが設定されていません: [組: ${group}, 日: ${day}, 時間帯: ${timeslot}]`);
  }
  return id;
}

function getLogSheetId(group, day, timeslot) {
  const key = `${group}-${day}-${timeslot}`;
  const id = LOG_SHEET_IDS[key];
  
  if (!id || id === "YOUR_LOG_ID_HERE") {
    console.log(`ログシートIDが設定されていません: [組: ${group}, 日: ${day}, 時間帯: ${timeslot}]`);
    return null;
  }
  return id;
}