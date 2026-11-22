// Минимальный Service Worker для установки витрины TIYIN как приложения (PWA)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Пропускаем запросы напрямую в сеть, чтобы цены и каталог всегда были свежими
});
