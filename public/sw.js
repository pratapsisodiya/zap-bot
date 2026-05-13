const CACHE_VERSION = 'v2';
const STATIC_CACHE = `zapbot-static-${CACHE_VERSION}`;
const FONT_CACHE = `zapbot-fonts-${CACHE_VERSION}`;
const IMAGE_CACHE = `zapbot-images-${CACHE_VERSION}`;

const PRECACHE_URLS = [
    '/',
    '/dashboard',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
];

// Never cache these — always go to the network
const NETWORK_ONLY = [
    /^\/api\//,
    /\/_next\/webpack-hmr/,
    /clerk/,
    /sign-in/,
    /sign-up/,
];

function isNetworkOnly(url) {
    return NETWORK_ONLY.some(pattern => pattern.test(url));
}

// ── Install: precache shell ────────────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// ── Activate: delete old caches ───────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => ![STATIC_CACHE, FONT_CACHE, IMAGE_CACHE].includes(key))
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: strategy per resource type ─────────────────────────
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin + Google Fonts
    if (url.origin !== self.location.origin && !url.hostname.includes('fonts.g')) return;

    // API / auth — always network
    if (isNetworkOnly(url.pathname)) {
        event.respondWith(fetch(request));
        return;
    }

    // Fonts — CacheFirst (long-lived)
    if (url.hostname.includes('fonts.g') || url.pathname.includes('/fonts/')) {
        event.respondWith(
            caches.open(FONT_CACHE).then(cache =>
                cache.match(request).then(cached =>
                    cached || fetch(request).then(res => {
                        cache.put(request, res.clone());
                        return res;
                    })
                )
            )
        );
        return;
    }

    // Images — CacheFirst
    if (/\.(png|jpg|jpeg|svg|ico|webp)$/i.test(url.pathname)) {
        event.respondWith(
            caches.open(IMAGE_CACHE).then(cache =>
                cache.match(request).then(cached =>
                    cached || fetch(request).then(res => {
                        if (res.ok) cache.put(request, res.clone());
                        return res;
                    })
                )
            )
        );
        return;
    }

    // JS/CSS _next assets — StaleWhileRevalidate
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(cache =>
                cache.match(request).then(cached => {
                    const fetchPromise = fetch(request).then(res => {
                        if (res.ok) cache.put(request, res.clone());
                        return res;
                    });
                    return cached || fetchPromise;
                })
            )
        );
        return;
    }

    // HTML navigation — NetworkFirst with offline fallback
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() =>
                caches.match(request).then(cached => cached || caches.match('/'))
            )
        );
        return;
    }
});
