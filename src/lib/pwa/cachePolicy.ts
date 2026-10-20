/** Explicit safe allowlist for the Atelier service worker. Keep in sync with public/sw.js. */

export const ATELIER_CACHE_PREFIX = "atelier-static-";
export const ATELIER_CACHE_NAME = "atelier-static-v10";

const STATIC_EXACT = new Set(["/offline", "/manifest.webmanifest"]);
const STATIC_PREFIXES = ["/brand/"];

export function isPersonalizedPath(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/workspace") ||
    pathname.startsWith("/founder") ||
    pathname.startsWith("/project") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/companion")
  );
}

export function isUnsafeSearch(search?: string) {
  const value = search ?? "";
  return value.includes("_rsc") || value.includes("_next");
}

export function isCacheablePublicAsset(pathname: string, contentType?: string | null) {
  if (isPersonalizedPath(pathname)) return false;
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/html") && pathname !== "/offline") return false;
  if (STATIC_EXACT.has(pathname)) return true;
  return STATIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function uncertainWriteResponse() {
  return {
    ok: false as const,
    delivered: "uncertain" as const,
    message:
      "The request did not return a response. The server may already have stored it. Retry the same command — do not send a new one.",
    retainRetry: true as const
  };
}

export function shouldCacheResponse(input: {
  method: string;
  pathname: string;
  contentType?: string | null;
  sameOrigin: boolean;
  search?: string;
}) {
  if (input.method !== "GET") return false;
  if (!input.sameOrigin) return false;
  if (isUnsafeSearch(input.search)) return false;
  const type = (input.contentType ?? "").toLowerCase();
  if (type.includes("application/json") || type.includes("text/x-component") || type.includes("text/x-script")) {
    return false;
  }
  return isCacheablePublicAsset(input.pathname, input.contentType);
}
