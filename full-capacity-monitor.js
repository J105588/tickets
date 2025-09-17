// full-capacity-monitor.js - 満席検知・通知システム

import GasAPI from './api.js';
import { DEBUG_MODE, debugLog } from './config.js';

class FullCapacityMonitor {
  constructor() {
    this.checkInterval = 30000; // 30秒間隔でチェック
    this.notificationEmails = []; // 複数アドレス対応
    this.isEnabled = false;
    this.lastCheckedTimeslots = new Set();
    this.checkTimer = null;
    this.isRunning = false;
    
    // 設定を読み込み
    this.loadSettings();
    
    // グローバル関数として公開
    if (typeof window !== 'undefined') {
      window.FullCapacityMonitor = this;
    }
  }

  // 設定を読み込み
  async loadSettings() {
    try {
      const response = await GasAPI.getFullCapacityNotificationSettings();
      if (response && response.success) {
        this.notificationEmails = response.emails || [];
        this.isEnabled = response.enabled;
        debugLog('[FullCapacityMonitor] 設定読み込み:', {
          emails: this.notificationEmails,
          enabled: this.isEnabled
        });
      }
    } catch (error) {
      console.error('[FullCapacityMonitor] 設定読み込みエラー:', error);
    }
  }

  // 監視開始
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    debugLog('[FullCapacityMonitor] 監視開始');
    
    // 即座に1回チェック
    this.checkFullCapacity();
    
