// sw.js - 静的資産キャッシュとオフライン表示の強化版（PWA更新通知対応、iOS Push対応）
const CACHE_NAME = 'tickets-optimized-v5';
// 自己修復（self-heal）機能のフラグ（デフォルトOFF。クライアントからメッセージでONにできる）
let SELF_HEAL_ENABLED = false;
// 最高管理者モードのクライアント（window client id の集合）
const SUPERADMIN_CLIENT_IDS = new Set();
const CRITICAL_ASSETS = [
	'./',
	'./index.html',
	'./manifest.json',
	'./styles.css',
	'./config.js',
	'./optimized-loader.js'
];

const SECONDARY_ASSETS = [
	'./timeslot.html',
	'./seats.html',
	'./walkin.html',
	'./sidebar.css',
	'./seats.css',
	'./walkin.css',
	'./index-main.js',
	'./timeslot-main.js',
	'./seats-main.js',
	'./walkin-main.js',
	'./sidebar.js',
	'./timeslot-schedules.js',
	'./system-lock.js',
	'./offline-sync-v2.js',
	'./offline-sync-v2.css',
	'./pwa-install.js',
	'./api-cache.js',
	'./optimized-api.js',
	'./ui-optimizer.js',
	'./performance-monitor.js'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME)
			.then(async cache => {
				// クリティカルアセットを優先的にキャッシュ
				try { 
					await cache.addAll(CRITICAL_ASSETS); 
					console.log('Critical assets cached successfully');
				} catch (e) {
					console.warn('Critical cache failed:', e);
				}
				
				// セカンダリアセットはバックグラウンドでキャッシュ
				setTimeout(async () => {
					const batchSize = 3; // iOS対応: バッチサイズをさらに削減
					for (let i = 0; i < SECONDARY_ASSETS.length; i += batchSize) {
						const batch = SECONDARY_ASSETS.slice(i, i + batchSize);
						try { 
							await cache.addAll(batch); 
							console.log(`Secondary batch ${Math.floor(i/batchSize) + 1} cached`);
						} catch (e) {
							console.warn('Secondary cache batch failed:', e);
						}
						// バッチ間で少し待機（メモリ圧迫を防ぐ）
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}, 1000);
			})
			.catch(() => {})
	);
	// 即時有効化
	self.skipWaiting();
});

// プッシュ通知を受信した時の処理
self.addEventListener('push', (event) => {
	try {
		let data = {};
		if (event.data) {
			try {
				data = event.data.json();
			} catch (e) {
				data = { message: event.data.text() };
			}
		}

		// 通知タイプに基づいて処理
		const notificationType = data.type || 'default';
		let title = '新しい通知';
		let options = {
			body: data.message || '新しい情報があります',
			icon: '/icon-192x192.png',
			badge: '/badge-96x96.png',
			vibrate: [100, 50, 100],
			tag: notificationType,
			renotify: true,
			data: data,
			// iOS向けの追加設定
			requireInteraction: false,
			silent: false,
			timestamp: Date.now()
		};

		// 通知タイプに応じた設定
		switch (notificationType) {
			case 'full_alert':
				title = '満席になりました';
				options.body = `${data.group || ''} ${data.day || ''}-${data.timeslot || ''} が満席になりました`;
				options.actions = [
					{ action: 'view', title: '確認する' },
					{ action: 'close', title: '閉じる' }
				];
				// iOS向けの重要度設定
				options.requireInteraction = true;
				break;
			case 'system_update':
				title = 'システム更新';
				options.actions = [
					{ action: 'update', title: '更新する' },
					{ action: 'close', title: '後で' }
				];
				break;
			case 'ios_in_app':
				// iOS向けのアプリ内通知として処理
				title = data.title || '新しい通知';
				options.body = data.body || data.message || '';
				options.actions = data.actions || [];
				// iOS向けの特別な処理
				options.requireInteraction = false;
				break;
		}

		// iOS向けの通知表示最適化
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
		if (isIOS) {
			// iOS向けの通知設定を調整
			options.vibrate = undefined; // iOSではvibrateは無効
			options.badge = undefined; // iOSではbadgeは制限される場合がある
		}

		// 通知を表示
		event.waitUntil(
			self.registration.showNotification(title, options)
		);
	} catch (error) {
		console.error('Push notification error:', error);
	}
});

