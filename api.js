/**
 * GAS APIとの通信を行うモジュール (POSTリクエスト対応版)
 * config.jsに定義されたGAS_API_URLとdebugLogを使用します。
 * POSTリクエストを利用してCORSの問題を回避します。
 */

function debugLog(message, data) {
  console.log('[DEBUG]', message, data);
}

class GasAPI {
  static async _callApi(functionName, params = []) {
    debugLog(`API Call (POST): ${functionName}`, params);
    
    if (typeof GAS_API_URL === 'undefined' || !GAS_API_URL) {
      const errorMessage = "GASのAPI URLが定義されていないか、空です。config.jsを確認してください。";
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const postData = { func: functionName, params: params };
    debugLog('Request Body:', postData);
    
    try {
      const response = await fetch(GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(postData),
        redirect: 'follow'
      });
      
      if (!response.ok) {
        throw new Error(`サーバーとの通信に失敗しました (HTTPステータス: ${response.status})`);
      }
      
      const data = await response.json();
      debugLog(`API Response: ${functionName}`, data);

      if (data.success === false) {
        throw new Error(data.error || 'GAS側で処理エラーが発生しました。');
      }
      
      return data;

    } catch (error) {
      const errorMessage = error.message || '不明なエラー';
      console.error(`API Error (${functionName}):`, errorMessage, error);
      throw new Error(`API呼び出しに失敗しました: ${errorMessage}`);
    }
  }

  // 各API関数の呼び出し
  static async getSeatData(group, day, timeslot, isAdmin) {
    return this._callApi('getSeatData', [group, day, timeslot, isAdmin]);
  }
  
  // エクスポートを追加
  static async reserveSeats(group, day, timeslot, selectedSeats) {
    return this._callApi('reserveSeats', [group, day, timeslot, selectedSeats]);
  }

  static async checkInSeat(group, day, timeslot, seatId) {
    return this._callApi('checkInSeat', [group, day, timeslot, seatId]);
  }

  static async assignWalkInSeat(group, day, timeslot) {
    return this._callApi('assignWalkInSeat', [group, day, timeslot]);
  }

  static async verifyAdminPassword(password) {
    return this._callApi('verifyAdminPassword', [password]);
  }

  static async verifyModePassword(mode, password) {
    return this._callApi('verifyModePassword', [mode, password]);
  }

  static async getAllTimeslotsForGroup(group) {
    return this._callApi('getAllTimeslotsForGroup', [group]);
  }
}

// エクスポートを追加する
export default GasAPI;
