// 2日間6公演分（12個）のスプレッドシートID設定
const PERFORMANCE_SHEETS = {
  // 1日目
  'day1_performance1': {
    seats: '1wLASeHBC0Q4KnC_cyluKEu6wtCVBtPiNv7yiADPNloY', // 1日目第1公演の座席シート
    log: '16fONsc5Ktv1UWAaYrb3LfJRllsQYdjC6wYBLkQBuEac'   // 1日目第1公演のログシート
  },
  'day1_performance2': {
    seats: '1LlfdQgwma0PKoP2l7R1sUd2PtjDs211UByloZJGzJPw', // 1日目第2公演の座席シート
    log: '17LIw2buJTxu10RsufRa37mxIHfs8Jem-lYFyFeir7M4'   // 1日目第2公演のログシート
  },
  'day1_performance3': {
    seats: '1ChzERkmw5dGfYcPxn1o8JTVTRJtnh5hWhYzKCUYbb2c', // 1日目第3公演の座席シート
    log: '1-8yFJ64pav1iccWvQ5P81yOg0ZbwKf0-Sc4tl1uaJoU'   // 1日目第3公演のログシート
  },
  // 2日目
  'day2_performance1': {
    seats: '17scOod0T2fsrWzWlwWOBhcpX-NhSjOjrBN8ySJcFvJA', // 2日目第1公演の座席シート
    log: '1-AEey73FGes0iPPPigPZMhltjkohQ-5OEcgUHaavSKQ'   // 2日目第1公演のログシート
  },
  'day2_performance2': {
    seats: '1eU0GVeRQoMd-PxrkalgW2VKY-jRZuVW_5rQt-KfjcgA', // 2日目第2公演の座席シート
    log: '1-uySj1xh9JXn0a1VSx_ZF_aQMjADKVqgvkfmEosGMUY'   // 2日目第2公演のログシート
  },
  'day2_performance3': {
    seats: '12PuN0RvjqHzupiqJ7peAeve-MU-DAXJmQfaE9imVowM', // 2日目第3公演の座席シート
    log: '11G6a3YroQYq1R8MLTWF24GjaaMp-NQGN4i9dy4jHe2I'   // 2日目第3公演のログシート
  }
};

// ライセンスキー用スプレッドシート
const SPREADSHEET_ID_KEY = '17w2V9kudoj_EAYUn-gsOG6PhH-_ComyWT6LTnWMXazg';
const KEY_SHEET_NAME = 'keys';

// 申込〆切
const PARENT_APP_DEADLINE = new Date("2025-09-14T23:59:59+09:00"); 

// 時間帯に基づいてスプレッドシートIDを取得
function getSheetIdsByTimeslot(timeslot) {
  if (!PERFORMANCE_SHEETS[timeslot]) {
    throw new Error('無効な時間帯です: ' + timeslot);
  }
  return PERFORMANCE_SHEETS[timeslot];
}

// 利用可能な時間帯一覧を取得（IDのみ）
function getAvailableTimeslots() {
  return Object.keys(PERFORMANCE_SHEETS);
}

// 「ParentApplications」（ログ用）シート初期化関数
function initializeLogSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID_LOG);
  const sheet = ss.getSheetByName('ParentApplications') || ss.insertSheet('ParentApplications');
  sheet.clear();
  sheet.appendRow(['タイムスタンプ', 'クラス', '氏名', 'メール', '座席リスト']);
}

// 締切日時（ミリ秒）を取得
function getDeadlineTimestamp() {
  return PARENT_APP_DEADLINE.getTime();
}

// 全座席状態を取得（時間帯指定）
function getAllSeats(timeslot) {
  try {
    const sheetIds = getSheetIdsByTimeslot(timeslot);
    const sheet = SpreadsheetApp.openById(sheetIds.seats).getSheetByName("Seats");
    
    if (!sheet) {
      throw new Error('座席シートが見つかりません');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      throw new Error('座席データがありません');
    }
    
    const seats = data.slice(1).map(r => ({
      row: String(r[0] || ''),
      col: Number(r[1] || 0),
      status: String(r[2] || '空')
    }));
    
    console.log(`時間帯 ${timeslot} の座席データ:`, seats);
    return seats;
  } catch (error) {
    console.error('座席データ取得エラー:', error);
    throw error;
  }
}

/**
 * 申込時：複数座席を一括確保＆ログ記録（時間帯指定）
 * @param {string} timeslot - 時間帯
 * @param {string|number} classNo - クラス番号
 * @param {string} name - 氏名
 * @param {string} mail - メールアドレス
 * @param {Array<{row:string, col:number}>} selectedSeatsArr - 申込座席リスト [{row:..., col:...}, ...]
 */
