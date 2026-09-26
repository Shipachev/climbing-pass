const CACHE_VERSION = '24.4';

const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './sw.js',
];

// кешируем только успешные ответы: иначе ошибка сервера станет офлайн-версией
function putInCache(request, response) {
    if (!response.ok) return;
    const clone = response.clone();
    caches.open(CACHE_VERSION).then((cache) => {
        cache.put(request, clone);
    });
}

// INSTALL
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            // cache: 'reload' — мимо HTTP-кеша, чтобы новая версия не взяла старые файлы
            return cache.addAll(
                APP_SHELL.map((url) => new Request(url, { cache: 'reload' })),
            );
        }),
    );
    self.skipWaiting();
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
                    putInCache(event.request, response);
                    return response;
                })
                .catch(() =>
                    caches
                        .match(event.request)
                        .then(
                            (cached) => cached || caches.match('./index.html'),
                        ),
                ),
        );
        return;
    }

    // Для остальных ресурсов — cache-first
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) {
                // Параллельно обновляем кеш (stale-while-revalidate)
                fetch(event.request)
                    .then((response) => putInCache(event.request, response))
                    .catch(() => {});
                return cached;
            }

            return fetch(event.request).then((response) => {
                putInCache(event.request, response);
                return response;
            });
        }),
    );
});
