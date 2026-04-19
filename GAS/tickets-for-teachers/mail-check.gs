// 予約完了メール自動送信システム
// ログスプレッドシートID（main.gsと同じ）
const LOG_SPREADSHEET_ID = '1GN8FNw9BnLiP9GkihMaQqHlsfyE85k3T5DXKamYhVTw';
const SHEET_NAME = 'ParentApplications';

// メール送信処理のメイン関数
function sendReservationEmails() {
  try {
    console.log('予約完了メール送信処理開始');
    
    // ログスプレッドシートを開く
    const ss = SpreadsheetApp.openById(LOG_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    
    if (!sheet) {
      console.error('ログシートが見つかりません:', SHEET_NAME);
      return;
    }
    
    // データを取得（A列からI列まで）
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      console.log('データがありません');
      return;
    }
    
    // ヘッダー行をスキップして処理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 1; // 実際の行番号
      
      // A-H列のデータを取得
      const grade = row[0]; // A列: 学年
      const timestamp = row[1]; // B列: タイムスタンプ
      const classSelection = row[2]; // C列: class_selection
      const responsibleClass = row[3]; // D列: ご担当クラス
      const name = row[4]; // E列: 氏名
      const email = row[5]; // F列: メールアドレス
      const seatList = row[6]; // G列: 座席リスト
      const timeslot = row[7]; // H列: 時間帯
      const emailSent = row[8]; // I列: メール送信状況
      
      // I列が空でない場合はスキップ
      if (emailSent && emailSent.toString().trim() !== '') {
        console.log(`行${rowNumber}: メール送信済み - スキップ`);
        continue;
      }
      
      // 必須項目のチェック
      if (!email || !name || !seatList) {
        console.log(`行${rowNumber}: 必須項目が不足 - スキップ`);
        continue;
      }
      
      // メール送信
      try {
        sendReservationEmail({
          email: email,
          name: name,
          grade: grade,
          classSelection: classSelection,
          responsibleClass: responsibleClass,
          seatList: seatList,
          timeslot: timeslot,
          timestamp: timestamp
        });
        
        // I列に送信完了を記録
        sheet.getRange(rowNumber, 9).setValue('送信完了');
        console.log(`行${rowNumber}: メール送信完了 - ${email}`);
        
        // 送信間隔を空ける（レート制限対策）
        Utilities.sleep(1000);
        
      } catch (emailError) {
        console.error(`行${rowNumber}: メール送信エラー - ${email}`, emailError);
        // エラーでもI列に記録
        sheet.getRange(rowNumber, 9).setValue('送信エラー: ' + emailError.toString());
      }
    }
    
    console.log('予約完了メール送信処理完了');
    
  } catch (error) {
    console.error('メール送信処理エラー:', error);
  }
}

// 予約完了メールを送信する関数
function sendReservationEmail(data) {
  const subject = '演劇祭整理券に関するご案内';
  
  // 時間帯の詳細情報を取得
  const timeslotInfo = getTimeslotInfo(data.timeslot, data.classSelection);
  const performanceTime = timeslotInfo ? timeslotInfo.time : data.timeslot;
  
  const body = `${data.name}先生

Good evening,

We're excited that the cultural festival is just a day away. We'd like to explain how to use your numbered ticket on the day of the event.

When you arrive for the performance of your chosen class, please show this email or the previous one to the staff at the reception desk.
The reception staff will confirm your reserved seat, and then a member of the ushering team will guide you to your seat.

We look forward to seeing you tomorrow.

Sincerely,

The 5th Stage Festival Executive Committee, Ticket Section



--------Here is a copy of the email that was sent previously.---------

ご予約を承りました。

------------------
 申請日時：${data.timestamp ? new Date(data.timestamp).toLocaleString('ja-JP') : '未入力'}
 観劇予定クラス：${data.responsibleClass || '未入力'}組
 時間帯：${performanceTime}${timeslotInfo ? ` (${timeslotInfo.title})` : ''}
 担当クラス：${data.grade || '未入力'}年${data.classSelection || '未入力'}組
 氏名：${data.name}
 予約座席一覧：${data.seatList}
${timeslotInfo ? ` 演目：${timeslotInfo.play_title}` : ''}
------------------

このメールは当日受付にて整理券として使用することができます。
ご不明点はnzn.engeki5@gmail.comまでご連絡ください。`;

  GmailApp.sendEmail(data.email, subject, body);
  console.log(`メール送信完了: ${data.email}`);
}

