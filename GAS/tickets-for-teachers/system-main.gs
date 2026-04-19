// 2日間6公演 × 8クラス分の座席スプレッドシートID設定
// フォーマット: SEAT_SHEETS[timeslot][classNo] = seatSpreadsheetId
const SEAT_SHEETS = {
  // 1日目
  'day1_performance1': {
    '1': '105mJ7NiqErTuw-HTZ4DEeFzuwPU_Q7jF6T8sDz6GMLg',
    '2': '1-lFkkIexOJaTATptpfNHaoMFCwID9TcR1ppsxZYLVZg',
    '3': '134GGmFihAgrobpPooUUAVUFzbYtyvYnEnQr3udNWm-o',
    '4': '15QtZAUX9kQNVloezB6aoP1Pmi7Z8Ux13yk9lf40Kvb0',
    '5': '1wLASeHBC0Q4KnC_cyluKEu6wtCVBtPiNv7yiADPNloY',
    '6': '1fPDzspL690RblXyCICg96Pbz6ToqlW-uFDT-a-0I7nQ',
    '7': '1O0_nSRsD1e7dK2fPlVMshzB_OVlhN-stxQe3QAzF18w',
    '8': '1O9c_e67tnydLn3Q6z4hWUy_J_Eb5lwKYPeHz4BBtXTg'
  },
  'day1_performance2': {
    '1': '106_lanDCnaHI8JKADXT4onsYvxInNbjG9EJ6mYmT8DU',
    '2': '1wZAosN52tT6r-nGhmqef7D3hMr84G_DzcITRv8DWpXs',
    '3': '14CiceV1pQKoExRwbyeuUGu0-_MgxjhgN2teKW0vYuuY',
    '4': '10o4Iw0ylMbfSNXIfbW_O0AYDHLwvr6qUMsXDeseFV6E',
    '5': '1LlfdQgwma0PKoP2l7R1sUd2PtjDs211UByloZJGzJPw',
    '6': '1NO7Mj_H5293tTvE5rK_qwgpjDUW5i7LA6mjfJ_UrZDo',
    '7': '1zMoucGkaxKpEzXALftskl-J6pgINLaVbuK9Uj6C_s2c',
    '8': '1SN_oeSkO-fTcxgx7tn-UdALhVi_BAGlH_oizrMz665M'
  },
  'day1_performance3': {
    '1': '11eOIN-z9Vmshq8SuX7WL21Is0Hmi9VY-0gaRU-BNBJM',
    '2': '1ddtGS5mi8u5GlXXy05JNFQQhgCHt8OFec_PIbsl4nFg',
    '3': '14RyWL9obyOt-QTwh4wszfUj3s7TTTLBzYhTE7_I-cq0',
    '4': '149XTBHRYoXO_SXgA79t94OP-JFjJrI-eYdGmh9sKDKU',
    '5': '1ChzERkmw5dGfYcPxn1o8JTVTRJtnh5hWhYzKCUYbb2c',
    '6': '1qd24qbTgZcy4JL237wEl18h0OmvMUIwX6svsW1bnY5c',
    '7': '109tcX5PgGotZJQAuTJw9mCJM78WJMtVKXqSqslL2UH0',
    '8': '1hr1wWDCRCF3kLPX0x4C8ITJZwdyme0WdBbiAMU4q98w'
  },
  // 2日目
  'day2_performance1': {
    '1': '12Hf6MMWSSXWwIkKcWYfKAeCUVIRWZjy6dc8fCf1vRls',
    '2': '1QD2uasnnw3A3vs-WzxkA52ELZp3pLFth7QiDO0A2cZ4',
    '3': '14diDfaj_XL4GG_KoD66HUgoDG8bMfJQAvYzt0lyz4IY',
    '4': '14FhIX82yhy9sJ0Ekz57GI7EF2KK3xRyV6AQRvE5gYJw',
    '5': '17scOod0T2fsrWzWlwWOBhcpX-NhSjOjrBN8ySJcFvJA',
    '6': '18YR-V7cz0UvSjw7HSPuLy6N3mcEpRKC-D6Ukpw4PAr4',
    '7': '1ewqf50VtyqB1RkMC57eb3Ii8n-AIc5SoY58gZ7g6bwY',
    '8': '1FOHVv1jgcH2tH9_-i6iVJoQ-lujY2Q2c1AxXi1op-sI'
  },
  'day2_performance2': {
    '1': '12_DBdPD8BqEkPkSti_5VZeDTmy4Yu-vV50xMYZIV-tI',
    '2': '1NY9Fgo_2vdo7qcBAicL6PqGPpG7nJDFaCLQvG0ehg2Q',
    '3': '14uPFpBjU4PfDtFuXXQj4EIgUOcxBtDELw0ou7F2CTLc',
    '4': '14ZGabVoY4SSFU_jCm7vR6Y8Ydfy5jJKTs32giNa9yQw',
    '5': '1eU0GVeRQoMd-PxrkalgW2VKY-jRZuVW_5rQt-KfjcgA',
    '6': '1ScjH1DM1iYirzlpt07JpQ6aYbn2_NP3fzH0YCUmM1GM',
    '7': '1wnR24GP_gyOZJ5xFHr-SpEIvCkwqD6-4sFnjtle8uWE',
    '8': '10A2JRuvw-GX7jsqqL26eJHwYrYLHz3ZUk1xsFxysdZk'
  },
  'day2_performance3': {
    '1': '12_HRwCwXHYPxuVAwAX3OMoWlnDpZHLnD3FCdICeFfe4',
    '2': '1fzx9zOtbH6PCrG0DCwN19WxUokBgjxiF1DNwYklrlQ0',
    '3': '15AvQFV2gnRnaw3P2zsvngmxB0vJ2za6HJF8GyMaJhVE',
    '4': '154oykIoJaNnqUnxmpQqnqBf_Tcg__O18bO3bbVJcGvQ',
    '5': '12PuN0RvjqHzupiqJ7peAeve-MU-DAXJmQfaE9imVowM',
    '6': '1EaeYZNtN_21h6GmTSIOMdC6kv0GAGWfVPEovE5JSz84',
    '7': '11HQ9MKGUBioVihHfdYBAIO98J6uRKEREkieGlaulY0A',
    '8': '1020McijS7TnOrXS2Fmv3Js2blLR_HntXoqANg0Gi6sU'
  }
};

