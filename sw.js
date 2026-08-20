// sw.js — Wird service worker.
//
// History: an earlier version cached the app shell CACHE-FIRST, including
// full page navigations. That meant a device that already had the worker
// installed could never see a new deploy no matter what index.html said,
// because the old worker served its own stale cached copy instead of ever
// asking the network — editing index.html alone can't reach those devices,
// only a byte-changed sw.js can (the browser diffs sw.js independently of
// the page's own JS). That bug was bad enough to need a kill-switch
// version of this file that wiped every cache and unregistered itself.
//
// This version fixes the actual root cause instead of just disabling
// caching: the app SHELL (the files below) is NETWORK-FIRST, falling back
// to cache only when the network request genuinely fails. That makes it
// structurally impossible to get trapped behind stale content while
// online — a real network response always wins and gets re-cached. Cache
// is purely a last-resort fallback for genuine offline use, never a
// shortcut taken while a fresh copy is reachable.
//
// Audio and Qur'an-API requests are deliberately NOT touched by this file
// at all. Offline audio has its own IndexedDB-backed storage layer in
// app.js (see wird-offline-v1 / warmAudioCache / cachedBlobFor) driven by
// an explicit, user-controlled Downloads screen — that logic is fragile
// and hard-won (see the comments in app.js around playAudio()), and
// giving the service worker any say over those requests would risk
// silently shadowing it. Keeping this file's job narrow (shell only) is
// deliberate, not an oversight.

const CACHE_VERSION = "20260827"; // keep in lockstep with index.html's ?v= query strings
const CACHE_NAME = `wird-shell-${CACHE_VERSION}`;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./auth.js",
  "./firebase-config.js",
  "./manifest.json",
];

const ICON_FILES = [
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([...SHELL_FILES, ...ICON_FILES]).catch(() => {
        // A single missing/failed asset shouldn't block installation --
        // the fetch handler below re-caches successful responses anyway,
        // so a partial pre-cache just means a slightly colder first
        // offline load, not a broken one.
      })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("wird-shell-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isShellRequest(url) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return (
    SHELL_FILES.some((f) => path.endsWith(f.replace("./", "/"))) ||
    ICON_FILES.some((f) => path.endsWith(f.replace("./", "/"))) ||
    path === "/" || path.endsWith("/index.html")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // Only the app shell + icons are handled here. Everything else (Qur'an
  // API, everyayah.com/qurancdn audio, Firebase/Firestore, Google auth)
  // is left completely alone and goes straight to the network exactly as
  // if this service worker didn't exist.
  if (!isShellRequest(url)) return;

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        throw err;
      }
    })()
  );
});