// 通知がクリックされた時の処理
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	const data = event.notification.data || {};
	const action = event.action;
	const notificationType = event.notification.tag;

	// アクションに応じた処理
	switch (action) {
		case 'view':
			// 満席情報を表示するページへ移動
			event.waitUntil(
				self.clients.matchAll({ type: 'window' }).then((clientList) => {
					// 既存のウィンドウがあれば、そこに移動
					for (const client of clientList) {
						if (client.url.includes('/seats.html') && 'focus' in client) {
							return client.focus();
						}
					}
					// なければ新しいウィンドウを開く
					return self.clients.openWindow('/seats.html');
				})
			);
			break;
		case 'update':
			// 更新処理
			self.skipWaiting();
			break;
		case 'close':
			// 何もしない（通知は既に閉じられている）
			break;
		default:
			// デフォルトの動作（通知タイプに応じて処理）
			switch (notificationType) {
				case 'full_alert':
					event.waitUntil(
						self.clients.matchAll({ type: 'window' }).then((clientList) => {
							for (const client of clientList) {
								if (client.url.includes('/seats.html') && 'focus' in client) {
									return client.focus();
								}
							}
							return self.clients.openWindow('/seats.html');
						})
					);
					break;
				case 'system_update':
					self.skipWaiting();
					break;
				default:
					// デフォルトはホームページを開く
					event.waitUntil(
						self.clients.matchAll({ type: 'window' }).then((clientList) => {
							for (const client of clientList) {
								if ('focus' in client) return client.focus();
							}
							return self.clients.openWindow('/');
						})
					);
			}
	}
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		Promise.all([
			caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))),
			// ナビゲーションプリロードを有効化（対応ブラウザのみ）
			(self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve())
		])
	);
	// 既存クライアントへ即適用
	self.clients.claim();
});

// 更新検知とクライアント通知
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
	// ランタイムで自己修復を切り替え
	if (event.data && event.data.type === 'SET_SELF_HEAL') {
		SELF_HEAL_ENABLED = !!event.data.enabled;
		try { console.log('[SW] SELF_HEAL_ENABLED =', SELF_HEAL_ENABLED); } catch(_) {}
	}
	// 最高管理者モード登録/解除
	if (event.data && event.data.type === 'REGISTER_SUPERADMIN') {
		try { const id = (event.source && event.source.id) || (event.clientId) || null; if (id) SUPERADMIN_CLIENT_IDS.add(id); } catch(_) {}
	}
	if (event.data && event.data.type === 'UNREGISTER_SUPERADMIN') {
		try { const id = (event.source && event.source.id) || (event.clientId) || null; if (id) SUPERADMIN_CLIENT_IDS.delete(id); } catch(_) {}
	}
	// FULLアラートを全クライアントへブロードキャスト
	if (event.data && event.data.type === 'FULL_ALERT') {
		const payload = { type: 'FULL_ALERT', group: event.data.group, day: event.data.day, timeslot: event.data.timeslot, ts: Date.now() };
		event.waitUntil((async () => {
			try {
				// 全クライアントに通知
				const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
				clients.forEach(c => { 
					try { 
						c.postMessage(payload); 
					} catch(_) {} 
				});

				// プッシュ通知を送信
				await this.sendFullAlertNotification(payload);
			} catch (error) {
				console.error('FULL_ALERT処理エラー:', error);
			}
		})());
	}

	// 試験配信の処理
	if (event.data && event.data.type === 'TEST_NOTIFICATION') {
		event.waitUntil((async () => {
			try {
				const testData = event.data.notification ? JSON.parse(event.data.notification) : event.data;
				await this.sendTestNotification(testData);
			} catch (error) {
				console.error('TEST_NOTIFICATION処理エラー:', error);
			}
		})());
	}
});

