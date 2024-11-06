// This is the "Offline page" service worker

importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js"
);

const CACHE = "pwabuilder-page";
const offlineFallbackPage = "offline.html";
const PRECACHE_ASSETS = ["/img/", "/css/", "/js/"];

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      cache.addAll(PRECACHE_ASSETS);
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloadResp = await event.preloadResponse;

          if (preloadResp) {
            return preloadResp;
          }

          const networkResp = await fetch(event.request);
          return networkResp;
        } catch (error) {
          const cache = await caches.open(CACHE);
          const cachedResp = await cache.match(offlineFallbackPage);
          return cachedResp;
        }
      })()
    );
  }
});

workbox.precaching.precacheAndRoute([
  { url: offlineFallbackPage, revision: null },
]);
