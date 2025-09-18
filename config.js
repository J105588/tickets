// config.js
// 複数のAPI URL（使用数上限回避のため分散）
const GAS_API_URLS = [
  //jxjin2010@gmail.com
  "https://script.google.com/macros/s/AKfycbxl6GhZXb8TrC4ok_MaS-KB19wXF03VR6b3EDX3MV8HOmFUzEYWpB2N53yoeUyUxsEz/exec",
  //jxjin.ig.school@gmail.com
  "https://script.google.com/macros/s/AKfycbxMxkhZDI9gkXPWsQ9gQigFIhr2M3iiXE1S1K7my5ozqMID_xdVHbJiXjffsMhsLgH1/exec",
  //nzn.engeki5@gmail.com
  "https://script.google.com/macros/s/AKfycbyltPeZae9iD9H61aZxsD6sM5Pce526ZHgi4OPR12BNLm36JrRUQsXDvDgvvCqtnbyR-w/exec",
  //nzn.engeki5.b@gmail.com
  "https://script.google.com/macros/s/AKfycbxt7c9FdbmRqerVhQ0e8raIPUNlX-N0xo3l8-40XgXerDpkdWBJzoePFGcuOZnbQZ62/exec",
  //info.engeki5@gmail.com
  "https://script.google.com/macros/s/AKfycbz98t8trLuHvpQLCGnIKS7aQX5pRHncbZWLa0K4d9REArnWhNHfQRwzhh-6KKnLjZH2Sw/exec"
  //engeki.enjitsu@gmail.com
  //"https://script.google.com/macros/s/AKfycbz0gcsEHWPSsoM_tQaGJCHO6ga9Qzu2by81EYA4QRPww8m4QsrSQZ8dZ3WMZoga_yqx/exec"
];

// ログ記録用スプレッドシートID
const LOG_SPREADSHEET_ID = '1ZGQ5BTNW_pTDuMvbZgla2B_soisdvtCM2UrnVi_L-5c'; // 実際のスプレッドシートIDに置き換えてください

// ログ記録用シート名
const LOG_SHEET_NAME = 'OPERATION_LOGS'; // ログを記録するシート名

// 満席通知用メールアドレス（ハードコーディング）
const FULL_CAPACITY_NOTIFICATION_EMAILS = [
  'jxjin2010@gmail.com',
  'jxjin.ig.school@gmail.com',
  'nzn.engeki5@gmail.com'
];

// 強化監視システム設定
const ENHANCED_MONITORING_CONFIG = {
  defaultCheckInterval: 15000, // 15秒間隔
  defaultWarningThreshold: 5,  // 5席以下で警告
  defaultCriticalThreshold: 2, // 2席以下で緊急
  defaultNotificationCooldown: 300000, // 5分間のクールダウン
  maxConcurrentChecks: 5, // 同時チェック数の上限
  cacheTimeout: 30000, // 30秒間のキャッシュ
  retryAttempts: 3, // リトライ回数
  retryDelay: 1000 // リトライ間隔（ミリ秒）
};

// URL選択とローテーション管理
class APIUrlManager {
  constructor() {
    this.urls = [...GAS_API_URLS];
    this.currentIndex = 0;
    this.lastRotationTime = Date.now();
    this.rotationInterval = 5 * 60 * 1000; // 5分間隔でローテーション
    this.initializeRandomSelection();
  }

  // 初期化時にランダムにURLを選択
  initializeRandomSelection() {
    if (this.urls.length > 1) {
      this.currentIndex = Math.floor(Math.random() * this.urls.length);
      console.log(`[API URL Manager] 初期URL選択: ${this.currentIndex + 1}/${this.urls.length}`, this.urls[this.currentIndex]);
    }
  }

  // 現在のURLを取得
  getCurrentUrl() {
    this.checkAndRotate();
    return this.urls[this.currentIndex];
  }

  // 定期的なローテーションをチェック
  checkAndRotate() {
    const now = Date.now();
    if (now - this.lastRotationTime >= this.rotationInterval && this.urls.length > 1) {
      this.rotateUrl();
    }
  }

