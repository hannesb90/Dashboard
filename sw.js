const CACHE = 'energy-pwa-v23';

const MUST_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './ha-connection.js',
  './cast-sender.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(MUST_CACHE))
      .then(() => {
        caches.open(CACHE).then(c =>
          c.addAll(['./energy-dashboard-card.js.html', './icons/icon.svg', './receiver.html']).catch(() => {})
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
