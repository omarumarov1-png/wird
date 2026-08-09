// sw.js — Wird service worker.
//
// Cache-first for the app shell (so the installed PWA opens with zero
// network), plus opportunistic runtime caching for the Qur'an text/word
// APIs, recitation + vocab audio, and Google Fonts -- so a surah or word
// the user has already studied while online keeps working (text, audio,
// and all) once they're not. Deliberately never touches Firebase's own
// Auth/Firestore traffic -- auth.js already has its own offline handling
// for that, and caching an XHR here could serve stale auth state.
//
// CACHE_VERSION is bumped by hand alongside index.html's own `?v=` asset
// version on every deploy -- that's what forces every open tab to fetch a
// fresh shell and drop the old cache on its next activate, the same
// invalidation switch the rest of the app already uses.
const CACHE_VERSION = "20260809d";
const SHELL_CACHE = `wird-shell-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `wird-runtime-v${CACHE_VERSION}`;

const SHELL_URLS = [
  "./",
  "./index.html",
  `./style.css?v=${CACHE_VERSION}`,
  `./app.js?v=${CACHE_VERSION}`,
  `./firebase-config.js?v=${CACHE_VERSION}`,
  `./auth.js?v=${CACHE_VERSION}`,
  `./manifest.json?v=${CACHE_VERSION}`,
  `./icons/apple-touch-icon-180.png?v=${CACHE_VERSION}`,
  `./icons/favicon-32.png?v=${CACHE_VERSION}`,
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./data/vocab-bank.json",
];

// Recitation + word audio never changes once published -- cache-first,
// no background refresh needed.
const IMMUTABLE_AUDIO_HOSTS = ["everyayah.com", "audio.qurancdn.com"];
// Ayah text/translation/word-by-word data: cache-first for instant offline
// reads, but always kick off a background refetch too in case anything
// upstream ever gets corrected.
const REVALIDATE_HOSTS = ["api.alquran.cloud", "api.quran.com"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

async function shellCacheFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    return cached || Response.error();
  }
}

async function cacheFirstNoRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    // Cross-origin <audio>/font requests often come through as opaque
    // (status 0, ok === false) -- still perfectly cacheable and usable.
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  } catch (e) {
    return Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (cached) return cached; // network promise still runs in the background to refresh the cache
  const res = await network;
  return res || Response.error();
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never intercept writes (Firestore, etc.)
  const url = new URL(req.url);

  // Opening/reloading the app itself: always answer from the precached
  // shell first, so this works with the device genuinely offline.
  if (req.mode === "navigate") {
    event.respondWith(shellCacheFirst(new Request("./index.html")));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(shellCacheFirst(req));
    return;
  }

  // Firebase's own traffic is never intercepted -- auth.js has its own,
  // more careful offline handling for it.
  if (url.hostname.endsWith("firebaseio.com") || url.hostname.endsWith("firestore.googleapis.com")) return;
  if (url.hostname === "www.gstatic.com" && url.pathname.startsWith("/firebasejs/")) return;

  if (IMMUTABLE_AUDIO_HOSTS.includes(url.hostname) || FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirstNoRevalidate(req));
    return;
  }
  if (REVALIDATE_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }
  // Any other third-party origin: pass through untouched.
});
