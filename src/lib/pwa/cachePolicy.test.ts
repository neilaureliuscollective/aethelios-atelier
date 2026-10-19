import { describe, expect, it } from "vitest";
import { ATELIER_CACHE_PREFIX, isPersonalizedPath, shouldCacheResponse } from "@/lib/pwa/cachePolicy";

describe("offline cache policy", () => {
  it("refuses personalized HTML, APIs, and authenticated routes", () => {
    expect(isPersonalizedPath("/workspace/abc")).toBe(true);
    expect(isPersonalizedPath("/api/session")).toBe(true);
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/",
        contentType: "text/html; charset=utf-8",
        sameOrigin: true
      })
    ).toBe(false);
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/services",
        contentType: "text/html",
        sameOrigin: true
      })
    ).toBe(false);
  });

  it("allows only generic offline shell and public brand assets", () => {
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/offline",
        contentType: "text/html",
        sameOrigin: true
      })
    ).toBe(true);
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/brand/icon.webp",
        contentType: "image/webp",
        sameOrigin: true
      })
    ).toBe(true);
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/",
        contentType: "text/html",
        sameOrigin: true,
        search: "?_rsc=1"
      })
    ).toBe(false);
    expect(ATELIER_CACHE_PREFIX).toBe("atelier-static-");
  });
});