function submitMultipleSeats(timeslot, classNo, name, mail, selectedSeatsArr) {
  try {
    console.log('座席申込開始:', { timeslot, classNo, name, mail, selectedSeatsArr });
    
    const sheetIds = getSheetIdsByTimeslot(timeslot);
    
    // 座席確保
    const sheetSeats = SpreadsheetApp.openById(sheetIds.seats).getSheetByName("Seats");
    const allRows = sheetSeats.getDataRange().getValues();
    let seatResults = [];
    
    selectedSeatsArr.forEach(sel => {
      console.log(`座席 ${sel.row}-${sel.col} を処理中`);
      
      for (let i = 1; i < allRows.length; i++) { // i=1はヘッダ除外
        const rowData = allRows[i];
        const seatRow = String(rowData[0] || '');
        const seatCol = Number(rowData[1] || 0);
        const seatStatus = String(rowData[2] || '');
        
        if (seatRow === String(sel.row) && seatCol === Number(sel.col)) {
          console.log(`座席 ${sel.row}-${sel.col} の現在の状態: ${seatStatus}`);
          
          if (seatStatus !== "確保" && seatStatus !== "予約済") {
            sheetSeats.getRange(i+1, 3).setValue("確保");
            sheetSeats.getRange(i+1, 4).setValue(name);
            seatResults.push(sel.row + "-" + sel.col + "：OK");
            console.log(`座席 ${sel.row}-${sel.col} を確保しました`);
          } else {
            const statusText = seatStatus === "確保" ? "既に確保済" : "予約済";
            seatResults.push(sel.row + "-" + sel.col + "：" + statusText);
            console.log(`座席 ${sel.row}-${sel.col} は${statusText}です`);
          }
          break;
        }
      }
    });

    // 応募ログ記録
    const logSheet = SpreadsheetApp.openById(sheetIds.log).getSheetByName("ParentApplications")
      || SpreadsheetApp.openById(sheetIds.log).insertSheet("ParentApplications");
    
    // ヘッダなければ追加（初回対応）
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(['タイムスタンプ', 'クラス', '氏名', 'メール', '座席リスト', '']);
    }
    
    const seatList = selectedSeatsArr.map(s => s.row + "-" + s.col).join(",");
    logSheet.appendRow([
      new Date(),
      classNo,
      name,
      mail,
      seatList,
      '' // 時間帯は記入しない
    ]);
    
    console.log('ログ記録完了:', { classNo, name, mail, seatList, timeslot });
    
    const result = "以下の座席を確保しました：\n" + seatResults.join("\n");
    console.log('申込結果:', result);
    return result;
    
  } catch (error) {
    console.error('座席申込エラー:', error);
    throw error;
  }
}

function isValidKey(key) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID_KEY).getSheetByName(KEY_SHEET_NAME);
  var keys = sheet.getDataRange().getValues().flat();
  return keys.includes(key);
}

function validateLicense() {
  const LICENSE_KEY = '3YM,Iqb?v2L6';
  if (!isValidKey(LICENSE_KEY)) {
    throw new Error('このライセンスキーは無効です。');
  }
  return true;
}

// JSONP通信用API関数
function doGet(e) {
  const action = e.parameter.action;
  const callback = e.parameter.callback;
  
  try {
    let result;
    
    switch(action) {
      case 'timeslots':
        result = getAvailableTimeslots();
        break;
      case 'seats':
        const timeslot = e.parameter.timeslot;
        if (!timeslot) throw new Error('時間帯が指定されていません');
        result = getAllSeats(timeslot);
        break;
      case 'submit':
        const submitTimeslot = e.parameter.timeslot;
        const classNo = e.parameter.classNo;
        const name = e.parameter.name;
        const mail = e.parameter.mail;
        let selectedSeats = [];
        try {
          selectedSeats = JSON.parse(e.parameter.selectedSeats || '[]');
        } catch (parseError) {
          throw new Error('座席データの形式が正しくありません');
        }
        if (!submitTimeslot || !classNo || !name || !mail) {
          throw new Error('必須パラメータが不足しています');
        }
        if (!Array.isArray(selectedSeats)) {
          throw new Error('座席データが配列ではありません');
        }
        result = submitMultipleSeats(submitTimeslot, classNo, name, mail, selectedSeats);
        break;
      case 'deadline':
        result = { deadline: getDeadlineTimestamp() };
        break;
      default:
        // デフォルトは時間帯選択ページを表示
        return HtmlService.createHtmlOutputFromFile("timeslot").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setTitle('保護者用整理券_時間帯選択').setFaviconUrl('https://drive.google.com/uc?export=view&id=1o_vG3tbagtu8TKicz2Fu45vSqKu_kBVx&.png').addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    
    // JSONPレスポンス
    const jsonpResponse = callback ? `${callback}(${JSON.stringify(result)});` : JSON.stringify(result);
    return ContentService.createTextOutput(jsonpResponse).setMimeType(ContentService.MimeType.JAVASCRIPT);
    
  } catch (error) {
    const errorResult = { error: error.message };
    const jsonpResponse = callback ? `${callback}(${JSON.stringify(errorResult)});` : JSON.stringify(errorResult);
    return ContentService.createTextOutput(jsonpResponse).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}