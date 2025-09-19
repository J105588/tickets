// enhanced-status-monitor.js - 強化されたステータス監視・満席通知システム

import GasAPI from './api.js';
import apiCache from './api-cache.js';
import { DEBUG_MODE, debugLog, ENHANCED_MONITORING_CONFIG } from './config.js';

class EnhancedStatusMonitor {
  constructor() {
    this.checkInterval = ENHANCED_MONITORING_CONFIG.defaultCheckInterval; // 設定から取得
    this.notificationEmails = []; // 複数アドレス対応
    this.isEnabled = false;
    this.lastCheckedTimeslots = new Map(); // 前回の状態を詳細に記録
    this.checkTimer = null;
    this.isRunning = false;
    
    // 容量閾値設定（設定から取得）
    this.capacityThresholds = {
      warning: ENHANCED_MONITORING_CONFIG.defaultWarningThreshold,
      critical: ENHANCED_MONITORING_CONFIG.defaultCriticalThreshold,
      full: 0
    };
    
    // 通知履歴（重複通知を防ぐ）
    this.notificationHistory = new Map();
    this.notificationCooldown = ENHANCED_MONITORING_CONFIG.defaultNotificationCooldown;
    
    // 統計情報
    this.statistics = {
      totalChecks: 0,
      totalNotifications: 0,
      lastCheckTime: null,
      averageEmptySeats: 0,
      capacityTrends: []
    };
    
    // APIキャッシュの参照
    this.apiCache = apiCache;
    
    // 設定を読み込み
    this.loadSettings();
    
    // グローバル関数として公開
    if (typeof window !== 'undefined') {
      window.EnhancedStatusMonitor = this;
    }
  }

  // 設定を読み込み
  async loadSettings() {
    try {
      const response = await GasAPI.getFullCapacityNotificationSettings();
      if (response && response.success) {
        this.notificationEmails = response.emails || [];
        this.isEnabled = response.enabled;
        debugLog('[EnhancedStatusMonitor] 設定読み込み:', {
          emails: this.notificationEmails,
          enabled: this.isEnabled
        });
      }
    } catch (error) {
      console.error('[EnhancedStatusMonitor] 設定読み込みエラー:', error);
    }
  }

  // 監視開始
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    debugLog('[EnhancedStatusMonitor] 強化監視開始');
    
    // 即座に1回チェック
    this.checkAllStatuses();
    
