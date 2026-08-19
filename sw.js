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

// Pide el archivo salteando el cache HTTP del navegador. Sin esto, "network-first"
// es mentira: GitHub Pages manda `Cache-Control: max-age=600`, así que el fetch se
// resolvía desde el cache del navegador y podías ver hasta 10 minutos de atraso.
// Se reconstruye la request desde la URL (y no `new Request(event.request, ...)`)
// porque las de navegación tienen mode "navigate" y no se pueden clonar con init.
function fetchFresh(request) {
  return fetch(
    new Request(request.url, { cache: "reload", credentials: "same-origin" })
  );
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetchFresh(event.request)
      .then((resp) => {
        // Red OK: guardo una copia fresca en cache para el modo offline.
        // Solo las respuestas buenas: si guardo un 404 queda pegado offline.
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      })
      .catch(async () => {
        // Sin red: uso lo cacheado. Para una navegación sin match exacto,
        // caigo al index (si no, la app queda en blanco).
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") {
          const index = await caches.match("./index.html");
          if (index) return index;
        }
        return Response.error();
      })
  );
});
