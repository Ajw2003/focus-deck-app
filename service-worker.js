// Retirement worker: installs still point at this URL (the old root-scope worker). Take over,
// drop its caches, unregister, and reload open pages. See docs/4-systems/pwa-shell.md#the-retirement-worker
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // only the old worker's caches: the app's own live under another prefix
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('focus-deck-shell-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: 'window' });
    // reload so each page is fetched from the network, no longer through the old worker
    await Promise.all(windows.map((c) => c.navigate(c.url).catch((e) => console.error('retire: navigate failed', e))));
  })());
});
