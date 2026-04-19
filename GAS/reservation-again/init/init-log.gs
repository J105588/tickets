// 「ParentApplications」（ログ用）シート初期化関数（全時間帯対応）
function initializeLogSheet() {
  console.log('ログシート初期化処理開始');
  
  // ログシートIDの配列
  const logSheetIds = [
    '16fONsc5Ktv1UWAaYrb3LfJRllsQYdjC6wYBLkQBuEac', // day1_performance1
    '17LIw2buJTxu10RsufRa37mxIHfs8Jem-lYFyFeir7M4', // day1_performance2
    '1-8yFJ64pav1iccWvQ5P81yOg0ZbwKf0-Sc4tl1uaJoU', // day1_performance3
    '1-AEey73FGes0iPPPigPZMhltjkohQ-5OEcgUHaavSKQ', // day2_performance1
    '1-uySj1xh9JXn0a1VSx_ZF_aQMjADKVqgvkfmEosGMUY', // day2_performance2
    '11G6a3YroQYq1R8MLTWF24GjaaMp-NQGN4i9dy4jHe2I'  // day2_performance3
  ];

  for (let i = 0; i < logSheetIds.length; i++) {
    try {
      console.log(`ログシート初期化開始: ${i + 1}/${logSheetIds.length}`);
      const ss = SpreadsheetApp.openById(logSheetIds[i]);
      const sheet = ss.getSheetByName('ParentApplications') || ss.insertSheet('ParentApplications');
      sheet.clear();
      sheet.appendRow(['タイムスタンプ', 'クラス', '氏名', 'メール', '座席リスト', '']);
      console.log(`ログシート初期化完了: ${i + 1}/${logSheetIds.length}`);
    } catch (error) {
      console.error(`ログシート初期化エラー (${i + 1}/${logSheetIds.length}):`, error);
    }
  }
  
  console.log('全ログシート初期化処理完了');
  return 'ログシート初期化完了';
}