    // 定期チェックを開始
    this.checkTimer = setInterval(() => {
      this.checkAllStatuses();
    }, this.checkInterval);
  }

  // 監視停止
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    debugLog('[EnhancedStatusMonitor] 強化監視停止');
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  // 全公演のステータスを詳細チェック（最適化版）
  async checkAllStatuses() {
    try {
      debugLog('[EnhancedStatusMonitor] 全公演ステータス詳細チェック開始');
      
      // APIキャッシュを使用してデータを取得
      const response = await this.apiCache.callAPI('getFullCapacityTimeslots', [], true);
      if (!response || !response.success) {
        console.warn('[EnhancedStatusMonitor] ステータス取得API失敗:', response?.message);
        return;
      }

      const allTimeslots = response.allTimeslots || [];
      const summary = response.summary || {};
      
      // 統計情報を更新
      this.statistics.totalChecks++;
      this.statistics.lastCheckTime = new Date();
      this.statistics.averageEmptySeats = summary.totalEmpty / summary.totalChecked || 0;
      
      // 容量トレンドを記録（直近10回分）
      this.statistics.capacityTrends.push({
        timestamp: new Date(),
        totalEmpty: summary.totalEmpty,
        totalOccupied: summary.totalOccupied,
        totalSeats: summary.totalSeats
      });
      
      if (this.statistics.capacityTrends.length > 10) {
        this.statistics.capacityTrends.shift();
      }
      
      debugLog('[EnhancedStatusMonitor] チェック結果:', {
        totalChecked: summary.totalChecked,
        totalSeats: summary.totalSeats,
        totalOccupied: summary.totalOccupied,
        totalEmpty: summary.totalEmpty,
        averageEmpty: this.statistics.averageEmptySeats,
        cacheStats: this.apiCache.getCacheStats()
      });

      // 各公演の状態変化を分析
      const statusChanges = await this.analyzeStatusChanges(allTimeslots);
      
      // 通知が必要な状態変化を処理
      if (statusChanges.length > 0) {
        await this.handleStatusChanges(statusChanges);
      }

      // 統計情報をコンソールに出力
      if (summary.totalChecked > 0) {
        console.log(`[強化監視] チェック完了: ${summary.totalChecked}公演 (総座席: ${summary.totalSeats}, 空席: ${summary.totalEmpty}, 平均空席: ${this.statistics.averageEmptySeats.toFixed(1)})`);
      }

    } catch (error) {
      console.error('[EnhancedStatusMonitor] ステータスチェックエラー:', error);
    }
  }

  // ステータス変化を分析
  async analyzeStatusChanges(currentTimeslots) {
    const changes = [];
    
    for (const timeslot of currentTimeslots) {
      const key = `${timeslot.group}|${timeslot.day}|${timeslot.timeslot}`;
      const previous = this.lastCheckedTimeslots.get(key);
      
      if (!previous) {
        // 初回チェック
        this.lastCheckedTimeslots.set(key, {
          emptySeats: timeslot.emptySeats,
          occupiedSeats: timeslot.occupiedSeats,
          totalSeats: timeslot.totalSeats,
          isFull: timeslot.isFull,
          lastChecked: new Date()
        });
        continue;
      }
      
      // 変化を検出
      const changes_detected = [];
      
      if (previous.emptySeats !== timeslot.emptySeats) {
        changes_detected.push({
          type: 'empty_seats',
          from: previous.emptySeats,
          to: timeslot.emptySeats,
          change: timeslot.emptySeats - previous.emptySeats
        });
      }
      
      if (previous.isFull !== timeslot.isFull) {
        changes_detected.push({
          type: 'capacity_status',
          from: previous.isFull ? 'full' : 'available',
          to: timeslot.isFull ? 'full' : 'available'
        });
      }
      
      // 容量レベル変化を検出
      const previousLevel = this.getCapacityLevel(previous.emptySeats);
      const currentLevel = this.getCapacityLevel(timeslot.emptySeats);
      
      if (previousLevel !== currentLevel) {
        changes_detected.push({
          type: 'capacity_level',
          from: previousLevel,
          to: currentLevel
        });
      }
      
      if (changes_detected.length > 0) {
        changes.push({
          timeslot: timeslot,
          changes: changes_detected,
          previous: previous
        });
      }
      
      // 状態を更新
      this.lastCheckedTimeslots.set(key, {
        emptySeats: timeslot.emptySeats,
        occupiedSeats: timeslot.occupiedSeats,
        totalSeats: timeslot.totalSeats,
        isFull: timeslot.isFull,
        lastChecked: new Date()
      });
    }
    
    return changes;
  }

  // 容量レベルを取得
  getCapacityLevel(emptySeats) {
    if (emptySeats === 0) return 'full';
    if (emptySeats <= this.capacityThresholds.critical) return 'critical';
    if (emptySeats <= this.capacityThresholds.warning) return 'warning';
    return 'normal';
  }

  // ステータス変化を処理
  async handleStatusChanges(changes) {
    const notifications = [];
    
    for (const change of changes) {
      const { timeslot, changes: changeDetails } = change;
      
      // 通知が必要な変化を特定
      for (const detail of changeDetails) {
        if (this.shouldNotify(detail, timeslot)) {
          notifications.push({
            timeslot: timeslot,
            change: detail,
            priority: this.getNotificationPriority(detail, timeslot)
          });
        }
      }
    }
    
    // 通知を送信
    if (notifications.length > 0) {
      await this.sendStatusNotifications(notifications);
    }
  }

  // 通知が必要かどうかを判定
  shouldNotify(change, timeslot) {
    const key = `${timeslot.group}|${timeslot.day}|${timeslot.timeslot}`;
    const now = Date.now();
    
    // 見本演劇はメール送信対象外
    if (timeslot.group === '見本演劇') {
      return false;
    }
    
    // クールダウンチェック
    const lastNotification = this.notificationHistory.get(key);
    if (lastNotification && (now - lastNotification) < this.notificationCooldown) {
      return false;
    }
    
    // 通知条件チェック
    switch (change.type) {
      case 'capacity_status':
        return change.to === 'full'; // 満席になった時のみ通知
      
      case 'capacity_level':
        return ['critical', 'full'].includes(change.to); // 緊急または満席レベル
      
      case 'empty_seats':
        return change.to <= this.capacityThresholds.warning; // 警告レベル以下
      
      default:
        return false;
    }
  }

  // 通知優先度を取得
  getNotificationPriority(change, timeslot) {
    switch (change.type) {
      case 'capacity_status':
        return change.to === 'full' ? 'high' : 'medium';
      
      case 'capacity_level':
        return change.to === 'full' ? 'high' : 
               change.to === 'critical' ? 'medium' : 'low';
      
      case 'empty_seats':
        return change.to === 0 ? 'high' :
               change.to <= this.capacityThresholds.critical ? 'medium' : 'low';
      
      default:
        return 'low';
    }
  }

  // ステータス通知を送信（最適化版）
  async sendStatusNotifications(notifications) {
    try {
      debugLog('[EnhancedStatusMonitor] ステータス通知送信開始');
      
      // 優先度順にソート
      notifications.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
      
      const emailData = {
        emails: this.notificationEmails,
        notifications: notifications,
        statistics: this.statistics,
        timestamp: new Date().toISOString()
      };

      // APIキャッシュを使用してメール送信（キャッシュは使用しない）
      const response = await this.apiCache.callAPI('sendStatusNotificationEmail', [emailData], false);
      
      if (response && response.success) {
        debugLog('[EnhancedStatusMonitor] ステータス通知送信成功:', {
          sentTo: response.sentTo,
          successCount: response.successCount,
          failureCount: response.failureCount,
          notificationCount: notifications.length
        });
        
        // 通知履歴を更新
        notifications.forEach(notification => {
          const key = `${notification.timeslot.group}|${notification.timeslot.day}|${notification.timeslot.timeslot}`;
          this.notificationHistory.set(key, Date.now());
        });
        
        this.statistics.totalNotifications += notifications.length;
      } else {
        console.error('[EnhancedStatusMonitor] ステータス通知送信失敗:', response?.message);
      }
    } catch (error) {
      console.error('[EnhancedStatusMonitor] ステータス通知送信エラー:', error);
    }
  }

  // Service Worker通知
  notifyServiceWorker(notifications) {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        notifications.forEach(notification => {
          navigator.serviceWorker.controller.postMessage({
            type: 'STATUS_CHANGE_ALERT',
            timeslot: notification.timeslot,
            change: notification.change,
            priority: notification.priority,
            timestamp: Date.now()
          });
        });
      }
    } catch (error) {
      console.error('[EnhancedStatusMonitor] Service Worker通知エラー:', error);
    }
  }

  // 容量閾値を更新
  updateCapacityThresholds(thresholds) {
    this.capacityThresholds = { ...this.capacityThresholds, ...thresholds };
    debugLog('[EnhancedStatusMonitor] 容量閾値更新:', this.capacityThresholds);
  }

  // 監視間隔を変更
  setCheckInterval(intervalMs) {
    this.checkInterval = intervalMs;
    
    if (this.isRunning) {
      this.stop();
      this.start();
    }
    
    debugLog('[EnhancedStatusMonitor] 監視間隔変更:', intervalMs + 'ms');
  }

  // 通知クールダウンを設定
  setNotificationCooldown(cooldownMs) {
    this.notificationCooldown = cooldownMs;
    debugLog('[EnhancedStatusMonitor] 通知クールダウン設定:', cooldownMs + 'ms');
  }

  // 現在の設定を取得
  getSettings() {
    return {
      emails: this.notificationEmails,
      enabled: this.isEnabled,
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      capacityThresholds: this.capacityThresholds,
      notificationCooldown: this.notificationCooldown,
      statistics: this.statistics
    };
  }

  // 手動でステータスチェック
  async manualCheck() {
    debugLog('[EnhancedStatusMonitor] 手動ステータスチェック');
    await this.checkAllStatuses();
  }

  // 統計情報を取得
  getStatistics() {
    return {
      ...this.statistics,
      activeTimeslots: this.lastCheckedTimeslots.size,
      notificationHistory: Array.from(this.notificationHistory.entries()).map(([key, timestamp]) => ({
        timeslot: key,
        lastNotification: new Date(timestamp)
      })),
      performanceStats: this.apiCache.getPerformanceStats()
    };
  }

  // 通知履歴をクリア
  clearNotificationHistory() {
    this.notificationHistory.clear();
    debugLog('[EnhancedStatusMonitor] 通知履歴をクリア');
  }
}

// グローバルインスタンス
const enhancedStatusMonitor = new EnhancedStatusMonitor();

// 自動開始（ログページでのみ）
if (typeof window !== 'undefined' && window.location.pathname.includes('logs.html')) {
  // ページ読み込み完了後に開始
  window.addEventListener('load', () => {
    setTimeout(() => {
      enhancedStatusMonitor.start();
    }, 2000); // 2秒後に開始
  });
}

export default enhancedStatusMonitor;