  // URLを次のものにローテーション（現在のURLとは異なるものを必ず選択）
  rotateUrl() {
    const oldIndex = this.currentIndex;
    
    // 次のURLを選択（配列の最後の場合は最初に戻る）
    this.currentIndex = (this.currentIndex + 1) % this.urls.length;
    
    // もしURLが1つしかない場合は何もしない
    if (this.urls.length <= 1) {
      return;
    }
    
    this.lastRotationTime = Date.now();
    console.log(`[API URL Manager] URLローテーション: ${oldIndex + 1} → ${this.currentIndex + 1}`, this.urls[this.currentIndex]);
  }

  // 手動でランダムURL選択（現在のURLとは異なるものを必ず選択）
  selectRandomUrl() {
    console.log(`[API URL Manager] selectRandomUrl開始: 現在のインデックス=${this.currentIndex}, URL数=${this.urls.length}`);
    
    if (this.urls.length > 1) {
      const oldIndex = this.currentIndex;
      const oldUrl = this.urls[oldIndex];
      console.log(`[API URL Manager] 現在のURL: ${oldUrl}`);
      
      // 現在のURLとは異なるURLを選択
      let newIndex;
      let attempts = 0;
      do {
        newIndex = Math.floor(Math.random() * this.urls.length);
        attempts++;
        console.log(`[API URL Manager] 選択試行${attempts}: インデックス=${newIndex}, URL=${this.urls[newIndex]}`);
      } while (newIndex === oldIndex && this.urls.length > 1 && attempts < 10);
      
      if (attempts >= 10) {
        console.warn('[API URL Manager] 10回試行しても異なるURLが見つかりません');
        return;
      }
      
      this.currentIndex = newIndex;
      this.lastRotationTime = Date.now();
      console.log(`[API URL Manager] ランダム選択完了: ${oldIndex + 1} → ${this.currentIndex + 1}`, this.urls[this.currentIndex]);
    } else {
      console.log('[API URL Manager] URLが1つしかないため、選択をスキップ');
    }
  }

  // 利用可能なURL一覧を取得
  getAllUrls() {
    return [...this.urls];
  }

  // 現在のURL情報を取得
  getCurrentUrlInfo() {
    return {
      index: this.currentIndex + 1,
      total: this.urls.length,
      url: this.urls[this.currentIndex],
      lastRotation: new Date(this.lastRotationTime).toLocaleString()
    };
  }
}

// グローバルインスタンス
const apiUrlManager = new APIUrlManager();
// バックグラウンド同期用URL（独立GASプロジェクトのURL）
const BACKGROUND_SYNC_URL = "https://script.google.com/macros/s/AKfycbzOVVyo8K5-bCZkzD_N2EXFLC7AHQSgKljJo1UXzVB99vacoOsHDme4NIn_emoes-t3/exec"; // 例: "https://script.google.com/macros/s/OFFLINE_PROJECT_ID/exec"
const DEBUG_MODE = true;
// エラーハンドリング機能フラグ（既存機能に影響しないよう全てデフォルトOFF）
const FEATURE_FLAGS = {
  apiRetryEnabled: false, // API自動リトライ（指数バックオフ）
  swSelfHealDefault: false, // SW自己修復の初期状態（実際のON/OFFはメッセージで切替）
  adminNoticesEnabled: false // 管理者お知らせ機能（GAS未実装のためデフォルト無効）
};

// DEMOモード管理（URLパラメータで有効化、UIでは非表示）
class DemoModeManager {
  constructor() {
    this.storageKey = 'DEMO_MODE_ACTIVE';
    this.geneproStorageKey = 'GENEPRO_MODE_ACTIVE';
    this.demoGroup = '見本演劇';
    this.geneproGroup = '見本演劇';
    this.geneproTimeslot = 'A'; // ゲネプロモードでは常にA時間帯を参照
    this._initFromUrl();
    // コンソール操作用に公開
    try {
      window.DemoMode = {
        disable: () => this.disable(),
        enable: () => this.enable(),
        isActive: () => this.isActive(),
        demoGroup: this.demoGroup,
        logStatus: () => this.logStatus(),
        notify: () => this.showNotificationIfNeeded(true),
        // ゲネプロモード用
        isGeneproActive: () => this.isGeneproActive(),
        enableGenepro: () => this.enableGenepro(),
        disableGenepro: () => this.disableGenepro(),
        getGeneproInfo: () => this.getGeneproInfo()
      };
      debugLog('[DemoMode] console command ready: DemoMode.disable(), DemoMode.enableGenepro()');
    } catch (_) {}

    // 状態をログ出力
    this.logStatus();
  }

