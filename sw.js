/* Taipei MRT Stamp Tracker offline app shell */
const CACHE_NAME = "taipei-mrt-shell-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./IMG_3002.jpeg",
  "./IMG_9049.jpeg"
];
const FIREBASE_SCRIPTS = [
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    // Cache Firebase's public CDN scripts too. no-cors allows storing
    // opaque script responses for later offline use.
    for (const url of FIREBASE_SCRIPTS) {
      try {
        const request = new Request(url, {mode:"no-cors"});
        const response = await fetch(request);
        if (response && (response.ok || response.type === "opaque")) {
          await cache.put(request, response);
        }
      } catch (error) {
        console.warn("Could not pre-cache Firebase script:", url, error);
      }
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key.startsWith("taipei-mrt-shell-") && key !== CACHE_NAME)
        .map(key => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const isFirebaseScript = FIREBASE_SCRIPTS.includes(url.href);

  if (url.origin !== self.location.origin && !isFirebaseScript) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // Always check the network first for the app document so layout fixes
    // reach installed devices promptly; use the cached shell only offline.
    if (request.mode === "navigate" || url.pathname.endsWith("/index.html")) {
      try {
        const response = await fetch(request, {cache:"no-store"});
        if (response && response.ok) {
          await cache.put(request, response.clone());
          return response;
        }
      } catch (error) {
        const fallback = await cache.match(request) || await cache.match("./index.html");
        if (fallback) return fallback;
        throw error;
      }
    }

    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && (response.ok || response.type === "opaque")) {
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      if (request.mode === "navigate") {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      throw error;
    }
  })());
});
