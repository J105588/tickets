// api-cache.js - API呼び出しの最適化とキャッシュ管理
class APICache {
  constructor() {
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.cacheConfig = {
      seatData: { ttl: 15000, maxSize: 50 }, // 15秒、最大50件（API通信最優先）
      timeslotData: { ttl: 300000, maxSize: 50 }, // 5分、最大50件
      systemLock: { ttl: 5000, maxSize: 10 }, // 5秒、最大10件（API通信最優先）
      default: { ttl: 30000, maxSize: 100 } // 30秒、最大100件（API通信最優先）
    };
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000); // 30秒ごとにクリーンアップ（API通信最優先）
  }

  generateCacheKey(functionName, params = []) {
    return `${functionName}_${JSON.stringify(params)}`;
  }

  getCacheConfig(functionName) {
    const configMap = {
      'getSeatData': this.cacheConfig.seatData,
      'getSeatDataMinimal': this.cacheConfig.seatData,
      'getAllTimeslotsForGroup': this.cacheConfig.timeslotData,
      'getSystemLock': this.cacheConfig.systemLock
    };
    return configMap[functionName] || this.cacheConfig.default;
  }

  get(functionName, params = []) {
    const key = this.generateCacheKey(functionName, params);
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const config = this.getCacheConfig(functionName);
    const now = Date.now();
    
    if (now - cached.timestamp > config.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  set(functionName, params = [], data) {
    const key = this.generateCacheKey(functionName, params);
    const config = this.getCacheConfig(functionName);
    
    // キャッシュサイズ制限
    if (this.cache.size >= config.maxSize) {
      this.evictOldest();
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, value] of this.cache.entries()) {
      const functionName = key.split('_')[0];
      const config = this.getCacheConfig(functionName);
      
      if (now - value.timestamp > config.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 キャッシュクリーンアップ: ${keysToDelete.length}件削除`);
    }
  }

  // 重複リクエストの防止
  async deduplicateRequest(functionName, params, requestFunction) {
    const key = this.generateCacheKey(functionName, params);
    
    // 既に同じリクエストが進行中の場合、そのPromiseを返す
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }
    
    // キャッシュから取得を試行
    const cached = this.get(functionName, params);
    if (cached) {
      return cached;
    }
    
    // 新しいリクエストを開始
    const requestPromise = requestFunction().then(result => {
      this.pendingRequests.delete(key);
      this.set(functionName, params, result);
      return result;
    }).catch(error => {
      this.pendingRequests.delete(key);
      throw error;
    });
    
    this.pendingRequests.set(key, requestPromise);
    return requestPromise;
  }

  // 特定の関数のキャッシュをクリア
  clearFunctionCache(functionName) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(functionName + '_')) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  // 全キャッシュをクリア
  clearAll() {
    this.cache.clear();
    this.pendingRequests.clear();
  }

  // キャッシュ統計を取得
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }
}

// グローバルインスタンス
window.apiCache = new APICache();

export default window.apiCache;