// ログは全クラス・全時間帯で共通のスプレッドシートを使用
const LOG_SPREADSHEET_ID = '1GN8FNw9BnLiP9GkihMaQqHlsfyE85k3T5DXKamYhVTw';

// ライセンスキー用スプレッドシート
const SPREADSHEET_ID_KEY = '17w2V9kudoj_EAYUn-gsOG6PhH-_ComyWT6LTnWMXazg';
const KEY_SHEET_NAME = 'keys';

// 申込〆切
const PARENT_APP_DEADLINE = new Date("2025-09-18T23:59:59+09:00");

// クラス別の設定（必要に応じて拡張可能）
const CLASS_CONFIG = {
  '1': { name: '1組', color: '#10cea7' },
  '2': { name: '2組', color: '#10cea7' },
  '3': { name: '3組', color: '#10cea7' },
  '4': { name: '4組', color: '#10cea7' },
  '5': { name: '5組', color: '#10cea7' },
  '6': { name: '6組', color: '#10cea7' },
  '7': { name: '7組', color: '#10cea7' },
  '8': { name: '8組', color: '#10cea7' }
}; 

// 時間帯・クラスに基づいて座席スプレッドシートIDを取得
function getSeatSheetId(timeslot, classNo) {
  if (!SEAT_SHEETS[timeslot]) {
    throw new Error('無効な時間帯です: ' + timeslot);
  }
  const classId = String(classNo);
  const seatId = SEAT_SHEETS[timeslot][classId];
  if (!seatId) {
    throw new Error('この時間帯に対するクラスの設定が見つかりません: ' + classId);
  }
  return seatId;
}

// 利用可能な時間帯一覧を取得（IDのみ）
function getAvailableTimeslots() {
  return Object.keys(SEAT_SHEETS);
}

// 利用可能なクラス一覧を取得
function getAvailableClasses() {
  return Object.keys(CLASS_CONFIG);
}

// 「ParentApplications」（ログ用）シート初期化関数
function initializeLogSheet() {
  const ss = SpreadsheetApp.openById(LOG_SPREADSHEET_ID);
  const sheet = ss.getSheetByName('ParentApplications') || ss.insertSheet('ParentApplications');
  sheet.clear();
  sheet.appendRow(['学年', 'タイムスタンプ', 'class_selection', 'ご担当クラス', '氏名', 'メール', '座席リスト', '時間帯']);
}