  _initFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const demo = params.get('demo');
      if (demo && ['1', 'true', 'on', 'yes'].includes(String(demo).toLowerCase())) {
        localStorage.setItem(this.storageKey, 'true');
        localStorage.removeItem(this.geneproStorageKey); // 通常デモモードを優先
        debugLog('[DemoMode] Activated via URL parameter');
      } else if (demo && ['2'].includes(String(demo))) {
        localStorage.removeItem(this.storageKey);
        localStorage.setItem(this.geneproStorageKey, 'true');
        debugLog('[GeneproMode] Activated via URL parameter demo=2');
      } else if (demo && ['0', 'false', 'off', 'no', 'disable'].includes(String(demo).toLowerCase())) {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.geneproStorageKey);
        debugLog('[DemoMode/GeneproMode] Disabled via URL parameter');
        // DEMO解除時はURLからパラメーターを削除
        this._removeDemoParamFromUrl();
      }
    } catch (_) {}
  }

  // URLからdemoパラメーターを削除
  _removeDemoParamFromUrl() {
    try {
      const { origin, pathname, search, hash } = window.location;
      const params = new URLSearchParams(search);
      params.delete('demo');
      const newSearch = params.toString();
      const newUrl = `${origin}${pathname}${newSearch ? '?' + newSearch : ''}${hash || ''}`;
      window.history.replaceState(null, '', newUrl);
      debugLog('[DemoMode] Removed demo parameter from URL');
    } catch (_) {}
  }

  isActive() {
    try { return localStorage.getItem(this.storageKey) === 'true'; } catch (_) { return false; }
  }

  enable() {
    try { localStorage.setItem(this.storageKey, 'true'); } catch (_) {}
  }

  disable() {
    try { localStorage.removeItem(this.storageKey); debugLog('[DemoMode] Disabled'); } catch (_) {}
  }

  // ゲネプロモード用メソッド
  isGeneproActive() {
    try { return localStorage.getItem(this.geneproStorageKey) === 'true'; } catch (_) { return false; }
  }

  enableGenepro() {
    try { 
      localStorage.setItem(this.geneproStorageKey, 'true');
      localStorage.removeItem(this.storageKey); // 通常デモモードを無効化
      debugLog('[GeneproMode] Enabled');
    } catch (_) {}
  }

  disableGenepro() {
    try { 
      localStorage.removeItem(this.geneproStorageKey); 
      debugLog('[GeneproMode] Disabled'); 
    } catch (_) {}
  }

  getGeneproInfo() {
    return {
      isActive: this.isGeneproActive(),
      group: this.geneproGroup,
      referenceTimeslot: this.geneproTimeslot
    };
  }

  // DEMOモード時は強制的に見本演劇にする（ゲネプロは制限しない）
  enforceGroup(group) {
    if (this.isActive()) return this.demoGroup;
    return group;
  }

  // ゲネプロモード時の時間帯強制（常にA時間帯を参照）
  enforceGeneproTimeslot(timeslot) {
    if (this.isGeneproActive()) return this.geneproTimeslot;
    return timeslot;
  }

  // ゲネプロモード時のグループ強制（API参照元は常に見本演劇）
  enforceGeneproGroupForAPI(group) {
    if (this.isGeneproActive()) return this.geneproGroup;
    return group;
  }

  // DEMOモード時に許可外のグループアクセスをブロック（ゲネプロは制限なし）
  guardGroupAccessOrRedirect(currentGroup, redirectTo = null) {
    if (!this.isActive()) return true;
    if (currentGroup === this.demoGroup) return true;

    const modeName = 'DEMOモード';
    alert(`権限がありません：${modeName}では「見本演劇」のみアクセス可能です`);
    if (redirectTo) {
      window.location.href = redirectTo;
    }
    return false;
  }

  // DEMOモードが有効で、かつURLにクエリが無い場合は demo=1 を付与
  ensureDemoParamInLocation() {
    try {
      if (!this.isActive() && !this.isGeneproActive()) return;
      const { href, origin, pathname, search, hash } = window.location;
      if (search && /(?:^|[?&])demo=/.test(search)) return; // 既にある
      if (!search || search === '') {
        const demoParam = this.isGeneproActive() ? 'demo=2' : 'demo=1';
        const next = `${origin}${pathname}?${demoParam}${hash || ''}`;
        const modeName = this.isGeneproActive() ? 'GeneproMode' : 'DemoMode';
        debugLog(`[${modeName}] Append ${demoParam} to URL`, { from: href, to: next });
        window.history.replaceState(null, '', next);
      }
    } catch (_) {}
  }

  // 状態ログを出力
  logStatus() {
    try {
      if (this.isGeneproActive()) {
        console.log('[GeneproMode] Active - group limited to', this.geneproGroup, ', reference timeslot:', this.geneproTimeslot);
      } else if (this.isActive()) {
        console.log('[DemoMode] Active - group limited to', this.demoGroup);
      } else {
        console.log('[DemoMode] Inactive');
      }
    } catch (_) {}
  }

  // DEMOモード通知モジュール（オーバーレイ＋モーダル）。外側タップで閉じる。
  showNotificationIfNeeded(force = false) {
    try {
      if (!this.isActive() && !this.isGeneproActive() && !force) return;
      const notifiedKey = this.isGeneproActive() ? 'GENEPRO_MODE_NOTIFIED' : 'DEMO_MODE_NOTIFIED';
      if (!force && sessionStorage.getItem(notifiedKey) === 'true') return;

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
      const modal = document.createElement('div');
      modal.style.cssText = 'background:#fff;border-radius:12px;max-width:480px;width:100%;box-shadow:0 12px 32px rgba(0,0,0,.25);overflow:hidden;';
      const header = document.createElement('div');
      header.style.cssText = 'background:#6f42c1;color:#fff;padding:14px 16px;font-weight:600;';
      
      const body = document.createElement('div');
      body.style.cssText = 'padding:16px;color:#333;line-height:1.6;';
      
      if (this.isGeneproActive()) {
        header.textContent = 'ゲネプロモード';
        body.innerHTML = `現在「<b>${this.geneproGroup}</b>」のゲネプロモードです。`;
      } else {
        header.textContent = 'DEMOモード';
        body.innerHTML = `現在「<b>${this.demoGroup}</b>」のみ操作可能です。<br>モードや予約、チェックイン、当日券発行の操作は見本データにのみ反映されます。`;
      }
      
      const footer = document.createElement('div');
      footer.style.cssText = 'padding:12px 16px;display:flex;gap:8px;justify-content:flex-end;background:#f8f9fa;';
      const ok = document.createElement('button');
      ok.textContent = 'OK';
      ok.style.cssText = 'background:#6f42c1;color:#fff;border:0;border-radius:8px;padding:8px 14px;cursor:pointer';
      ok.addEventListener('click', () => overlay.remove());
      footer.appendChild(ok);
      modal.appendChild(header);
      modal.appendChild(body);
      modal.appendChild(footer);
      overlay.appendChild(modal);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      sessionStorage.setItem(notifiedKey, 'true');
    } catch (_) {
      // フォールバック
      const modeName = this.isGeneproActive() ? 'ゲネプロモード' : 'DEMOモード';
      const groupName = this.isGeneproActive() ? this.geneproGroup : this.demoGroup;
      try { alert(`${modeName}：現在「${groupName}」のみ操作可能です`); } catch (__) {}
    }
  }
}

const DemoMode = new DemoModeManager();

function debugLog(message, obj = null) {
  if (DEBUG_MODE) {
    console.log(message, obj || '');
  }
}

// 個別にエクスポート
export { GAS_API_URLS, BACKGROUND_SYNC_URL, DEBUG_MODE, debugLog, apiUrlManager, DemoMode };
export { FEATURE_FLAGS, FULL_CAPACITY_NOTIFICATION_EMAILS, ENHANCED_MONITORING_CONFIG };
