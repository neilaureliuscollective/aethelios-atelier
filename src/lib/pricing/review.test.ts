import { describe, expect, it } from "vitest";
import { pricingLocalReviewAllowed, resolvePricingMode } from "./review";

describe("local pricing review gate", () => {
  it("fails closed unless isolated local review is explicitly enabled", () => {
    expect(pricingLocalReviewAllowed({}).allowed).toBe(false);
    expect(
      pricingLocalReviewAllowed({
        ATELIER_PRICING_LOCAL_REVIEW: "true"
      }).allowed
    ).toBe(false);
    expect(
      resolvePricingMode({
        ATELIER_PRICING_LOCAL_REVIEW: "true",
        ATELIER_ISOLATED_LOCAL: "true"
      })
    ).toBe("local_review");
  });

  it("refuses hosted environments even when the local flag is copied", () => {
    const vercel = pricingLocalReviewAllowed({
      ATELIER_PRICING_LOCAL_REVIEW: "true",
      ATELIER_ISOLATED_LOCAL: "true",
      ATELIER_PUBLIC_ORIGIN: "http://localhost:3000",
      VERCEL: "1"
    });
    expect(vercel.allowed).toBe(false);
    expect(vercel.reason).toMatch(/hosted platform/i);

    expect(
      pricingLocalReviewAllowed({
        ATELIER_PRICING_LOCAL_REVIEW: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_HOSTED: "true"
      }).allowed
    ).toBe(false);
  });

  it("does not accept query-like or client flags as a substitute", () => {
    expect(
      pricingLocalReviewAllowed({
        ATELIER_ISOLATED_LOCAL: "true",
        NEXT_PUBLIC_PRICING_REVIEW: "true",
        ATELIER_PRICING_REVIEW: "1",
        QUERY_REVIEW: "true"
      }).allowed
    ).toBe(false);
    expect(
      resolvePricingMode({
        ATELIER_ISOLATED_LOCAL: "true",
        NEXT_PUBLIC_PRICING_REVIEW: "true"
      })
    ).toBe("public");
  });

  it("requires an exact loopback origin in production mode", () => {
    expect(
      pricingLocalReviewAllowed({
        NODE_ENV: "production",
        ATELIER_PRICING_LOCAL_REVIEW: "true",
        ATELIER_ISOLATED_LOCAL: "true"
      }).allowed
    ).toBe(false);
    expect(
      pricingLocalReviewAllowed({
        NODE_ENV: "production",
        ATELIER_PRICING_LOCAL_REVIEW: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "https://atelier.example.com"
      }).allowed
    ).toBe(false);
    expect(
      pricingLocalReviewAllowed({
        NODE_ENV: "production",
        ATELIER_PRICING_LOCAL_REVIEW: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "http://127.0.0.1:3000"
      }).allowed
    ).toBe(true);
  });
});