// 締切日時（ミリ秒）を取得
function getDeadlineTimestamp() {
  return PARENT_APP_DEADLINE.getTime();
}

// 全座席状態を取得（時間帯・クラス指定）
function getAllSeats(timeslot, classNo) {
  try {
    const seatSheetId = getSeatSheetId(timeslot, classNo);
    const sheet = SpreadsheetApp.openById(seatSheetId).getSheetByName("Seats");
    
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
    
    console.log(`時間帯 ${timeslot} クラス ${classNo} の座席データ取得:`, seats.length, '件');
    console.log(`座席データ詳細:`, seats);
    return seats;
  } catch (error) {
    console.error('座席データ取得エラー:', error);
    throw error;
  }
}

/**
 * 申込時：複数座席を一括確保＆ログ記録（時間帯・クラス指定）
 * @param {string} timeslot - 時間帯
 * @param {string|number} classNo - クラス番号
 * @param {string} name - 氏名
 * @param {string} mail - メールアドレス
 * @param {Array<{row:string, col:number}>} selectedSeatsArr - 申込座席リスト [{row:..., col:...}, ...]
 * @param {string} grade - 学年
 * @param {string|number} selectedClass - 選択されたクラス
 */
function submitMultipleSeats(timeslot, classNo, name, mail, selectedSeatsArr, grade, selectedClass) {
  try {
    console.log('座席申込開始:', { timeslot, classNo, name, mail, selectedSeatsArr, grade, selectedClass });
    
    const seatSheetId = getSeatSheetId(timeslot, classNo);
    
    // 座席確保
    const sheetSeats = SpreadsheetApp.openById(seatSheetId).getSheetByName("Seats");
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
            console.log(`座席 ${sel.row}-${sel.col} を確保しました (行${i+1})`);
          } else {
            const statusText = seatStatus === "確保" ? "既に確保済" : "予約済";
            seatResults.push(sel.row + "-" + sel.col + "：" + statusText);
            console.log(`座席 ${sel.row}-${sel.col} は${statusText}です (行${i+1})`);
          }
          break;
        }
      }
    });

    // 応募ログ記録（共通ログ）
    try {
      console.log('ログ記録開始:', { LOG_SPREADSHEET_ID, classNo, name, mail, timeslot });
      
      const logSs = SpreadsheetApp.openById(LOG_SPREADSHEET_ID);
      console.log('ログスプレッドシート接続成功');
      
      const logSheet = logSs.getSheetByName("ParentApplications") || logSs.insertSheet("ParentApplications");
      console.log('ログシート取得成功:', logSheet.getName());
      
      // ヘッダなければ追加（初回対応）
      if (logSheet.getLastRow() === 0) {
        logSheet.appendRow(['学年', 'タイムスタンプ', 'class_selection', 'ご担当クラス', '氏名', 'メール', '座席リスト', '時間帯']);
        console.log('ログシートヘッダー追加完了');
      }
      
      const seatList = selectedSeatsArr.map(s => s.row + "-" + s.col).join(",");
      const logData = [
        grade || '',
        new Date(),
        selectedClass || classNo, // class_selection（class_selection.htmlで選択されたクラス）
        classNo, // ご担当クラス（parent_multi.htmlのフォーム入力内容）
        name,
        mail,
        seatList,
        timeslot // 時間帯を記録
      ];
      
      console.log('ログデータ:', logData);
      logSheet.appendRow(logData);
      console.log('ログ記録完了:', { classNo, name, mail, seatList, timeslot });
    } catch (logError) {
      console.error('ログ記録エラー:', logError);
      console.error('エラー詳細:', logError.toString());
      // ログエラーでも座席確保は継続
    }
    
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
      case 'classes':
        result = getAvailableClasses();
        break;
      case 'seats':
        const timeslot = e.parameter.timeslot;
        const classNoForSeats = e.parameter.classNo || e.parameter.class; // 互換
        if (!timeslot) throw new Error('時間帯が指定されていません');
        if (!classNoForSeats) throw new Error('クラスが指定されていません');
        result = getAllSeats(timeslot, classNoForSeats);
        break;
      case 'submit':
        const submitTimeslot = e.parameter.timeslot;
        const classNo = e.parameter.classNo;
        const selectedClass = e.parameter.selectedClass || classNo; // 選択クラス（デフォルトはclassNo）
        const grade = e.parameter.grade;
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
        result = submitMultipleSeats(submitTimeslot, classNo, name, mail, selectedSeats, grade, selectedClass);
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