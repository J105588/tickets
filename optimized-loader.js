// optimized-loader.js - 最適化されたスクリプトローダー
class OptimizedLoader {
  constructor() {
    this.loadedModules = new Set();
    this.loadingPromises = new Map();
    this.dependencies = new Map();
    this.performanceMetrics = {
      loadStart: performance.now(),
      moduleLoadTimes: new Map(),
      totalLoadTime: 0
    };
    
    this.setupDependencies();
    this.initializeCriticalModules();
  }

  setupDependencies() {
    // 依存関係の定義（最適化された順序）
    this.dependencies.set('config', []);
    this.dependencies.set('api-cache', []);
    this.dependencies.set('optimized-api', ['config', 'api-cache']);
    this.dependencies.set('error-handler', []);
    this.dependencies.set('system-lock', ['error-handler', 'optimized-api']);
    this.dependencies.set('sidebar', ['optimized-api']);
    this.dependencies.set('offline-sync-v2', ['config', 'optimized-api']);
    this.dependencies.set('ui-optimizer', []);
    this.dependencies.set('performance-monitor', []);
    this.dependencies.set('pwa-install', []);
    this.dependencies.set('pwa-update', []);
    this.dependencies.set('audit-logger', ['optimized-api']);
  }

  async initializeCriticalModules() {
    // API通信関係を最優先で読み込み
    const apiCriticalModules = ['config', 'api-cache', 'optimized-api'];
    await Promise.all(apiCriticalModules.map(module => this.loadModule(module)));
    
    // エラーハンドリングを次に読み込み
    const errorHandlingModules = ['error-handler'];
    await Promise.all(errorHandlingModules.map(module => this.loadModule(module)));
    
    // セカンダリモジュールを並列読み込み
    const secondaryModules = ['audit-logger', 'ui-optimizer', 'performance-monitor'];
    await Promise.all(secondaryModules.map(module => this.loadModule(module)));
    
    // その他のモジュールを並列読み込み
    const otherModules = ['system-lock', 'sidebar', 'offline-sync-v2', 'pwa-install', 'pwa-update'];
    await Promise.all(otherModules.map(module => this.loadModule(module)));
    
    this.performanceMetrics.totalLoadTime = performance.now() - this.performanceMetrics.loadStart;
    console.log('🚀 モジュール読み込み完了（API通信最優先）:', {
      totalTime: `${this.performanceMetrics.totalLoadTime.toFixed(2)}ms`,
      loadedModules: Array.from(this.loadedModules)
    });
  }

  async loadModule(moduleName) {
    if (this.loadedModules.has(moduleName)) {
      return Promise.resolve();
    }

    if (this.loadingPromises.has(moduleName)) {
      return this.loadingPromises.get(moduleName);
    }

    const loadPromise = this._loadModuleInternal(moduleName);
    this.loadingPromises.set(moduleName, loadPromise);
    
    try {
      await loadPromise;
      this.loadedModules.add(moduleName);
      this.performanceMetrics.moduleLoadTimes.set(moduleName, performance.now() - this.performanceMetrics.loadStart);
    } catch (error) {
      console.error(`❌ モジュール読み込み失敗: ${moduleName}`, error);
      throw error;
    }

    return loadPromise;
  }

  async _loadModuleInternal(moduleName) {
    const dependencies = this.dependencies.get(moduleName) || [];
    
    // 依存関係を並列で読み込み
    await Promise.all(dependencies.map(dep => this.loadModule(dep)));

    const moduleMap = {
      'config': () => import('./config.js'),
      'api-cache': () => import('./api-cache.js'),
      'optimized-api': () => import('./optimized-api.js'),
      'error-handler': () => import('./error-handler.js'),
      'system-lock': () => import('./system-lock.js'),
      'sidebar': () => import('./sidebar.js'),
      'offline-sync-v2': () => this._loadOfflineSync(),
      'ui-optimizer': () => import('./ui-optimizer.js'),
      'performance-monitor': () => import('./performance-monitor.js'),
      'audit-logger': () => import('./audit-logger.js'),
      'pwa-install': () => this._loadPWAInstall(),
      'pwa-update': () => import('./pwa-update.js')
    };

    const loader = moduleMap[moduleName];
    if (!loader) {
      throw new Error(`Unknown module: ${moduleName}`);
    }

    const startTime = performance.now();
    await loader();
    const loadTime = performance.now() - startTime;
    
    console.log(`✅ ${moduleName} loaded in ${loadTime.toFixed(2)}ms`);
  }

  async _loadOfflineSync() {
    // オフライン同期は非モジュールスクリプトなので特別処理
    return new Promise((resolve, reject) => {
      if (window.OfflineSyncV2) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = './offline-sync-v2.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load offline-sync-v2.js'));
      document.head.appendChild(script);
    });
  }

  async _loadPWAInstall() {
    // PWAインストールスクリプトも非モジュール
    return new Promise((resolve, reject) => {
      if (window.PWAInstallHandler) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = './pwa-install.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load pwa-install.js'));
      document.head.appendChild(script);
    });
  }

  // パフォーマンスメトリクスを取得
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      moduleLoadTimes: Object.fromEntries(this.performanceMetrics.moduleLoadTimes)
    };
  }

  // 特定のモジュールが読み込まれているかチェック
  isModuleLoaded(moduleName) {
    return this.loadedModules.has(moduleName);
  }
}

// グローバルインスタンスを作成
window.OptimizedLoader = new OptimizedLoader();

export default window.OptimizedLoader;
