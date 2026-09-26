// Paths below must stay relative — see docs/systems/pwa-shell.md#invariants
const CACHE_NAME = 'focus-deck-shell-v12';
const SHELL_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './settings.html',
  './js/state.js',
  './js/merge.js',
  './js/project-filter.js',
  './js/mutations.js',
  './js/sync.js',
  './js/github.js',
  './js/github-sync.js',
  './js/complexity.js',
  './js/render.js',
  './js/app.js',
];

const CACHE_INFO_MESSAGE = 'INSTALL_PROMPT_READY';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
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

// GitHub Pages serves every file with max-age=600, so a plain fetch() can be answered from the
// browser's HTTP cache with a file up to 10 minutes stale, and a mix of old and new modules. 'no-cache'
// makes each load check with the server first (a cheap 304 when nothing changed).
// See docs/systems/pwa-shell.md#how-it-works
function fetchFresh(req) {
  if (req.mode === 'navigate') {
    // a navigate-mode Request can't be copied with new options, so fetch its URL instead
    return fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((resp) => (resp.redirected ? Response.redirect(resp.url) : resp));
  }
  return fetch(new Request(req, { cache: 'no-cache' }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first: a code fix must reach an installed app on its next load. Cache-first kept
  // serving an old js/mutations.js that wrote "undefined" over the saved data, long after the fix
  // shipped. The cache is only the offline fallback. See docs/systems/pwa-shell.md.
  event.respondWith(
    fetchFresh(req).then((resp) => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      return resp;
    }).catch(() => caches.match(req).then((cached) => cached || Response.error()))
  );
});
