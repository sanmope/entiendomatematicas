// Service worker con estrategia "network-first":
// - CON internet: siempre baja la última versión desde la red (y actualiza el cache).
//   => No hace falta subir la versión manualmente; los cambios se reflejan solos.
// - SIN internet: sirve la última versión guardada en cache (uso offline).
const CACHE = "tablas";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./icon.svg",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
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
    fetch(event.request)
      .then((resp) => {
        // Red OK: guardo una copia fresca en cache para el modo offline
        const copy = resp.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return resp;
      })
      .catch(() => caches.match(event.request)) // Sin red: uso lo cacheado
  );
});
