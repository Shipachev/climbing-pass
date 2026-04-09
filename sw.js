const CACHE_VERSION = 'climbpass-v18.1';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './sw.js',
];

// INSTALL
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            return cache.addAll(APP_SHELL);
        }),
    );
    // НЕ вызываем skipWaiting() здесь — страница сама скажет когда активироваться
});

// ACTIVATE
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => {
                return Promise.all(
                    keys.map((key) => {
                        if (key !== CACHE_VERSION) {
                            return caches.delete(key);
                        }
                    }),
                );
            })
            .then(() => self.clients.claim()),
    );
});

// FETCH
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Для HTML — стратегия network-first (чтобы подтягивалась новая версия)
    if (event.request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request)),
        );
        return;
    }

    // Для остальных ресурсов — cache-first
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // Параллельно обновляем кеш (stale-while-revalidate)
                fetch(event.request).then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => {
                        cache.put(event.request, clone);
                    });
                });
                return cached;
            }

            return fetch(event.request).then((response) => {
                const clone = response.clone();
                caches.open(CACHE_VERSION).then((cache) => {
                    cache.put(event.request, clone);
                });
                return response;
            });
        }),
    );
});

// FORCE UPDATE FROM PAGE
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
