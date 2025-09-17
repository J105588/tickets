import { loadSidebar, toggleSidebar, showModeChangeModal } from './sidebar.js';    
import { DemoMode } from './config.js';

(async () => {
  try {
    if (window.systemLockReady && typeof window.systemLockReady.then === 'function') {
      await window.systemLockReady;
    }
  } catch (_) {}
  // DEMOモードでクエリが無い最初のURLなら demo=1 を付与
  try { DemoMode.ensureDemoParamInLocation(); } catch (_) {}
  loadSidebar();

  // DEMOアクティブ時はindexで毎回通知を表示（セッション抑制を無効化）
  try { if (DemoMode.isActive()) DemoMode.showNotificationIfNeeded(true); } catch (_) {}

  // グローバルスコープに関数を登録
  window.toggleSidebar = toggleSidebar;
  window.showModeChangeModal = showModeChangeModal;
})();
