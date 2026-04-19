function sendMailOnNewEntry_checkStatus() {
  var sheetsId = "1572XpUz5g0h3yM9R6grg351LyYOxkBCoQ8_YBqvwKAg";
  var sheetName = "ParentApplications";
  var sheet = SpreadsheetApp.openById(sheetsId).getSheetByName(sheetName);

  var data = sheet.getDataRange().getValues();
  var timeZone = "9月21日_13:35〜14:30"; // 必要に応じて修正

  // 1行目はヘッダーなので2行目から順に確認
  for (var i = 1; i < data.length; i++) {
    var 申請日時 = data[i][0];
    var クラス = data[i][1];
    var 氏名 = data[i][2];
    var メール = data[i][3];
    var 予約座席一覧 = data[i][4];
    var メール送信済み = data[i][5];

    // 送信済みでない行のみ処理
    if (!メール送信済み) {
      var subject = "3年8組＿整理券の申請完了のお知らせ";
      var body =
`${氏名}様

ご予約を承りました。

------------------
申請日時：${申請日時}
クラス：${クラス}
時間帯：${timeZone}
氏名：${氏名}
予約座席一覧：${予約座席一覧}
------------------

このメールは当日受付にて整理券として使用することができます。
ご不明点はnzn.engeki5@gmail.comまでご連絡ください。`;

      // メール送信
      GmailApp.sendEmail(メール, subject, body);

      // 送信済みフラグをシートに記録
      sheet.getRange(i + 1, 6).setValue("送信済み"); // 6列目が「メール送信済み」
    }
  }
}