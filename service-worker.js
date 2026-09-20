const CACHE_NAME = 'focus-deck-shell-v5';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/css/app.css',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/js/state.js',
  '/js/mutations.js',
  '/js/render.js',
  '/js/app.js',
  '/js/sync.js',
  '/js/github.js',
  '/js/github-sync.js',
  '/js/complexity.js',
  '/js/project-filter.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept GitHub API calls or cross-origin requests (fonts CDN excluded on purpose too —
  // Google Fonts has its own cache headers and we don't want to fight them).
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((resp) => {
        // Cache newly-seen same-origin GETs (covers future asset additions without a SW bump)
        if (event.request.method === 'GET' && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      });
    })
  );
});
