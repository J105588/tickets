// performance-monitor.js - パフォーマンス監視ダッシュボード
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoad: 0,
      apiCalls: 0,
      apiResponseTime: [],
      memoryUsage: [],
      renderTime: [],
      userInteractions: 0,
      errors: 0
    };
    
    this.startTime = performance.now();
    this.isVisible = false;
    this.dashboard = null;
    
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    // ページ読み込み時間の測定
    window.addEventListener('load', () => {
      this.metrics.pageLoad = performance.now() - this.startTime;
      this.logMetric('pageLoad', this.metrics.pageLoad);
    });

    // API呼び出しの監視
    this.monitorAPICalls();
    
    // メモリ使用量の監視
    this.monitorMemoryUsage();
    
    // レンダリング時間の監視
    this.monitorRenderTime();
    
    // ユーザーインタラクションの監視
    this.monitorUserInteractions();
    
    // エラーの監視
    this.monitorErrors();
    
    // ダッシュボードの初期化
    this.createDashboard();
  }

  monitorAPICalls() {
    const originalFetch = window.fetch;
    const self = this;
    
    window.fetch = function(...args) {
      const startTime = performance.now();
      self.metrics.apiCalls++;
      
      return originalFetch.apply(this, args).then(response => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        self.metrics.apiResponseTime.push(responseTime);
        self.logMetric('apiResponse', responseTime);
        
        return response;
      }).catch(error => {
        const endTime = performance.now();
        const responseTime = endTime - startTime;
        
        self.metrics.apiResponseTime.push(responseTime);
        self.metrics.errors++;
        self.logMetric('apiError', responseTime);
        
        throw error;
      });
    };
  }

  monitorMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        const usedMB = memory.usedJSHeapSize / 1048576;
        
        this.metrics.memoryUsage.push({
          timestamp: Date.now(),
          used: usedMB,
          total: memory.totalJSHeapSize / 1048576,
          limit: memory.jsHeapSizeLimit / 1048576
        });
        
        // 最新の10件のみ保持
        if (this.metrics.memoryUsage.length > 10) {
          this.metrics.memoryUsage.shift();
        }
      }, 5000);
    }
  }

  monitorRenderTime() {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        if (entry.entryType === 'measure') {
          this.metrics.renderTime.push({
            name: entry.name,
            duration: entry.duration,
            timestamp: Date.now()
          });
        }
      });
    });
    
    observer.observe({ entryTypes: ['measure'] });
  }

  monitorUserInteractions() {
    const events = ['click', 'keydown', 'scroll', 'resize'];
    
    events.forEach(eventType => {
      document.addEventListener(eventType, () => {
        this.metrics.userInteractions++;
        this.logMetric('userInteraction', eventType);
      }, { passive: true });
    });
  }

  monitorErrors() {
    window.addEventListener('error', (event) => {
      this.metrics.errors++;
      this.logMetric('error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      this.metrics.errors++;
      this.logMetric('unhandledRejection', event.reason);
    });
  }

  logMetric(type, value) {
    console.log(`📊 [Performance] ${type}:`, value);
  }

  createDashboard() {
    this.dashboard = document.createElement('div');
    this.dashboard.id = 'performance-dashboard';
    this.dashboard.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 300px;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      display: none;
      max-height: 80vh;
      overflow-y: auto;
    `;
    
    document.body.appendChild(this.dashboard);
    
    // ダッシュボード表示/非表示のキーボードショートカット
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        this.toggleDashboard();
      }
    });
  }

  toggleDashboard() {
    this.isVisible = !this.isVisible;
    this.dashboard.style.display = this.isVisible ? 'block' : 'none';
    
    if (this.isVisible) {
      this.updateDashboard();
    }
  }

  updateDashboard() {
    const avgApiResponseTime = this.metrics.apiResponseTime.length > 0 
      ? this.metrics.apiResponseTime.reduce((a, b) => a + b, 0) / this.metrics.apiResponseTime.length 
      : 0;
    
    const latestMemory = this.metrics.memoryUsage.length > 0 
      ? this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1] 
      : null;
    
    const recentRenderTime = this.metrics.renderTime
      .filter(rt => Date.now() - rt.timestamp < 60000) // 過去1分
      .reduce((a, b) => a + b.duration, 0);
    
    this.dashboard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0; color: #4CAF50;">Performance Monitor</h3>
        <button onclick="window.performanceMonitor.toggleDashboard()" style="background: none; border: none; color: white; cursor: pointer; font-size: 16px;">×</button>
      </div>
      
      <div style="margin-bottom: 10px;">
        <strong>Page Load Time:</strong> ${this.metrics.pageLoad.toFixed(2)}ms
      </div>
      
      <div style="margin-bottom: 10px;">
        <strong>API Calls:</strong> ${this.metrics.apiCalls}
        <br><strong>Avg Response Time:</strong> ${avgApiResponseTime.toFixed(2)}ms
      </div>
      
      ${latestMemory ? `
      <div style="margin-bottom: 10px;">
        <strong>Memory Usage:</strong>
        <br>Used: ${latestMemory.used.toFixed(2)}MB
        <br>Total: ${latestMemory.total.toFixed(2)}MB
        <br>Limit: ${latestMemory.limit.toFixed(2)}MB
      </div>
      ` : ''}
      
      <div style="margin-bottom: 10px;">
        <strong>User Interactions:</strong> ${this.metrics.userInteractions}
      </div>
      
      <div style="margin-bottom: 10px;">
        <strong>Errors:</strong> ${this.metrics.errors}
      </div>
      
      <div style="margin-bottom: 10px;">
        <strong>Recent Render Time:</strong> ${recentRenderTime.toFixed(2)}ms
      </div>
      
      <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #333;">
        <button onclick="window.performanceMonitor.exportMetrics()" style="background: #4CAF50; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Export</button>
        <button onclick="window.performanceMonitor.clearMetrics()" style="background: #f44336; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Clear</button>
      </div>
      
      <div style="margin-top: 10px; font-size: 10px; color: #888;">
        Press Ctrl+Shift+P to toggle
      </div>
    `;
  }

  exportMetrics() {
    const data = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      userAgent: navigator.userAgent,
      url: window.location.href
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearMetrics() {
    this.metrics = {
      pageLoad: 0,
      apiCalls: 0,
      apiResponseTime: [],
      memoryUsage: [],
      renderTime: [],
      userInteractions: 0,
      errors: 0
    };
    
    this.updateDashboard();
  }

  getMetrics() {
    return { ...this.metrics };
  }
}

// グローバルインスタンスを作成
window.performanceMonitor = new PerformanceMonitor();

export default window.performanceMonitor;
