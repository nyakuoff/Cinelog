/* Cinelog service worker — minimal, dependency-free.
 * - App shell (navigations) is network-first with an offline cache fallback so
 *   updates always propagate when online but the app still opens offline.
 * - Hashed static assets are cache-first (their URL changes on each deploy).
 * - API requests are never intercepted — data/auth always go to the network.
 */
const CACHE = 'cinelog-shell-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone
  if (url.pathname.startsWith('/api/')) return; // never cache API/artwork/auth

  if (request.mode === 'navigate') {
    // SPA shell: try the network, fall back to the cached index on failure.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || caches.match(request))),
    );
    return;
  }

  // Static assets: serve from cache, populate on first fetch.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
