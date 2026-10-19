/* Aethelios Atelier — public content only. Never cache API, workspace, or founder routes. */
const CACHE = "atelier-public-v1";
const PUBLIC = ["/", "/offline", "/services", "/approach", "/about", "/brand/logo.webp", "/brand/icon.webp"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PUBLIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") {
    if (!navigator.onLine) {
      event.respondWith(
        new Response(
          JSON.stringify({
            ok: false,
            delivered: false,
            message: "This device is offline. The request was not delivered."
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      );
    }
    return;
  }
  const privatePath =
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/workspace") ||
    url.pathname.startsWith("/founder") ||
    url.pathname.startsWith("/project") ||
    url.pathname.startsWith("/account");
  if (privatePath) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/offline")))
  );
});
