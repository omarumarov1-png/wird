// sw.js — Wird service worker: KILL SWITCH.
//
// Offline support is disabled for now. Every previous version of this
// file cached the app shell cache-first, including full page navigations
// -- which meant a device with the old worker already installed could
// never see ANY new deploy, no matter what index.html said, because the
// old worker served its own stale cached index.html instead of ever
// fetching the new one. Editing index.html alone can't reach those
// devices; only a changed sw.js can, since the browser checks sw.js for
// byte-level changes independently of the page's own JS.
//
// This version does the opposite of caching: on activate, it wipes every
// cache this origin owns, unregisters itself, and forces any open tab to
// reload so it immediately goes back to plain network requests.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clientsList = await self.clients.matchAll({ type: "window" });
    clientsList.forEach((client) => client.navigate(client.url));
  })());
});