    // 定期チェックを開始
    this.checkTimer = setInterval(() => {
      this.checkFullCapacity();
    }, this.checkInterval);
  }

  // 監視停止
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    debugLog('[FullCapacityMonitor] 監視停止');
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  // 満席検知チェック（全公演対応版）
  async checkFullCapacity() {
    try {
      debugLog('[FullCapacityMonitor] 全公演満席検知チェック開始');
      
      const response = await GasAPI.getFullCapacityTimeslots();
      if (!response || !response.success) {
        console.warn('[FullCapacityMonitor] 満席検知API失敗:', response?.message);
        return;
      }

      const fullTimeslots = response.fullTimeslots || [];
      const allTimeslots = response.allTimeslots || [];
      const summary = response.summary || {};
      
      debugLog('[FullCapacityMonitor] チェック結果:', {
        totalChecked: summary.totalChecked,
        fullCapacity: summary.fullCapacity,
        totalSeats: summary.totalSeats,
        totalOccupied: summary.totalOccupied,
        totalEmpty: summary.totalEmpty
      });

      const currentTimeslots = new Set();
      
      // 現在の満席時間帯をセットに変換
      fullTimeslots.forEach(timeslot => {
        const key = `${timeslot.group}|${timeslot.day}|${timeslot.timeslot}`;
        currentTimeslots.add(key);
      });

      // 新規満席を検知
      const newFullTimeslots = [];
      for (const key of currentTimeslots) {
        if (!this.lastCheckedTimeslots.has(key)) {
          const [group, day, timeslot] = key.split('|');
          const timeslotData = fullTimeslots.find(t => 
            t.group === group && t.day === day && t.timeslot === timeslot
          );
          newFullTimeslots.push({ 
            group, 
            day, 
            timeslot,
            totalSeats: timeslotData?.totalSeats || 0,
            occupiedSeats: timeslotData?.occupiedSeats || 0,
            emptySeats: timeslotData?.emptySeats || 0
          });
        }
      }

      // 新規満席がある場合は通知
      if (newFullTimeslots.length > 0) {
        debugLog('[FullCapacityMonitor] 新規満席検知:', newFullTimeslots);
        await this.handleNewFullCapacity(newFullTimeslots);
      }

      // 前回の状態を更新
      this.lastCheckedTimeslots = currentTimeslots;

      // 統計情報をコンソールに出力
      if (summary.totalChecked > 0) {
        console.log(`[満席監視] チェック完了: ${summary.totalChecked}公演中${summary.fullCapacity}公演が満席 (総座席: ${summary.totalSeats}, 空席: ${summary.totalEmpty})`);
      }

    } catch (error) {
      console.error('[FullCapacityMonitor] 満席検知チェックエラー:', error);
    }
  }

  // 新規満席の処理
  async handleNewFullCapacity(newFullTimeslots) {
    // Service Worker通知
    this.notifyServiceWorker(newFullTimeslots);
    
    // メール通知（設定されている場合）
    if (this.isEnabled && this.notificationEmails.length > 0) {
      await this.sendEmailNotification(newFullTimeslots);
    }
  }


  // Service Worker通知
  notifyServiceWorker(newFullTimeslots) {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        newFullTimeslots.forEach(timeslot => {
          navigator.serviceWorker.controller.postMessage({
            type: 'FULL_CAPACITY_ALERT',
            group: timeslot.group,
            day: timeslot.day,
            timeslot: timeslot.timeslot,
            timestamp: Date.now()
          });
        });
      }
    } catch (error) {
      console.error('[FullCapacityMonitor] Service Worker通知エラー:', error);
    }
  }

  // メール通知（複数アドレス対応版）
  async sendEmailNotification(newFullTimeslots) {
    try {
      debugLog('[FullCapacityMonitor] メール通知送信開始');
      
      const emailData = {
        emails: this.notificationEmails,
        fullTimeslots: newFullTimeslots,
        timestamp: new Date().toISOString()
      };

      const response = await GasAPI._callApi('sendFullCapacityEmail', [emailData]);
      
      if (response && response.success) {
        debugLog('[FullCapacityMonitor] メール通知送信成功:', {
          sentTo: response.sentTo,
          successCount: response.successCount,
          failureCount: response.failureCount
        });
      } else {
        console.error('[FullCapacityMonitor] メール通知送信失敗:', response?.message);
      }
    } catch (error) {
      console.error('[FullCapacityMonitor] メール通知送信エラー:', error);
    }
  }

  // 通知設定を更新（ハードコーディング版）
  async updateNotificationSettings(enabled) {
    try {
      const response = await GasAPI.setFullCapacityNotification(enabled);
      
      if (response && response.success) {
        // ハードコーディングされたメールアドレスを使用
        this.notificationEmails = [
          'admin@example.com',
          'manager@example.com',
          'staff@example.com'
        ];
        this.isEnabled = enabled;
        
        // 設定をローカルストレージに保存
        localStorage.setItem('full_capacity_notification_enabled', enabled.toString());
        
        debugLog('[FullCapacityMonitor] 通知設定更新:', { emails: this.notificationEmails, enabled });
        return true;
      } else {
        console.error('[FullCapacityMonitor] 通知設定更新失敗:', response?.message);
        return false;
      }
    } catch (error) {
      console.error('[FullCapacityMonitor] 通知設定更新エラー:', error);
      return false;
    }
  }

  // 現在の設定を取得
  getSettings() {
    return {
      emails: this.notificationEmails,
      enabled: this.isEnabled,
      isRunning: this.isRunning,
      checkInterval: this.checkInterval
    };
  }

  // 手動で満席チェック
  async manualCheck() {
    debugLog('[FullCapacityMonitor] 手動満席チェック');
    await this.checkFullCapacity();
  }

  // 監視間隔を変更
  setCheckInterval(intervalMs) {
    this.checkInterval = intervalMs;
    
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    
    debugLog('[FullCapacityMonitor] 監視間隔変更:', intervalMs + 'ms');
  }
}

// グローバルインスタンス
const fullCapacityMonitor = new FullCapacityMonitor();

// 自動開始（ログページでのみ）
if (typeof window !== 'undefined' && window.location.pathname.includes('logs.html')) {
  // ページ読み込み完了後に開始
  window.addEventListener('load', () => {
    setTimeout(() => {
      fullCapacityMonitor.start();
    }, 2000); // 2秒後に開始
  });
}

export default fullCapacityMonitor;
