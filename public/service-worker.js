self.addEventListener("install", (event) => {
  console.log("[SW] Service Worker instalado");
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
