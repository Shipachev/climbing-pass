const CACHE_VERSION = 'climbpass-v5';

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
    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            return cache.addAll(APP_SHELL);
        }),
    );
});

// ACTIVATE
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_VERSION) {
                        return caches.delete(key);
                    }
                }),
            );
        }),
    );

    return self.clients.claim();
});

// FETCH
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;

            return fetch(event.request).then((response) => {
                let clone = response.clone();

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
