import { describe, expect, it } from "vitest";
import {
  ATELIER_CACHE_NAME,
  ATELIER_CACHE_PREFIX,
  isPersonalizedPath,
  shouldCacheResponse,
  uncertainWriteResponse
} from "@/lib/pwa/cachePolicy";

describe("offline cache policy", () => {
  it("refuses personalized HTML, APIs, and authenticated routes", () => {
    expect(isPersonalizedPath("/workspace/abc")).toBe(true);
    expect(isPersonalizedPath("/api/session")).toBe(true);
    expect(isPersonalizedPath("/companion/studio")).toBe(true);
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
    expect(ATELIER_CACHE_NAME).toBe("atelier-static-v11");
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/brand/install/v10/icon-512-maskable.png",
        contentType: "image/png",
        sameOrigin: true
      })
    ).toBe(true);
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/work/fix-it-shop/cinematic-showcase.mp4",
        contentType: "video/mp4",
        sameOrigin: true
      })
    ).toBe(false);
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/work/fix-it-shop/cinematic-loop.mp4",
        contentType: "video/mp4",
        sameOrigin: true
      })
    ).toBe(false);
    expect(
      shouldCacheResponse({
        method: "GET",
        pathname: "/industry/salon-hero.webp",
        contentType: "image/webp",
        sameOrigin: true
      })
    ).toBe(false);
  });

  it("describes a failed write as uncertain rather than definitely not delivered", () => {
    const payload = uncertainWriteResponse();
    expect(payload.delivered).toBe("uncertain");
    expect(payload.ok).toBe(false);
    expect(payload.message).not.toMatch(/not delivered/i);
    expect(payload.retainRetry).toBe(true);
  });
});
