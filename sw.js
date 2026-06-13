const CACHE = 'energy-pwa-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './ha-connection.js',
  './energy-dashboard-card.js.html',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Only handle same-origin requests; cross-origin (HA API, Tibber) pass through untouched
  if (new URL(e.request.url).origin !== location.origin) return;

  // Cache-first with background revalidation
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => null);
      return cached ?? network;
    })
  );
});
