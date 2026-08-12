const CACHE = 'sonatory-shell-v31';
const CACHE_PREFIX = 'sonatory-shell-';
const ASSETS = ['/', '/index.html', '/styles.css', '/src/app.js', '/src/core.js', '/src/ecs.js', '/src/ecs-projection.js', '/src/contacts.js', '/src/storage.js', '/src/sync.js', '/src/managed/srd-5.2.1.js', '/src/importers/ddb-parser.js', '/src/importers/ddb-worker.js', '/vendor/pdfjs/pdf.min.mjs', '/vendor/pdfjs/pdf.worker.min.mjs', '/manifest.webmanifest', '/assets/mark.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    try {
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch {
      return await caches.match(event.request) || await caches.match('/index.html') || Response.error();
    }
  })());
});
