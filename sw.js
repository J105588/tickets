// sw.js - 静的資産キャッシュとオフライン表示の強化版（PWA更新通知対応）
const CACHE_NAME = 'tickets-optimized-v4';
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
});

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
				.catch(() => cached || new Response('', { status: 504 }));
			return cached || fetchPromise;
		})
	);
});


