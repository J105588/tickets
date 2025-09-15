// ui-optimizer.js - UI応答性の最適化
class UIOptimizer {
  constructor() {
    this.rafId = null;
    this.pendingUpdates = new Map();
    this.batchSize = 10;
    this.isProcessing = false;
    this.performanceObserver = null;
    
    this.initializeOptimizations();
  }

  initializeOptimizations() {
    // リサイズイベントの最適化
    this.optimizeResizeEvents();
    
    // スクロールイベントの最適化
    this.optimizeScrollEvents();
    
    // クリックイベントの最適化
    this.optimizeClickEvents();
    
    // 入力イベントの最適化
    this.optimizeInputEvents();
    
    // パフォーマンス監視
    this.setupPerformanceMonitoring();
    
    // メモリ使用量監視
    this.setupMemoryMonitoring();
  }

  optimizeResizeEvents() {
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.debouncedResize();
      }, 100);
    });
  }

  debouncedResize() {
    // 座席マップの再描画など、リサイズ時の処理を最適化
    const seatMapContainer = document.getElementById('seat-map-container');
    if (seatMapContainer && window.redrawSeatMap) {
      requestAnimationFrame(() => {
        window.redrawSeatMap();
      });
    }
  }

  optimizeScrollEvents() {
    let scrollTimeout;
    window.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        this.debouncedScroll();
      }, 16); // 60fps
    });
  }

  debouncedScroll() {
    // スクロール時の処理を最適化
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // スクロール位置に基づく処理
    this.updateScrollBasedElements(scrollTop);
  }

  updateScrollBasedElements(scrollTop) {
    // 固定ヘッダーの表示/非表示など
    const header = document.querySelector('.page-header');
    if (header) {
      if (scrollTop > 100) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }
  }

  optimizeClickEvents() {
    // クリックイベントのバブリング最適化
    document.addEventListener('click', (event) => {
      this.handleOptimizedClick(event);
    }, { passive: false });
  }

  handleOptimizedClick(event) {
    const target = event.target;
    
    // 座席クリックの最適化
    if (target.classList.contains('seat')) {
      this.handleSeatClick(target, event);
      return;
    }
    
    // ボタンクリックの最適化
    if (target.tagName === 'BUTTON') {
      this.handleButtonClick(target, event);
      return;
    }
  }

  handleSeatClick(seatElement, event) {
    event.preventDefault();
    event.stopPropagation();
    
    // 座席選択の処理を最適化
    if (window.handleSeatSelection) {
      requestAnimationFrame(() => {
        window.handleSeatSelection(seatElement);
      });
    }
  }

  handleButtonClick(buttonElement, event) {
    // ボタンの連続クリック防止
    if (buttonElement.disabled) {
      event.preventDefault();
      return;
    }
    
    // ボタンに一時的な無効化を適用
    this.temporarilyDisableButton(buttonElement, 300);
  }

  temporarilyDisableButton(button, duration) {
    const originalDisabled = button.disabled;
    button.disabled = true;
    
    setTimeout(() => {
      button.disabled = originalDisabled;
    }, duration);
  }

  optimizeInputEvents() {
    // 入力イベントの最適化
    document.addEventListener('input', (event) => {
      this.handleOptimizedInput(event);
    }, { passive: true });
  }

  handleOptimizedInput(event) {
    const target = event.target;
    
    // 検索入力の最適化
    if (target.classList.contains('search-input')) {
      this.debounceSearch(target);
    }
    
    // 数値入力の最適化
    if (target.type === 'number') {
      this.validateNumberInput(target);
    }
  }

  debounceSearch(inputElement) {
    clearTimeout(inputElement.searchTimeout);
    inputElement.searchTimeout = setTimeout(() => {
      this.performSearch(inputElement.value);
    }, 300);
  }

  performSearch(query) {
    // 検索処理を最適化
    if (window.performSeatSearch) {
      requestAnimationFrame(() => {
        window.performSeatSearch(query);
      });
    }
  }

  validateNumberInput(inputElement) {
    const value = parseInt(inputElement.value);
    const min = parseInt(inputElement.min) || 0;
    const max = parseInt(inputElement.max) || 999;
    
    if (value < min) {
      inputElement.value = min;
    } else if (value > max) {
      inputElement.value = max;
    }
  }

  // バッチ更新システム
  scheduleUpdate(key, updateFunction) {
    this.pendingUpdates.set(key, updateFunction);
    
    if (!this.isProcessing) {
      this.processPendingUpdates();
    }
  }

  processPendingUpdates() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    requestAnimationFrame(() => {
      const updates = Array.from(this.pendingUpdates.entries()).slice(0, this.batchSize);
      this.pendingUpdates.clear();
      
      updates.forEach(([key, updateFunction]) => {
        try {
          updateFunction();
        } catch (error) {
          console.error(`Update failed for key ${key}:`, error);
        }
      });
      
      this.isProcessing = false;
      
      // まだ更新が残っている場合は再処理
      if (this.pendingUpdates.size > 0) {
        this.processPendingUpdates();
      }
    });
  }

  // パフォーマンス監視
  setupPerformanceMonitoring() {
    if ('PerformanceObserver' in window) {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            if (entry.entryType === 'measure') {
              this.logPerformanceMetric(entry);
            }
          });
        });
        
        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance monitoring setup failed:', error);
      }
    }
  }

  logPerformanceMetric(entry) {
    if (entry.duration > 100) { // 100ms以上の処理をログ
      console.log(`🐌 Slow operation: ${entry.name} took ${entry.duration.toFixed(2)}ms`);
    }
  }

  // メモリ使用量監視
  setupMemoryMonitoring() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        const usedMB = (memory.usedJSHeapSize / 1048576).toFixed(2);
        const totalMB = (memory.totalJSHeapSize / 1048576).toFixed(2);
        
        if (usedMB > 50) { // 50MB以上の場合に警告
          console.warn(`⚠️ High memory usage: ${usedMB}MB / ${totalMB}MB`);
        }
      }, 30000); // 30秒ごと
    }
  }

  // 画像の遅延読み込み最適化
  optimizeImageLoading() {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      });
      
      images.forEach(img => imageObserver.observe(img));
    } else {
      // フォールバック: 即座に読み込み
      images.forEach(img => {
        img.src = img.dataset.src;
        img.removeAttribute('data-src');
      });
    }
  }

  // 座席マップの描画最適化
  optimizeSeatMapRendering(seatData) {
    const container = document.getElementById('seat-map-container');
    if (!container) return;
    
    // 既存の座席をクリア
    container.innerHTML = '';
    
    // 座席をバッチで作成
    const fragment = document.createDocumentFragment();
    const seatsPerBatch = 50;
    
    for (let i = 0; i < seatData.length; i += seatsPerBatch) {
      const batch = seatData.slice(i, i + seatsPerBatch);
      
      requestAnimationFrame(() => {
        batch.forEach(seat => {
          const seatElement = this.createSeatElement(seat);
          fragment.appendChild(seatElement);
        });
        
        if (i + seatsPerBatch >= seatData.length) {
          container.appendChild(fragment);
        }
      });
    }
  }

  createSeatElement(seat) {
    const seatElement = document.createElement('div');
    seatElement.className = `seat seat-${seat.status}`;
    seatElement.dataset.seatId = seat.id;
    seatElement.textContent = seat.name;
    
    // イベントリスナーを追加
    seatElement.addEventListener('click', (event) => {
      this.handleSeatClick(seatElement, event);
    });
    
    return seatElement;
  }

  // アニメーション最適化
  optimizeAnimations() {
    // CSSアニメーションの最適化
    const style = document.createElement('style');
    style.textContent = `
      .seat {
        will-change: transform, background-color;
        transform: translateZ(0);
      }
      
      .modal {
        will-change: opacity, transform;
      }
      
      .loading {
        will-change: opacity;
      }
    `;
    document.head.appendChild(style);
  }

  // クリーンアップ
  cleanup() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    this.pendingUpdates.clear();
  }
}

// グローバルインスタンスを作成
window.uiOptimizer = new UIOptimizer();

export default window.uiOptimizer;
