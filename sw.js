// ---------------------------------------------------------------------------
// DevWars: Market & Military - service worker
// Cache-first strategy. Bump CACHE to "devwars-v3" on every new release.
// ---------------------------------------------------------------------------

const CACHE = "devwars-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/main.css",
  "./css/phone.css",
  "./css/tablet.css",
  "./css/desktop.css",
  "./js/config.js",
  "./js/stocks-data.js",
  "./js/units-data.js",
  "./js/items-data.js",
  "./js/util.js",
  "./js/state.js",
  "./js/chart.js",
  "./js/ui.js",
  "./js/router.js",
  "./js/profile.js",
  "./js/market.js",
  "./js/army.js",
  "./js/items.js",
  "./js/admin.js",
  "./js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(event.request)
        .then((res) => {
          // only cache same-origin successful responses
          if (res && res.ok && event.request.url.startsWith(self.location.origin)) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
