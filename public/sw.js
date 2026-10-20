/* Aethelios Atelier service worker.
   Keep in sync with src/lib/pwa/cachePolicy.ts.
   Cache only the generic offline shell and public brand assets.
   Never cache personalized HTML, authenticated routes, APIs, or RSC payloads. */
const CACHE = "atelier-static-v6";
const PREFIX = "atelier-";
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/brand/logo.webp",
  "/brand/icon.webp",
  "/brand/install/v6/icon-192.png",
  "/brand/install/v6/icon-512.png",
  "/brand/install/v6/icon-192-maskable.png",
  "/brand/install/v6/icon-512-maskable.png",
  "/brand/install/v6/apple-touch-icon.png"
];

function personalized(pathname) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/founder") ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/account")
  );
}

function cacheable(request, response) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.searchParams.has("_rsc") || url.search.includes("_next")) return false;
  if (personalized(url.pathname)) return false;
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (type.includes("application/json") || type.includes("text/x-component")) return false;
  if (type.includes("text/html") && url.pathname !== "/offline") return false;
  if (url.pathname === "/offline" || url.pathname === "/manifest.webmanifest") return true;
  return url.pathname.startsWith("/brand/");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(PREFIX) && key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(
            JSON.stringify({
              ok: false,
              delivered: "uncertain",
              retainRetry: true,
              message:
                "The request did not return a response. The server may already have stored it. Retry the same command — do not send a new one."
            }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          )
      )
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (cacheable(event.request, response) && response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return caches.match("/offline");
      })
  );
});