// 満席通知を送信
async function sendFullAlertNotification(payload) {
	try {
		const title = '満席になりました';
		const body = `${payload.group} ${payload.day}-${payload.timeslot} が満席になりました`;
		
		// 通知オプションを設定
		const options = {
			body,
			tag: 'full-alert',
			renotify: true,
			icon: '/icon-192x192.png',
			badge: '/badge-96x96.png',
			vibrate: [100, 50, 100],
			requireInteraction: true,
			silent: false,
			timestamp: Date.now(),
			data: payload,
			actions: [
				{ action: 'view', title: '確認する' },
				{ action: 'close', title: '閉じる' }
			]
		};

		// iOS向けの調整
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
		if (isIOS) {
			options.vibrate = undefined;
			options.badge = undefined;
		}

		// 通知を表示
		if (self.registration.showNotification && Notification && Notification.permission === 'granted') {
			await self.registration.showNotification(title, options);
			console.log('満席通知を送信しました:', payload);
		} else {
			console.warn('通知権限がありません');
		}
	} catch (error) {
		console.error('満席通知の送信に失敗:', error);
	}
}

// 試験配信を送信
async function sendTestNotification(testData) {
	try {
		const title = testData.title || '試験配信';
		const body = testData.body || '満席通知システムのテストです。';
		
		// 通知オプションを設定
		const options = {
			body,
			tag: 'test-notification',
			renotify: false,
			icon: '/icon-192x192.png',
			badge: '/badge-96x96.png',
			vibrate: [100, 50, 100],
			requireInteraction: false,
			silent: false,
			timestamp: Date.now(),
			data: testData,
			actions: [
				{ action: 'close', title: '閉じる' }
			]
		};

		// iOS向けの調整
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
		if (isIOS) {
			options.vibrate = undefined;
			options.badge = undefined;
		}

		// 通知を表示
		if (self.registration.showNotification && Notification && Notification.permission === 'granted') {
			await self.registration.showNotification(title, options);
			console.log('試験配信を送信しました:', testData);
		} else {
			console.warn('通知権限がありません');
		}
	} catch (error) {
		console.error('試験配信の送信に失敗:', error);
	}
}

// 新しいService Workerが利用可能になった時の処理
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'CHECK_UPDATE') {
		// クライアントに更新通知を送信
		self.clients.matchAll().then(clients => {
			clients.forEach(client => {
				client.postMessage({ 
					type: 'UPDATE_AVAILABLE',
					version: CACHE_NAME,
					timestamp: Date.now()
				});
			});
		});
	}
});

// 更新が利用可能になった時の処理
self.addEventListener('controllerchange', () => {
	// クライアントにリロードを指示
	self.clients.matchAll().then(clients => {
		clients.forEach(client => {
			client.postMessage({ type: 'RELOAD' });
		});
	});
});

self.addEventListener('fetch', (event) => {
	const req = event.request;
	const url = new URL(req.url);

	// ナビゲーション(HTML)はキャッシュ優先 + navigation preload 対応
	if (req.mode === 'navigate') {
		event.respondWith((async () => {
			try {
				const cached = await caches.match(req, { ignoreSearch: true });
				if (cached) return cached;

				// navigation preload があれば先に利用
				let response = undefined;
				if (event.preloadResponse) {
					response = await event.preloadResponse;
				}
				if (!response) {
					response = await fetch(req);
				}

				// キャッシュ書き込みは待たずに完了を待機
				event.waitUntil((async () => {
					try {
						const clone = response.clone();
						const cache = await caches.open(CACHE_NAME);
						await cache.put(req, clone);
					} catch (_) {}
				})());

				return response;
			} catch (_) {
				// フォールバック: 既知ページのいずれか
				return (await caches.match('./seats.html')) || (await caches.match('./index.html'));
			}
		})());
		return;
	}

	// 同一オリジンのGETリクエストのみキャッシュ（スクリプト/スタイル/画像等）
	if (req.method !== 'GET' || url.origin !== self.location.origin) {
		return;
	}

	// 静的資産はキャッシュ優先（stale-while-revalidate）
	event.respondWith(
		caches.match(req).then(cached => {
			const fetchPromise = fetch(req)
				.then(res => {
					try { const clone = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, clone)).catch(() => {}); } catch (_) {}
					return res;
				})
				.catch(async (err) => {
					// ネットワーク失敗時の自己修復ロジック（有効時のみ）
					if (SELF_HEAL_ENABLED && cached) {
						try {
							const cache = await caches.open(CACHE_NAME);
							await cache.delete(req);
							// 削除後に再取得を試行（待たない）
							event.waitUntil(fetch(req).then(r => cache.put(req, r.clone())).catch(() => {}));
						} catch (_) {}
					}
					return cached || new Response('', { status: 504 });
				});
			return cached || fetchPromise;
		})
	);
});


