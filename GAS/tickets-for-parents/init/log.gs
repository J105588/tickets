//触らないこと
function initializeSeats() {
  const ss = SpreadsheetApp.openById(SHEET_ID_SEATS);
  const sheet = ss.getSheetByName('Seats') || ss.insertSheet('Seats');
  sheet.clear();
  sheet.appendRow(['行','列','状態','予約者','チェックイン']);
  const rows = ['A','B','C','D','E'], cols = 12;
  for (let r = 0; r < rows.length; r++) {
    for (let c = 1; c <= cols; c++) {
      sheet.appendRow([rows[r], c, "空", "", ""]);
    }
  }
}