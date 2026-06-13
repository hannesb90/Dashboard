const CACHE = 'energy-pwa-v5';

// Only small files block install — large card file is cached lazily
const MUST_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './ha-connection.js',
];
const LAZY_CACHE = [
  './energy-dashboard-card.js.html',
  './icons/icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(MUST_CACHE))
      .then(() => {
        // Cache large files in background — don't block install if they fail
        caches.open(CACHE).then(c =>
          c.addAll(LAZY_CACHE).catch(() => {})
        );
      })
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
  if (new URL(e.request.url).origin !== location.origin) return;
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
