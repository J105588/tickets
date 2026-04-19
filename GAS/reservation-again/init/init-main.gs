function initializeSeats() {
  console.log('座席シート初期化処理開始');
  
  // 座席シートIDの配列
  const seatSheetIds = [
    '1wLASeHBC0Q4KnC_cyluKEu6wtCVBtPiNv7yiADPNloY', // day1_performance1
    '1LlfdQgwma0PKoP2l7R1sUd2PtjDs211UByloZJGzJPw', // day1_performance2
    '1ChzERkmw5dGfYcPxn1o8JTVTRJtnh5hWhYzKCUYbb2c', // day1_performance3
    '17scOod0T2fsrWzWlwWOBhcpX-NhSjOjrBN8ySJcFvJA', // day2_performance1
    '1eU0GVeRQoMd-PxrkalgW2VKY-jRZuVW_5rQt-KfjcgA', // day2_performance2
    '12PuN0RvjqHzupiqJ7peAeve-MU-DAXJmQfaE9imVowM'  // day2_performance3
  ];

  for (let i = 0; i < seatSheetIds.length; i++) {
    try {
      console.log(`座席シート初期化開始: ${i + 1}/${seatSheetIds.length}`);
      const ss = SpreadsheetApp.openById(seatSheetIds[i]);
      const sheet = ss.getSheetByName('Seats') || ss.insertSheet('Seats');
      sheet.clear();
      sheet.appendRow(['行','列','状態','予約者','チェックイン']);
      
      const rows = ['A','B','C','D','E'], cols = 12;
      for (let r = 0; r < rows.length; r++) {
        for (let c = 1; c <= cols; c++) {
          sheet.appendRow([rows[r], c, "空", "", ""]);
        }
      }
      console.log(`座席シート初期化完了: ${i + 1}/${seatSheetIds.length}`);
    } catch (error) {
      console.error(`座席シート初期化エラー (${i + 1}/${seatSheetIds.length}):`, error);
    }
  }
  
  console.log('全座席シート初期化処理完了');
  return '座席シート初期化完了';
}