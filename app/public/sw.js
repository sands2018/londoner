// Retirement worker for browsers that still have the old cache-first worker.
// No fetch handler: all new requests go to the network. Never delete game saves
// or caches belonging to other projects hosted on this GitHub Pages origin.
self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("londoner-shell-")).map(key => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
