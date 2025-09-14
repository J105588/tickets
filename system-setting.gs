/**
 * スクリプトプロパティにパスワードを設定する関数
 * 一度実行すれば設定完了
 * 
 * 使用方法:
 * 1. setupPasswords() - 全てのパスワードを設定
 * 2. setupSuperAdminPassword() - 最高管理者パスワードのみ設定
 * 3. changeSuperAdminPassword('新しいパスワード') - 最高管理者パスワードを変更
 * 4. checkPasswords() - 設定されているパスワードを確認
 */
function setupPasswords() {
  const properties = PropertiesService.getScriptProperties();
  
  // 管理者パスワード（既存のものがあれば維持、なければ設定）
  if (!properties.getProperty('ADMIN_PASSWORD')) {
    properties.setProperty('ADMIN_PASSWORD', 'admin');
    console.log('管理者パスワードを設定しました: admin');
  } else {
    console.log('管理者パスワードは既に設定済みです');
  }
  
  // 当日券モードパスワード
  properties.setProperty('WALKIN_PASSWORD', 'walkin');
  console.log('当日券モードパスワードを設定しました: walkin');
  
  // 最高管理者モードパスワード（既存のものがあれば維持、なければ設定）
  if (!properties.getProperty('SUPERADMIN_PASSWORD')) {
    properties.setProperty('SUPERADMIN_PASSWORD', 'superadmin');
    console.log('最高管理者パスワードを設定しました: superadmin');
  } else {
    console.log('最高管理者パスワードは既に設定済みです');
  }
}

/**
 * 設定されているパスワードを確認する関数（デバッグ用）
 */
function checkPasswords() {
  const properties = PropertiesService.getScriptProperties();
  console.log('管理者パスワード:', properties.getProperty('ADMIN_PASSWORD'));
  console.log('当日券パスワード:', properties.getProperty('WALKIN_PASSWORD'));
  console.log('最高管理者パスワード:', properties.getProperty('SUPERADMIN_PASSWORD'));
}

/**
 * 最高管理者パスワードのみを設定する関数
 */
function setupSuperAdminPassword() {
  const properties = PropertiesService.getScriptProperties();
  
  // 最高管理者パスワードを設定
  properties.setProperty('SUPERADMIN_PASSWORD', 'superadmin');
  console.log('最高管理者パスワードを設定しました: superadmin');
  
  // 設定確認
  const password = properties.getProperty('SUPERADMIN_PASSWORD');
  console.log('設定された最高管理者パスワード:', password);
}

/**
 * 最高管理者パスワードを変更する関数
 */
function changeSuperAdminPassword(newPassword) {
  if (!newPassword || typeof newPassword !== 'string') {
    console.error('新しいパスワードを指定してください');
    return;
  }
  
  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('SUPERADMIN_PASSWORD', newPassword);
  console.log('最高管理者パスワードを変更しました:', newPassword);
}