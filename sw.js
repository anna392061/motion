
const CACHE = 'motion-shell-v1-4-3-fix1';

const FILES = [
  './',
  './index.html',
  './styles.css',
  './theme.css',
  './v14.css',
  './v14.js',
  './v141.css',
  './v141.js',
  './v142-atlas.css',
  './v142-atlas.js',
  './v142-3d.js',
  './runtime.js',
  './app.js',
  './icon.svg',
  './apple-touch-icon.png',
  './manifest.webmanifest'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key =>
            key.startsWith('motion-shell-') &&
            key !== CACHE
          )
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (
    event.request.method !== 'GET' ||
    new URL(event.request.url).origin !== self.location.origin
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && FILES.some(
          file =>
            new URL(file, self.registration.scope).href ===
            event.request.url
        )) {
          const copy = response.clone();
          caches.open(CACHE).then(cache =>
            cache.put(event.request, copy)
          );
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
