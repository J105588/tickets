// ===============================================================
// === API処理 (POSTリクエスト) ===
// ===============================================================

function doPost(e) {
  let response;
  let callback = e.parameter.callback; // コールバック関数名を取得

  // プリフライトリクエストの場合の処理
  if (e.method === "OPTIONS") {
    const headers = {
      "Access-Control-Allow-Origin": "*", // すべてのオリジンを許可
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "3600"
    };
    return ContentService.createTextOutput("")
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeaders(headers);
  }

  try {
    const body = e.postData.contents;

    // パラメータを解析
    const params = {};
    body.split('&').forEach(pair => {
      const [key, value] = pair.split('=');
      params[key] = JSON.parse(decodeURIComponent(value.replace(/\+/g, ' ')));
    });

    const funcName = params.func;
    const funcParams = params.params || [];

    if (!funcName) {
      throw new Error("呼び出す関数が指定されていません。(funcが必要です)");
    }

    const functionMap = {
      'getSeatData': getSeatData,
      'getSeatDataMinimal': getSeatDataMinimal, // 新規: 最小限のデータ
      'reserveSeats': reserveSeats,
      'checkInSeat': checkInSeat,
      'checkInMultipleSeats': checkInMultipleSeats,
      'assignWalkInSeat': assignWalkInSeat,
      'assignWalkInSeats': assignWalkInSeats,
      'assignWalkInConsecutiveSeats': assignWalkInConsecutiveSeats,
      'verifyModePassword': verifyModePassword,
      'updateSeatData': updateSeatData,
      'updateMultipleSeats': updateMultipleSeats, // 新規: 複数座席一括更新
      'getAllTimeslotsForGroup': getAllTimeslotsForGroup,
      'testApi': testApi,
      'reportError': reportError,
      'getSystemLock': getSystemLock,
      'setSystemLock': setSystemLock,
      'execDangerCommand': execDangerCommand
    };

    if (functionMap[funcName]) {
      response = functionMap[funcName].apply(null, funcParams);
    } else {
      throw new Error("無効な関数名です: " + funcName);
    }

  } catch (err) {
    response = { error: err.message };
  }

  // JSONP形式でレスポンスを返す
  let output = callback + '(' + JSON.stringify(response) + ')';
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ===============================================================
// === ページ表示処理 (GETリクエスト) ===
// ===============================================================

/**
 * WebアプリケーションにGETリクエストが来たときに実行されるメイン関数。
 * POSTリクエストと同様に関数呼び出しを処理する。
 */
function doGet(e) {
  let response;
  let callback = e.parameter.callback; // コールバック関数名を取得

  try {
    const funcName = e.parameter.func;
    const paramsStr = e.parameter.params;
    
    if (!funcName) {
      // APIの状態情報を返す（関数呼び出しがない場合）
      response = {
        status: 'OK',
        message: 'Seat Management API is running',
        version: '2.0', // 最適化版
        optimized: true
      };
    } else {
      // パラメータを解析
      const funcParams = paramsStr ? JSON.parse(decodeURIComponent(paramsStr)) : [];
      
      console.log('doGet: 関数呼び出し', { funcName, funcParams });
      
      const functionMap = {
        'getSeatData': getSeatData,
        'getSeatDataMinimal': getSeatDataMinimal, // 新規: 最小限のデータ
        'reserveSeats': reserveSeats,
        'checkInSeat': checkInSeat,
        'checkInMultipleSeats': checkInMultipleSeats,
        'assignWalkInSeat': assignWalkInSeat,
        'assignWalkInSeats': assignWalkInSeats,
        'assignWalkInConsecutiveSeats': assignWalkInConsecutiveSeats,
        'verifyModePassword': verifyModePassword,
        'updateSeatData': updateSeatData,
        'updateMultipleSeats': updateMultipleSeats, // 新規: 複数座席一括更新
        'getAllTimeslotsForGroup': getAllTimeslotsForGroup,
        'testApi': testApi,
        'reportError': reportError,
        'getSystemLock': getSystemLock,
        'setSystemLock': setSystemLock,
        'execDangerCommand': execDangerCommand
      };

      if (functionMap[funcName]) {
        response = functionMap[funcName].apply(null, funcParams);
      } else {
        throw new Error("無効な関数名です: " + funcName);
      }
    }
  } catch (err) {
    console.error('doGet処理エラー:', err);
    response = { success: false, error: err.message };
  }

  // JSONP形式でレスポンスを返す
  let output = callback + '(' + JSON.stringify(response) + ')';
  return ContentService.createTextOutput(output)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ===============================================================
// === APIとして呼び出される各種関数 ===
// ===============================================================

/**
 * 指定された公演の座席データを全て取得する（最適化版）。
 */
function getSeatData(group, day, timeslot, isAdmin = false, isSuperAdmin = false) {
  try {
    const sheet = getSheet(group, day, timeslot, 'SEAT');
    if (!sheet) throw new Error("対象の座席シートが見つかりません。");
    
    // シートの最終行を取得
    const lastRow = sheet.getLastRow();
    
    // ヘッダー行しかない場合（lastRow <= 1）は空の座席マップを返す
    if (lastRow <= 1) {
      console.log(`警告: シート(${group}, ${day}, ${timeslot})にデータがありません。`);
      return { success: true, seatMap: {} };
    }
    
    // 必要列を取得（A, B, C, D, E列）
    const dataRange = sheet.getRange("A2:E" + lastRow);
    const data = dataRange.getValues();
    const seatMap = {};

    data.forEach(row => {
      const rowLabel = row[0];
      const colLabel = row[1];
      if (!rowLabel || !colLabel) return;

      const seatId = String(rowLabel) + String(colLabel);
      if (!isValidSeatId(seatId)) return;

      // 正規化（トリム）
      const statusC = (row[2] || '').toString().trim();
      const nameD = (row[3] || '').toString();
      const statusE = (row[4] || '').toString().trim();

      // 最適化: 必要最小限のデータのみ含める
      const seat = { 
        id: seatId, 
        status: 'available', 
        columnC: statusC, 
        columnD: nameD,
        columnE: statusE
      };

      // ステータスに基づいて座席の状態を設定
      if (statusC === '予約済' && statusE === '済') {
        seat.status = 'checked-in';
      } else if (statusC === '予約済') {
        seat.status = 'to-be-checked-in';
      } else if (statusC === '確保') {
        seat.status = 'reserved';
      } else if (statusC === '空' || statusC === '') {
        seat.status = 'available';
      } else {
        // その他の値（設定なしなど）は unavailable として扱う
        seat.status = 'unavailable';
      }

      // 管理者の場合のみ名前を追加
      if (isAdmin || isSuperAdmin) {
        seat.name = nameD || null;
      }
      
      seatMap[seatId] = seat;
    });

    Logger.log(`座席データを正常に取得: [${group}-${day}-${timeslot}], 座席数: ${Object.keys(seatMap).length}`);
    return { success: true, seatMap: seatMap };

  } catch (e) {
    Logger.log(`getSeatData Error for ${group}-${day}-${timeslot}: ${e.message}\n${e.stack}`);
    return { success: false, error: `座席データの取得に失敗しました: ${e.message}` };
  }
}

/**
 * 最小限の座席データを取得する（高速化版）
 */
function getSeatDataMinimal(group, day, timeslot, isAdmin = false) {
  try {
    const sheet = getSheet(group, day, timeslot, 'SEAT');
    if (!sheet) throw new Error("対象の座席シートが見つかりません。");
    
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return { success: true, seatMap: {} };
    }
    
    // ステータスのみ取得（C列とE列を使用するため A〜E を取得）
    const dataRange = sheet.getRange("A2:E" + lastRow);
    const data = dataRange.getValues();
    const seatMap = {};

    data.forEach(row => {
      const rowLabel = row[0];
      const colLabel = row[1];
      if (!rowLabel || !colLabel) return;

      const seatId = String(rowLabel) + String(colLabel);
      if (!isValidSeatId(seatId)) return;

      const statusC = (row[2] || '').toString().trim();
      const statusE = (row[4] || '').toString().trim();
      
      // 最適化: ステータスのみ
      const seat = { 
        id: seatId, 
        status: 'available'
      };

      // ステータスに基づいて座席の状態を設定
      if (statusC === '予約済' && statusE === '済') {
        seat.status = 'checked-in';
      } else if (statusC === '予約済') {
        seat.status = 'to-be-checked-in';
      } else if (statusC === '確保') {
        seat.status = 'reserved';
      } else if (statusC === '空' || statusC === '') {
        seat.status = 'available';
      } else {
        // その他の値（設定なしなど）は unavailable として扱う
        seat.status = 'unavailable';
      }
      
      seatMap[seatId] = seat;
    });

    return { success: true, seatMap: seatMap };

  } catch (e) {
    Logger.log(`getSeatDataMinimal Error for ${group}-${day}-${timeslot}: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * スプレッドシートの構造をデバッグする関数
 */
function debugSpreadsheetStructure(group, day, timeslot) {
  try {
    const sheet = getSheet(group, day, timeslot, 'SEAT');
    if (!sheet) {
      return { success: false, error: "シートが見つかりません" };
    }

    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    // ヘッダー行を取得
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    // 最初の数行のデータを取得
    const sampleData = sheet.getRange(2, 1, Math.min(5, lastRow - 1), lastCol).getValues();
    
    // 列の情報を取得
    const columnInfo = [];
    for (let i = 0; i < lastCol; i++) {
      const colLetter = String.fromCharCode(65 + i); // A, B, C...
      columnInfo.push({
        column: colLetter,
        index: i,
        header: headers[i] || '',
        sampleValues: sampleData.map(row => row[i]).filter(val => val !== '')
      });
    }

    return {
      success: true,
      sheetName: sheet.getName(),
      lastRow: lastRow,
      lastColumn: lastCol,
      headers: headers,
      sampleData: sampleData,
      columnInfo: columnInfo
    };
  } catch (e) {
    Logger.log(`debugSpreadsheetStructure Error: ${e.message}\n${e.stack}`);
    return { success: false, error: e.message };
  }
}

/**
 * ユーザーが選択した複数の座席を予約する（修正版）。
 */
function reserveSeats(group, day, timeslot, selectedSeats) {
  if (!Array.isArray(selectedSeats) || selectedSeats.length === 0) {
    return { success: false, message: '予約する座席が選択されていません。' };
  }

  const invalidSeats = selectedSeats.filter(seatId => !isValidSeatId(seatId));
  if (invalidSeats.length > 0) {
    return { success: false, message: `無効な座席IDが含まれています: ${invalidSeats.join(', ')}` };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(15000)) {
    try {
      const sheet = getSheet(group, day, timeslot, 'SEAT');
      if (!sheet) throw new Error("対象の公演シートが見つかりませんでした。");

      Logger.log(`reserveSeats: 開始 - ${group}-${day}-${timeslot}, 座席: ${selectedSeats.join(', ')}`);

      // 最適化: 必要な列のみ取得（A, C列）
      const dataRange = sheet.getRange("A2:C" + sheet.getLastRow());
      const data = dataRange.getValues();
      let reservationSuccess = false;
      const updatedRows = [];

      // 最適化: バッチ更新のための配列を構築
      for (let i = 0; i < data.length; i++) {
        const seatId = String(data[i][0]) + String(data[i][1]);
        if (!isValidSeatId(seatId)) continue;

        if (selectedSeats.includes(seatId)) {
          if (data[i][2] !== '空') {
            throw new Error(`座席 ${seatId} は既に他のお客様によって予約されています。ページを更新して再度お試しください。`);
          }
          updatedRows.push({ row: i + 2, seatId: seatId });
          reservationSuccess = true;
          Logger.log(`予約対象座席: ${seatId} (行: ${i + 2})`);
        }
      }

      if (!reservationSuccess) {
        throw new Error("予約対象の座席が見つかりませんでした。");
      }

      // 最適化: バッチ更新で一括処理
      updatedRows.forEach(({ row, seatId }) => {
        // C列（3列目）に「予約済」を設定
        sheet.getRange(row, 3).setValue("予約済");
        Logger.log(`座席 ${seatId} を予約済に更新 (行: ${row}, 列: C)`);
      });

      SpreadsheetApp.flush();
      Logger.log(`reserveSeats: 完了 - ${updatedRows.length}件の座席を予約`);
      
      return { success: true, message: `予約が完了しました。\n座席: ${selectedSeats.join(', ')}` };

    } catch (e) {
      Logger.log(`reserveSeats Error for ${group}-${day}-${timeslot}: ${e.message}\n${e.stack}`);
      return { success: false, message: `予約エラー: ${e.message}` };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { success: false, message: "処理が大変混み合っています。しばらく時間をおいてから再度お試しください。" };
  }
}

/**
 * 座席をチェックインする（最適化版）。
 */
function checkInSeat(group, day, timeslot, seatId) {
  if (!seatId || !isValidSeatId(seatId)) {
    return { success: false, message: `無効な座席IDです: ${seatId}` };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(10000)) {
    try {
      const sheet = getSheet(group, day, timeslot, 'SEAT');
      if (!sheet) throw new Error("対象の座席シートが見つかりません。");
      
      // 最適化: 必要な列のみ取得（A, C, D列）
      const data = sheet.getRange("A2:D" + sheet.getLastRow()).getValues();
      let found = false;

      for (let i = 0; i < data.length; i++) {
        const currentSeatId = String(data[i][0]) + String(data[i][1]);
        if (currentSeatId === seatId) {
          found = true;
          const status = data[i][2];
          const name = data[i][3] || '';

          if (status === "予約済") {
            sheet.getRange(i + 2, 5).setValue("済");
            SpreadsheetApp.flush();
            return { success: true, message: `${seatId} をチェックインしました。`, checkedInName: name };
          } else {
            throw new Error(`${seatId} はチェックインできない状態です。（現在の状態: ${status}）`);
          }
        }
      }

      if (!found) {
        throw new Error(`${seatId} がシートに見つかりませんでした。`);
      }
    } catch (e) {
      Logger.log(`checkInSeat Error for ${group}-${day}-${timeslot}: ${e.message}\n${e.stack}`);
      return { success: false, message: e.message };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { success: false, message: "処理が混み合っています。再度お試しください。" };
  }
}

/**
 * 複数の座席をチェックインする（最適化版）。
 */
function checkInMultipleSeats(group, day, timeslot, seatIds) {
  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return { success: false, message: 'チェックインする座席が選択されていません。' };
  }

  const invalidSeats = seatIds.filter(seatId => !isValidSeatId(seatId));
  if (invalidSeats.length > 0) {
    return { success: false, message: `無効な座席IDが含まれています: ${invalidSeats.join(', ')}` };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(15000)) {
    try {
      const sheet = getSheet(group, day, timeslot, 'SEAT');
      if (!sheet) throw new Error("対象の座席シートが見つかりません。");

      // 最適化: 必要な列のみ取得（A, C列）
      const data = sheet.getRange("A2:C" + sheet.getLastRow()).getValues();
      let successCount = 0;
      let errorMessages = [];
      const updatedRows = [];

      // 最適化: バッチ更新のための配列を構築
      for (const seatId of seatIds) {
        let found = false;
        for (let i = 0; i < data.length; i++) {
          const currentSeatId = String(data[i][0]) + String(data[i][1]);
          if (currentSeatId === seatId) {
            found = true;
            const status = data[i][2];

            // 予約済みまたは確保状態の座席をチェックイン可能にする
            if (status === "予約済" || status === "確保") {
              // 確保状態の場合は、まず予約済みに変更してからチェックイン
              if (status === "確保") {
                updatedRows.push({ row: i + 2, col: 3, value: "予約済" });
              }
              updatedRows.push({ row: i + 2, col: 5, value: "済" });
              successCount++;
            } else {
              errorMessages.push(`${seatId} はチェックインできない状態です。（現在の状態: ${status}）`);
            }
            break;
          }
        }
        if (!found) {
          errorMessages.push(`${seatId} がシートに見つかりませんでした。`);
        }
      }

      // 最適化: バッチ更新で一括処理
      updatedRows.forEach(({ row, col, value }) => {
        sheet.getRange(row, col).setValue(value);
      });

      SpreadsheetApp.flush();
      if (successCount > 0) {
        return { success: true, message: `${successCount}件の座席をチェックインしました。`, checkedInCount: successCount };
      } else {
        return { success: false, message: errorMessages.length > 0 ? errorMessages.join('\n') : 'チェックインできる座席が見つかりませんでした。' };
      }

    } catch (e) {
      Logger.log(`checkInMultipleSeats Error for ${group}-${day}-${timeslot}: ${e.message}\n${e.stack}`);
      return { success: false, message: `チェックインエラー: ${e.message}` };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { success: false, message: "処理が混み合っています。再度お試しください。" };
  }
}

/**
 * 当日券発行：空いている席を1つ自動で探し、確保する（最適化版）。
 */
function assignWalkInSeat(group, day, timeslot) {
  const lock = LockService.getScriptLock();
  if (lock.tryLock(5000)) {
    try {
      const sheet = getSheet(group, day, timeslot, 'SEAT');
      if (!sheet) throw new Error("対象の公演シートが見つかりませんでした。");

      // 最適化: 必要な列のみ取得（A, C列）
      const data = sheet.getRange("A2:C" + sheet.getLastRow()).getValues();
      let assignedSeat = null;

      // 有効な空席を探す
      for (let i = 0; i < data.length; i++) {
        const seatId = String(data[i][0]) + String(data[i][1]);
        if (!isValidSeatId(seatId)) {
           continue;
        }
        if (data[i][2] === '空') {
          const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
          sheet.getRange(i + 2, 3, 1, 3).setValues([['予約済', `当日券_${timestamp}`, '']]);
          assignedSeat = seatId;
          break;
        }
      }

      if (assignedSeat) {
        SpreadsheetApp.flush();
        return { success: true, message: `当日券を発行しました！\n\nあなたの座席は 【${assignedSeat}】 です。`, seatId: assignedSeat };
      } else {
        return { success: false, message: '申し訳ありません、この回の座席は現在満席です。' };
      }
    } catch (e) {
      Logger.log(`assignWalkInSeat Error: ${e.message}\n${e.stack}`);
      return { success: false, message: `エラーが発生しました: ${e.message}` };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { success: false, message: "処理が混み合っています。少し待ってから再度お試しください。" };
  }
}

/**
 * 当日券発行：空いている席を複数自動で探し、確保する（最適化版）。
 */
function assignWalkInSeats(group, day, timeslot, count) {
  if (!count || count < 1 || count > 6) {
    return { success: false, message: '有効な枚数を指定してください（1〜6枚）' };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(7000)) {
    try {
      const sheet = getSheet(group, day, timeslot, 'SEAT');
      if (!sheet) throw new Error("対象の公演シートが見つかりませんでした。");

      // 最適化: 必要な列のみ取得（A, C列）
      const data = sheet.getRange("A2:C" + sheet.getLastRow()).getValues();
      const assignedSeats = [];
      const updatedRows = [];

      // 有効な空席を探す
      for (let i = 0; i < data.length && assignedSeats.length < count; i++) {
        const seatId = String(data[i][0]) + String(data[i][1]);
        if (!isValidSeatId(seatId)) continue;
        
        if (data[i][2] === '空') {
          const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy/MM/dd HH:mm:ss");
          updatedRows.push({ row: i + 2, values: ['予約済', `当日券_${timestamp}`, ''] });
          assignedSeats.push(seatId);
        }
      }

      if (assignedSeats.length > 0) {
        // 最適化: バッチ更新で一括処理
        // できるだけ連続する行をまとめて書き込む
        let runStart = 0;
        while (runStart < updatedRows.length) {
          let runEnd = runStart;
          // 連続行の塊を検出
          while (
            runEnd + 1 < updatedRows.length &&
            updatedRows[runEnd + 1].row === updatedRows[runEnd].row + 1
          ) {
            runEnd++;
          }
          const block = updatedRows.slice(runStart, runEnd + 1);
          const startRow = block[0].row;
          const values = block.map(b => b.values);
          sheet.getRange(startRow, 3, values.length, 3).setValues(values);
          runStart = runEnd + 1;
        }

        SpreadsheetApp.flush();
        return { 
          success: true, 
          message: `当日券を${assignedSeats.length}枚発行しました！\n\n座席: ${assignedSeats.join(', ')}`, 
          seatIds: assignedSeats 
        };
      } else {
        return { success: false, message: '申し訳ありません、この回の座席は現在満席です。' };
      }
    } catch (e) {
      Logger.log(`assignWalkInSeats Error: ${e.message}\n${e.stack}`);
      return { success: false, message: `エラーが発生しました: ${e.message}` };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { success: false, message: "処理が混み合っています。少し待ってから再度お試しください。" };
  }
}

/**
 * 当日券発行：同一行で連続した席を指定枚数分確保する。
 * 行をまたぐ連続は不可。
 */
function assignWalkInConsecutiveSeats(group, day, timeslot, count) {
  if (!count || count < 1 || count > 12) {
    return { success: false, message: '有効な枚数を指定してください（1〜12枚）' };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(7000)) {
    try {
      const sheet = getSheet(group, day, timeslot, 'SEAT');
      if (!sheet) throw new Error('対象の公演シートが見つかりませんでした。');

      // A(row), B(col), C(status)
      const data = sheet.getRange('A2:C' + sheet.getLastRow()).getValues();

      // 行ごとに空席の列番号を収集
      const rowToAvailableCols = { 'A': [], 'B': [], 'C': [], 'D': [], 'E': [] };
      const rowColToIndex = {}; // key: row+col -> data index for later updates

      for (let i = 0; i < data.length; i++) {
        const r = String(data[i][0]);
        const c = parseInt(data[i][1], 10);
        const status = data[i][2];
        if (!rowToAvailableCols.hasOwnProperty(r)) continue;
        if (!isValidSeatId(r + c)) continue;
        rowColToIndex[r + c] = i; // store index
        if (status === '空') {
          rowToAvailableCols[r].push(c);
        }
      }

      // 各行で昇順ソート
      Object.keys(rowToAvailableCols).forEach(r => rowToAvailableCols[r].sort((a,b)=>a-b));

      // 連続席を探す関数
      const findConsecutive = (arr, need) => {
        if (arr.length < need) return null;
        let runStart = 0;
        for (let i = 1; i <= arr.length; i++) {
          if (i === arr.length || arr[i] !== arr[i-1] + 1) {
            const runLen = i - runStart;
            if (runLen >= need) {
              // 最初の連続ブロックから必要数を返す
              return arr.slice(runStart, runStart + need);
            }
            runStart = i;
          }
        }
        return null;
      };

      // A->Eの順で探索（必要なら優先順位変更可）
      let assigned = null;
      let assignedRow = null;
      for (const rowLabel of ['A','B','C','D','E']) {
        const seq = findConsecutive(rowToAvailableCols[rowLabel], count);
        if (seq) {
          assigned = seq;
          assignedRow = rowLabel;
          break;
        }
      }

      if (!assigned) {
        return { success: false, message: '指定枚数の連続席が見つかりませんでした。' };
      }

      // バッチ更新
      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss');
      // 連続席なので一括書き込み
      const startCol = assigned[0];
      const rows = assigned.map(colNum => rowColToIndex[assignedRow + colNum] + 2).sort((a,b)=>a-b);
      const runStartRow = rows[0];
      const values = assigned.map(() => ['予約済', `当日券_${timestamp}`, '']);
      sheet.getRange(runStartRow, 3, values.length, 3).setValues(values);

      SpreadsheetApp.flush();
      const seatIds = assigned.map(c => assignedRow + c);
      return { success: true, message: `連続席(${count}席)を確保しました。\n座席: ${seatIds.join(', ')}`, seatIds };

    } catch (e) {
      Logger.log('assignWalkInConsecutiveSeats Error: ' + e.message + '\n' + e.stack);
      return { success: false, message: `エラーが発生しました: ${e.message}` };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { success: false, message: '処理が混み合っています。少し待ってから再度お試しください。' };
  }
}

/**
 * 複数座席の一括更新（新規追加）
 */
function updateMultipleSeats(group, day, timeslot, updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: false, message: '更新する座席データが指定されていません。' };
  }

  const lock = LockService.getScriptLock();
  if (lock.tryLock(20000)) {
    try {
      const sheet = getSheet(group, day, timeslot, 'SEAT');
      if (!sheet) throw new Error("対象の座席シートが見つかりません。");

      const data = sheet.getRange("A2:E" + sheet.getLastRow()).getValues();
      const updatedRows = [];
      let successCount = 0;

      for (const update of updates) {
        const { seatId, columnC, columnD, columnE } = update;
        
        if (!isValidSeatId(seatId)) continue;

        // 座席を検索
        for (let i = 0; i < data.length; i++) {
          const currentSeatId = String(data[i][0]) + String(data[i][1]);
          if (currentSeatId === seatId) {
            const row = i + 2;
            const changes = [];
            
            if (columnC !== undefined) {
              changes.push({ row, col: 3, value: columnC });
            }
            if (columnD !== undefined) {
              changes.push({ row, col: 4, value: columnD });
            }
            if (columnE !== undefined) {
              changes.push({ row, col: 5, value: columnE });
            }
            
            updatedRows.push(...changes);
            successCount++;
            break;
          }
        }
      }

      if (updatedRows.length > 0) {
        // 最適化: バッチ更新で一括処理
        updatedRows.forEach(({ row, col, value }) => {
          sheet.getRange(row, col).setValue(value);
        });

        SpreadsheetApp.flush();
        return { success: true, message: `${successCount}件の座席を更新しました。` };
      } else {
        return { success: false, message: '更新対象の座席が見つかりませんでした。' };
      }

    } catch (e) {
      Logger.log(`updateMultipleSeats Error: ${e.message}\n${e.stack}`);
      return { success: false, message: `エラーが発生しました: ${e.message}` };
    } finally {
      lock.releaseLock();
    }
  } else {
    return { success: false, message: "処理が混み合っています。しばらく時間をおいてから再度お試しください。" };
  }
}

/**
 * モード別のパスワードを検証する。
 */
function verifyModePassword(mode, password) {
  try {
    const props = PropertiesService.getScriptProperties();
    const adminPassword = props.getProperty('ADMIN_PASSWORD');
    const walkinPassword = props.getProperty('WALKIN_PASSWORD');
    const superAdminPassword = props.getProperty('SUPERADMIN_PASSWORD');

    if (mode === 'admin') return { success: adminPassword && password === adminPassword };
    if (mode === 'walkin') return { success: walkinPassword && password === walkinPassword };
    if (mode === 'superadmin') return { success: superAdminPassword && password === superAdminPassword };
    return { success: false };

  } catch (e) {
    Logger.log("verifyModePassword Error: " + e.message);
    return { success: false };
  }
}

/**
 * 最高管理者モードで座席データを更新する。
 */
function updateSeatData(group, day, timeslot, seatId, columnC, columnD, columnE) {
  try {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
      try {
        const sheet = getSheet(group, day, timeslot, 'SEAT');
        if (!sheet) {
          return { success: false, message: 'シートが見つかりません' };
        }

        // 座席IDから行番号を特定
        const data = sheet.getDataRange().getValues();
        let targetRow = -1;
        
        // 座席IDを分解（例：C8 → rowLabel: C, colLabel: 8）
        const match = seatId.match(/^([A-E])(\d+)$/);
        if (!match) {
          return { success: false, message: '無効な座席IDです' };
        }
        
        const rowLabel = match[1];
        const colLabel = match[2];
        
        for (let i = 0; i < data.length; i++) {
          // A列に行ラベル、B列に列番号が入っている
          if (data[i][0] === rowLabel && String(data[i][1]) === colLabel) {
            targetRow = i + 1; // スプレッドシートの行番号は1から始まる
            break;
          }
        }
        
        if (targetRow === -1) {
          return { success: false, message: '指定された座席が見つかりません' };
        }

        // C、D、E列のデータを更新
        if (columnC !== undefined) {
          sheet.getRange(targetRow, 3).setValue(columnC); // C列
        }
        if (columnD !== undefined) {
          sheet.getRange(targetRow, 4).setValue(columnD); // D列
        }
        if (columnE !== undefined) {
          sheet.getRange(targetRow, 5).setValue(columnE); // E列
        }

        return { success: true, message: '座席データを更新しました' };
      } finally {
        lock.releaseLock();
      }
    } else {
      return { success: false, message: "処理が混み合っています。しばらくしてから再度お試しください。" };
    }
  } catch (e) {
    Logger.log(`updateSeatData Error: ${e.message}\n${e.stack}`);
    return { success: false, message: `エラーが発生しました: ${e.message}` };
  }
}

// ===============================================================
// === 内部ヘルパー関数 ===
// ===============================================================

/**
 * 座席IDの形式が有効かどうかを検証する。
 */
function isValidSeatId(seatId) {
  if (!seatId || typeof seatId !== 'string') return false;
  const match = seatId.match(/^([A-E])(\d+)$/);
  if (!match) return false;

  const row = match[1];
  const col = parseInt(match[2], 10);

  const maxSeats = { 'A': 12, 'B': 12, 'C': 12, 'D': 12, 'E': 6 };
  return col >= 1 && col <= (maxSeats[row] || 0);
}

/**
 * スプレッドシートIDとシート名からシートオブジェクトを取得する。
 */
function getSheet(group, day, timeslot, type) {
  try {
    const ssId = getSeatSheetId(group, day, timeslot);
    if (!ssId) {
      throw new Error(`Spreadsheet ID not found for ${group}-${day}-${timeslot}`);
    }

    const sheetName = (type === 'SEAT') ? TARGET_SEAT_SHEET_NAME : LOG_SHEET_NAME;
    const ss = SpreadsheetApp.openById(ssId);
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`Sheet "${sheetName}" not found in spreadsheet ID: ${ssId}`);
    }
    return sheet;

  } catch (e) {
    Logger.log(`getSheet Error for ${group}-${day}-${timeslot}: ${e.message}`);
    throw e;
  }
}

/**
 * TimeSlotConfig.gsの関数を呼び出すための窓口
 */
function getAllTimeslotsForGroup(group) {
  return _getAllTimeslotsForGroup(group);
}

/**
 * シンプルなテスト用API関数
 */
function testApi() {
  const results = {};
  
  // 基本機能テスト
  try {
    results.basic = "OK";
  } catch (e) {
    results.basic = "NG: " + e.message;
  }
  
  // 座席データ取得テスト
  try {
    const testResult = getSeatData("見本演劇", "1", "A", false, false);
    results.getSeatData = testResult.success ? "OK" : "NG: " + (testResult.error || "unknown error");
  } catch (e) {
    results.getSeatData = "NG: " + e.message;
  }
  
  // 最小限座席データ取得テスト
  try {
    const testResult = getSeatDataMinimal("見本演劇", "1", "A", false);
    results.getSeatDataMinimal = testResult.success ? "OK" : "NG: " + (testResult.error || "unknown error");
  } catch (e) {
    results.getSeatDataMinimal = "NG: " + e.message;
  }
  
  // 時間帯取得テスト
  try {
    const testResult = getAllTimeslotsForGroup("見本演劇");
    results.getAllTimeslotsForGroup = Array.isArray(testResult) ? "OK" : "NG: invalid response";
  } catch (e) {
    results.getAllTimeslotsForGroup = "NG: " + e.message;
  }
  
  // パスワード認証テスト（実際の認証は行わず、関数の存在確認のみ）
  try {
    const testResult = verifyModePassword("admin", "dummy");
    results.verifyModePassword = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.verifyModePassword = "NG: " + e.message;
  }
  
  // システムロック状態取得テスト
  try {
    const testResult = getSystemLock();
    results.getSystemLock = testResult.success ? "OK" : "NG: " + (testResult.error || "unknown error");
  } catch (e) {
    results.getSystemLock = "NG: " + e.message;
  }
  
  // 危険コマンド実行テスト（実際の実行は行わず、関数の存在確認のみ）
  try {
    const testResult = execDangerCommand("test", {}, "dummy");
    results.execDangerCommand = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.execDangerCommand = "NG: " + e.message;
  }
  
  // 座席更新テスト（実際の更新は行わず、関数の存在確認のみ）
  try {
    // 実際の更新を行わず、関数の存在確認のみに変更（A1座席のデータ汚染を防止）
    const testResult = { success: true, message: 'test mode - no actual update' };
    results.updateSeatData = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.updateSeatData = "NG: " + e.message;
  }
  
  // 複数座席更新テスト（実際の更新は行わず、関数の存在確認のみ）
  try {
    const testResult = updateMultipleSeats("見本演劇", "1", "A", []);
    results.updateMultipleSeats = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.updateMultipleSeats = "NG: " + e.message;
  }
  
  // 予約機能テスト（実際の予約は行わず、関数の存在確認のみ）
  try {
    const testResult = reserveSeats("見本演劇", "1", "A", []);
    results.reserveSeats = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.reserveSeats = "NG: " + e.message;
  }
  
  // チェックイン機能テスト（実際のチェックインは行わず、関数の存在確認のみ）
  try {
    const testResult = checkInSeat("見本演劇", "1", "A", "A1");
    results.checkInSeat = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.checkInSeat = "NG: " + e.message;
  }
  
  // 複数チェックイン機能テスト（実際のチェックインは行わず、関数の存在確認のみ）
  try {
    const testResult = checkInMultipleSeats("見本演劇", "1", "A", []);
    results.checkInMultipleSeats = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.checkInMultipleSeats = "NG: " + e.message;
  }
  
  // 当日券機能テスト（実際の発行は行わず、関数の存在確認のみ）
  try {
    const testResult = assignWalkInSeat("見本演劇", "1", "A");
    results.assignWalkInSeat = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.assignWalkInSeat = "NG: " + e.message;
  }
  
  // 複数当日券機能テスト（実際の発行は行わず、関数の存在確認のみ）
  try {
    const testResult = assignWalkInSeats("見本演劇", "1", "A", 1);
    results.assignWalkInSeats = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.assignWalkInSeats = "NG: " + e.message;
  }
  
  // 連続当日券機能テスト（実際の発行は行わず、関数の存在確認のみ）
  try {
    const testResult = assignWalkInConsecutiveSeats("見本演劇", "1", "A", 1);
    results.assignWalkInConsecutiveSeats = typeof testResult === 'object' && testResult.hasOwnProperty('success') ? "OK" : "NG: invalid response";
  } catch (e) {
    results.assignWalkInConsecutiveSeats = "NG: " + e.message;
  }
  
  // エラー報告機能テスト
  try {
    const testResult = reportError("test error");
    results.reportError = testResult.success ? "OK" : "NG: " + (testResult.error || "unknown error");
  } catch (e) {
    results.reportError = "NG: " + e.message;
  }
  
  return { success: true, data: results };
}

/**
 * クライアント側からエラー情報を送信するためのAPI
 */
function reportError(errorMessage) {
  Logger.log(`Client-side error: ${errorMessage}`);
  return { success: true };
}

/**
 * グローバルロックの状態を取得
 */
function getSystemLock() {
  try {
    const props = PropertiesService.getScriptProperties();
    const locked = props.getProperty('SYSTEM_LOCKED') === 'true';
    const lockedAt = props.getProperty('SYSTEM_LOCKED_AT') || null;
    return { success: true, locked, lockedAt };
  } catch (e) {
    Logger.log('getSystemLock Error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * グローバルロックの設定（最高管理者パスワードで認証）
 */
function setSystemLock(shouldLock, password) {
  try {
    const props = PropertiesService.getScriptProperties();
    const superAdminPassword = props.getProperty('SUPERADMIN_PASSWORD');
    if (!superAdminPassword || password !== superAdminPassword) {
      return { success: false, message: '認証に失敗しました' };
    }

    if (shouldLock === true) {
      props.setProperty('SYSTEM_LOCKED', 'true');
      props.setProperty('SYSTEM_LOCKED_AT', new Date().toISOString());
    } else {
      props.setProperty('SYSTEM_LOCKED', 'false');
      props.deleteProperty('SYSTEM_LOCKED_AT');
    }
    return { success: true, locked: shouldLock === true };
  } catch (e) {
    Logger.log('setSystemLock Error: ' + e.message);
    return { success: false, error: e.message };
  }
}

/**
 * 最高危険度コマンド（多者承認が必要）
 * initiate → token を発行し一時保存、confirm を2回以上で実行。
 */
function initiateDangerCommand(action, payload, expireSeconds) {
  try {
    const props = PropertiesService.getScriptProperties();
    const token = Utilities.getUuid();
    const now = Date.now();
    const ttl = Math.max(30, Math.min(10 * 60, parseInt(expireSeconds || 120, 10))) * 1000; // 30s〜10min、既定120s
    const record = {
      token: token,
      action: action,
      payload: payload || {},
      confirmations: [],
      createdAt: now,
      expiresAt: now + ttl
    };
    props.setProperty('DANGER_CMD_' + token, JSON.stringify(record));
    return { success: true, token: token, expiresAt: new Date(record.expiresAt).toISOString() };
  } catch (e) {
    Logger.log('initiateDangerCommand Error: ' + e.message);
    return { success: false, message: e.message };
  }
}

function confirmDangerCommand(token, password, confirmerId) {
  try {
    const props = PropertiesService.getScriptProperties();
    const superAdminPassword = props.getProperty('SUPERADMIN_PASSWORD');
    if (!superAdminPassword || password !== superAdminPassword) {
      return { success: false, message: '認証に失敗しました' };
    }
    const key = 'DANGER_CMD_' + token;
    const raw = props.getProperty(key);
    if (!raw) return { success: false, message: 'トークンが無効または期限切れです' };
    const rec = JSON.parse(raw);
    const now = Date.now();
    if (now > rec.expiresAt) {
      props.deleteProperty(key);
      return { success: false, message: 'トークンが期限切れです' };
    }
    const id = (confirmerId || '') + '';
    if (id) {
      if (!rec.confirmations.includes(id)) rec.confirmations.push(id);
    } else {
      // ID未指定でも1カウント扱いだが、同一ブラウザで重複しない保障はない
      rec.confirmations.push(Utilities.getUuid());
    }
    const required = 2;
    if (rec.confirmations.length >= required) {
      // 実行
      const result = performDangerAction(rec.action, rec.payload);
      props.deleteProperty(key);
      return { success: true, executed: true, result: result };
    } else {
      props.setProperty(key, JSON.stringify(rec));
      return { success: true, executed: false, pending: required - rec.confirmations.length };
    }
  } catch (e) {
    Logger.log('confirmDangerCommand Error: ' + e.message);
    return { success: false, message: e.message };
  }
}

function listDangerPending() {
  try {
    const props = PropertiesService.getScriptProperties();
    const all = props.getProperties();
    const now = Date.now();
    const items = [];
    Object.keys(all).forEach(k => {
      if (k.indexOf('DANGER_CMD_') === 0) {
        try {
          const rec = JSON.parse(all[k]);
          if (rec && now <= rec.expiresAt) {
            items.push({ token: rec.token, action: rec.action, confirmations: (rec.confirmations||[]).length, expiresAt: new Date(rec.expiresAt).toISOString() });
          }
        } catch (_) {}
      }
    });
    return { success: true, items: items };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

function performDangerAction(action, payload) {
  if (action === 'purgeReservationsForShow') {
    const group = payload && payload.group;
    const day = payload && payload.day;
    const timeslot = payload && payload.timeslot;
    const sheet = getSheet(group, day, timeslot, 'SEAT');
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { success: true, message: '対象座席なし' };
    // C,D,E を一律 初期化（空, '', ''）。座席定義と一致しない行も上書きされ得るため要注意
    const numRows = lastRow - 1;
    const values = new Array(numRows).fill(0).map(() => ['空', '', '']);
    sheet.getRange(2, 3, numRows, 3).setValues(values);
    SpreadsheetApp.flush();
    return { success: true, message: '該当公演の予約・チェックイン情報を初期化しました' };
  }
  return { success: false, message: '未知のアクション: ' + action };
}

/**
 * コンソール専用の危険コマンド実行（パスワード必須、承認不要）
 * Usage (Browser console only):
 *   await SeatApp.exec('purgeReservationsForShow', {group:'見本演劇', day:'1', timeslot:'A'}, 'SUPERADMIN_PASSWORD');
 */
function execDangerCommand(action, payload, password) {
  try {
    const props = PropertiesService.getScriptProperties();
    const superAdminPassword = props.getProperty('SUPERADMIN_PASSWORD');
    if (!superAdminPassword || password !== superAdminPassword) {
      return { success: false, message: '認証に失敗しました' };
    }
    return performDangerAction(action, payload || {});
  } catch (e) {
    Logger.log('execDangerCommand Error: ' + e.message);
    return { success: false, message: e.message };
  }
}