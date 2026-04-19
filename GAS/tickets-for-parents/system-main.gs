// スプレッドシートID
const SHEET_ID_SEATS = '1O9c_e67tnydLn3Q6z4hWUy_J_Eb5lwKYPeHz4BBtXTg';
const SHEET_ID_LOG   = '1-S7vjHUQjj2INbWcAOcn2i-SwjZv-LL90Sb-wNNNM8g';
const SPREADSHEET_ID_KEY = '17w2V9kudoj_EAYUn-gsOG6PhH-_ComyWT6LTnWMXazg';
const KEY_SHEET_NAME = 'keys';
 
// 申込〆切
const PARENT_APP_DEADLINE = new Date("2025-08-21T23:59:59+09:00"); 

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

// 全座席状態を取得
function getAllSeats() {
  const sheet = SpreadsheetApp.openById(SHEET_ID_SEATS).getSheetByName("Seats");
  const data = sheet.getDataRange().getValues().slice(1); // 1行目はヘッダー
  return data.map(r => ({
    row: r[0],
    col: Number(r[1]),
    status: r[2]
  }));
}

/**
 * 申込時：複数座席を一括確保＆ログ記録
 * @param {string|number} classNo - クラス番号
 * @param {string} name - 氏名
 * @param {string} mail - メールアドレス
 * @param {Array<{row:string, col:number}>} selectedSeatsArr - 申込座席リスト [{row:..., col:...}, ...]
 */
function submitMultipleSeats(classNo, name, mail, selectedSeatsArr) {
  // 座席確保
  const sheetSeats = SpreadsheetApp.openById(SHEET_ID_SEATS).getSheetByName("Seats");
  const allRows = sheetSeats.getDataRange().getValues();
  let seatResults = [];
  selectedSeatsArr.forEach(sel => {
    for (let i = 1; i < allRows.length; i++) { // i=1はヘッダ除外
      if (allRows[i][0] == sel.row && Number(allRows[i][1]) == Number(sel.col)) {
        if (allRows[i][2] !== "確保") {
          sheetSeats.getRange(i+1, 3).setValue("確保");
          sheetSeats.getRange(i+1, 4).setValue(name);
          seatResults.push(sel.row + "-" + sel.col + "：OK");
        } else {
          seatResults.push(sel.row + "-" + sel.col + "：既に確保済");
        }
        break;
      }
    }
  });

  // 応募ログ記録
  const logSheet = SpreadsheetApp.openById(SHEET_ID_LOG).getSheetByName("ParentApplications")
    || SpreadsheetApp.openById(SHEET_ID_LOG).insertSheet("ParentApplications");
  // ヘッダなければ追加（初回対応）
  if (logSheet.getLastRow() === 0) {
    logSheet.appendRow(['タイムスタンプ', 'クラス', '氏名', 'メール', '座席リスト']);
  }
  logSheet.appendRow([
    new Date(),
    classNo,
    name,
    mail,
    selectedSeatsArr.map(s => s.row + "-" + s.col).join(","),
  ]);
  return "以下の座席を確保しました：\n" + seatResults.join("\n");
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

// Web公開用
function doGet() {
  return HtmlService.createHtmlOutputFromFile("parent_multi").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).setTitle('保護者用整理券_8組9:15-10:10').setFaviconUrl('https://drive.google.com/uc?export=view&id=1o_vG3tbagtu8TKicz2Fu45vSqKu_kBVx&.png').addMetaTag('viewport', 'width=device-width, initial-scale=1');
}