// 時間帯情報を取得する関数（config.jsのCLASS_EVENT_INFOから）
function getTimeslotInfo(timeslotId, classSelection) {
  const CLASS_EVENT_INFO = {
    '1': {
      day1_performance1: { time: '9:15', title: '第一公演', play_title: '話が違う！' },
      day1_performance2: { time: '11:15', title: '第二公演', play_title: '話が違う！' },
      day1_performance3: { time: '13:15', title: '第三公演', play_title: '話が違う！' },
      day2_performance1: { time: '9:35', title: '第一公演', play_title: '話が違う！' },
      day2_performance2: { time: '11:35', title: '第二公演', play_title: '話が違う！' },
      day2_performance3: { time: '13:35', title: '第三公演', play_title: '話が違う！' }
    },
    '2': {
      day1_performance1: { time: '10:25', title: '第一公演', play_title: 'ある脱出ゲーム' },
      day1_performance2: { time: '12:25', title: '第二公演', play_title: 'ある脱出ゲーム' },
      day1_performance3: { time: '14:25', title: '第三公演', play_title: 'ある脱出ゲーム' },
      day2_performance1: { time: '9:15', title: '第一公演', play_title: 'ある脱出ゲーム' },
      day2_performance2: { time: '11:15', title: '第二公演', play_title: 'ある脱出ゲーム' },
      day2_performance3: { time: '13:15', title: '第三公演', play_title: 'ある脱出ゲーム' }
    },
    '3': {
      day1_performance1: { time: '9:25', title: '第一公演', play_title: 'ポプコーンの降る街' },
      day1_performance2: { time: '11:35', title: '第二公演', play_title: 'ポプコーンの降る街' },
      day1_performance3: { time: '14:55', title: '第三公演', play_title: 'ポプコーンの降る街' },
      day2_performance1: { time: '9:25', title: '第一公演', play_title: 'ポプコーンの降る街' },
      day2_performance2: { time: '11:25', title: '第二公演', play_title: 'ポプコーンの降る街' },
      day2_performance3: { time: '13:25', title: '第三公演', play_title: 'ポプコーンの降る街' }
    },
    '4': {
      day1_performance1: { time: '9:15', title: '第一公演', play_title: '庭園の何処かに潜伏していると仮定される盗賊の行方に関する一考察 ～羽柴邸に於ける旧ロマノフ家のダイヤ盗難事件を基に～' },
      day1_performance2: { time: '11:15', title: '第二公演', play_title: '庭園の何処かに潜伏していると仮定される盗賊の行方に関する一考察 ～羽柴邸に於ける旧ロマノフ家のダイヤ盗難事件を基に～' },
      day1_performance3: { time: '13:35', title: '第三公演', play_title: '庭園の何処かに潜伏していると仮定される盗賊の行方に関する一考察 ～羽柴邸に於ける旧ロマノフ家のダイヤ盗難事件を基に～' },
      day2_performance1: { time: '9:15', title: '第一公演', play_title: '庭園の何処かに潜伏していると仮定される盗賊の行方に関する一考察 ～羽柴邸に於ける旧ロマノフ家のダイヤ盗難事件を基に～' },
      day2_performance2: { time: '11:15', title: '第二公演', play_title: '庭園の何処かに潜伏していると仮定される盗賊の行方に関する一考察 ～羽柴邸に於ける旧ロマノフ家のダイヤ盗難事件を基に～' },
      day2_performance3: { time: '13:15', title: '第三公演', play_title: '庭園の何処かに潜伏していると仮定される盗賊の行方に関する一考察 ～羽柴邸に於ける旧ロマノフ家のダイヤ盗難事件を基に～' }
    },
    '5': {
      day1_performance1: { time: '9:35', title: '第一公演', play_title: 'チェンジ・ザ・ワールド' },
      day1_performance2: { time: '11:35', title: '第二公演', play_title: 'チェンジ・ザ・ワールド' },
      day1_performance3: { time: '14:45', title: '第三公演', play_title: 'チェンジ・ザ・ワールド' },
      day2_performance1: { time: '9:35', title: '第一公演', play_title: 'チェンジ・ザ・ワールド' },
      day2_performance2: { time: '11:35', title: '第二公演', play_title: 'チェンジ・ザ・ワールド' },
      day2_performance3: { time: '13:35', title: '第三公演', play_title: 'チェンジ・ザ・ワールド' }
    },
    '6': {
      day1_performance1: { time: '9:25', title: '第一公演', play_title: '七人の部長' },
      day1_performance2: { time: '11:25', title: '第二公演', play_title: '七人の部長' },
      day1_performance3: { time: '13:45', title: '第三公演', play_title: '七人の部長' },
      day2_performance1: { time: '9:25', title: '第一公演', play_title: '七人の部長' },
      day2_performance2: { time: '11:25', title: '第二公演', play_title: '七人の部長' },
      day2_performance3: { time: '13:55', title: '第三公演', play_title: '七人の部長' }
    },
    '7': {
      day1_performance1: { time: '10:25', title: '第一公演', play_title: 'サマータイムマシンブルース' },
      day1_performance2: { time: '12:25', title: '第二公演', play_title: 'サマータイムマシンブルース' },
      day1_performance3: { time: '14:25', title: '第三公演', play_title: 'サマータイムマシンブルース' },
      day2_performance1: { time: '9:15', title: '第一公演', play_title: 'サマータイムマシンブルース' },
      day2_performance2: { time: '11:15', title: '第二公演', play_title: 'サマータイムマシンブルース' },
      day2_performance3: { time: '13:25', title: '第三公演', play_title: 'サマータイムマシンブルース' }
    },
    '8': {
      day1_performance1: { time: '9:15', title: '第一公演', play_title: 'Memento ～忘却の夏' },
      day1_performance2: { time: '11:25', title: '第二公演', play_title: 'Memento ～忘却の夏' },
      day1_performance3: { time: '13:35', title: '第三公演', play_title: 'Memento ～忘却の夏' },
      day2_performance1: { time: '9:35', title: '第一公演', play_title: 'Memento ～忘却の夏' },
      day2_performance2: { time: '11:35', title: '第二公演', play_title: 'Memento ～忘却の夏' },
      day2_performance3: { time: '13:35', title: '第三公演', play_title: 'Memento ～忘却の夏' }
    }
  };
  
  // class_selectionで指定されたクラスの時間帯情報を取得
  if (classSelection && CLASS_EVENT_INFO[classSelection] && CLASS_EVENT_INFO[classSelection][timeslotId]) {
    return CLASS_EVENT_INFO[classSelection][timeslotId];
  }
  
  return null;
}

// テスト用関数（1件のみ送信）
function testSendEmail() {
  try {
    const ss = SpreadsheetApp.openById(LOG_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      console.log('テストデータがありません');
      return;
    }
    
    // 最初のデータ行をテスト
    const row = data[1];
    const testData = {
      email: row[5],
      name: row[4],
      grade: row[0],
      classSelection: row[2],
      responsibleClass: row[3],
      seatList: row[6],
      timeslot: row[7],
      timestamp: row[1]
    };
    
    console.log('テストデータ:', testData);
    sendReservationEmail(testData);
    
  } catch (error) {
    console.error('テスト送信エラー:', error);
  }
}

// 手動実行用のトリガー設定関数
function setupTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendReservationEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 5分ごとに実行するトリガーを作成
  ScriptApp.newTrigger('sendReservationEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
    
  console.log('トリガー設定完了: 5分ごとに実行');
}

// トリガー削除関数
function deleteTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'sendReservationEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log('トリガー削除完了');
}
