/* Cinelog service worker — minimal, dependency-free.
 * - Navigations: network-first, offline fallback to the cached shell ('/').
 * - /assets/* (content-hashed): cache-first, precached on install from the shell HTML.
 * - Other same-origin static files (manifest, icons, splash): stale-while-revalidate.
 * - API requests are never intercepted.
 * __BUILD_ID__ is replaced at build time (vite.config.ts), so every deploy gets a new cache.
 */
const CACHE = 'cinelog-__BUILD_ID__';

// Only cache real files: ok and not the SPA fallback HTML.
const cacheable = (res) => res.ok && !(res.headers.get('content-type') || '').includes('text/html');

self.addEventListener('install', (event) => {
  // No skipWaiting here: the page asks for it (SKIP_WAITING message) so a reload is user-approved.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const res = await fetch('/', { cache: 'no-store' });
      if (!res.ok) throw new Error('shell fetch failed');
      await cache.put('/', res.clone());
      const html = await res.text();
      const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(
        urls.map((u) =>
          fetch(u).then((r) => (cacheable(r) ? cache.put(u, r) : undefined)).catch(() => {}),
        ),
      );
      // Fonts are referenced from the CSS, not the HTML: pull url(...) targets too.
      const css = urls.filter((u) => u.endsWith('.css'));
      for (const u of css) {
        const text = await (await cache.match(u))?.text();
        const fonts = [...(text || '').matchAll(/url\((\/assets\/[^)"']+)\)/g)].map((m) => m[1]);
        await Promise.all(
          fonts.map((f) =>
            fetch(f).then((r) => (cacheable(r) ? cache.put(f, r) : undefined)).catch(() => {}),
          ),
        );
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
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
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    );
    return;
  }

  const hashed = url.pathname.startsWith('/assets/');
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached && hashed) return cached;
      const network = fetch(request).then((res) => {
        if (cacheable(res)) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      });
      // Non-hashed: serve stale immediately, refresh in the background.
      if (cached) {
        network.catch(() => {});
        return cached;
      }
      return network;
    }),
  );
});
