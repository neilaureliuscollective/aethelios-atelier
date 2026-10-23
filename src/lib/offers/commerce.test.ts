import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMMERCE_OFFER_REVIEW, isCommerceApprovedForPublic } from "@/lib/offers/commerceReview";
import {
  ATELIER_COMMERCE_CORE_MESSAGE,
  ATELIER_COMMERCE_HREF,
  ATELIER_COMMERCE_PUBLIC_TERMS,
  COMMERCE_FOUNDATION_BRIEF_HREF,
  COMMERCE_FOUNDATION_OFFER,
  COMMERCE_LAUNCH_BRIEF_HREF,
  COMMERCE_LAUNCH_OFFER
} from "@/lib/offers/commerce";
import { isCommerceOfferId, isServiceOfferId } from "@/lib/offers/ids";

const PUBLIC_SURFACES = [
  "src/app/services/commerce/page.tsx",
  "src/app/services/page.tsx",
  "src/app/page.tsx",
  "src/components/marketing/AtelierManifesto.tsx",
  "src/lib/offers/commerce.ts",
  "src/lib/catalog.ts",
  "src/components/project/OfferImport.tsx",
  "src/components/project/OfferReview.tsx",
  "src/components/pricing/PricingExperience.tsx",
  "src/components/marketing/ServiceShowcase.tsx",
  "src/components/marketing/HeroComposition.tsx"
];

describe("Atelier Commerce public offer", () => {
  it("keeps the division title, core message, and brief destinations stable", () => {
    expect(COMMERCE_FOUNDATION_OFFER.title).toBe("Commerce Foundation");
    expect(COMMERCE_LAUNCH_OFFER.title).toBe("Commerce Launch");
    expect(ATELIER_COMMERCE_CORE_MESSAGE).toMatch(/storefront the client owns/i);
    expect(ATELIER_COMMERCE_HREF).toBe("/services/commerce");
    expect(COMMERCE_FOUNDATION_BRIEF_HREF).toBe(
      "/project?offer=commerce_foundation&interest=ecommerce_storefronts&purpose=business"
    );
    expect(COMMERCE_LAUNCH_BRIEF_HREF).toBe(
      "/project?offer=commerce_launch&interest=ecommerce_storefronts&purpose=business"
    );
    expect(ATELIER_COMMERCE_PUBLIC_TERMS).toMatch(/does not replace the published Atelier plan prices/i);
    expect(isServiceOfferId("commerce_foundation")).toBe(true);
    expect(isServiceOfferId("commerce_launch")).toBe(true);
    expect(isCommerceOfferId("commerce_foundation")).toBe(true);
    expect(isCommerceOfferId("barbers_salons")).toBe(false);
  });

  it("keeps the unapproved commercial proposal out of public surfaces", () => {
    expect(COMMERCE_OFFER_REVIEW.status).toBe("proposal_unapproved_for_public");
    expect(isCommerceApprovedForPublic()).toBe(false);
    expect(COMMERCE_OFFER_REVIEW.foundation.setupUsd).toBe(8000);
    expect(COMMERCE_OFFER_REVIEW.launch.setupUsd).toBe(12000);
    expect(COMMERCE_OFFER_REVIEW.foundation.skuCap).toBe(20);
    for (const file of PUBLIC_SURFACES) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\$8,000|\$8000|\$12,000|\$12000/);
      expect(source, file).not.toMatch(/setupUsd|extraConfiguredProductUsd|supplierShortlistUsd/);
      expect(source, file).not.toMatch(/Preserve|AETHELIOS RESERVE/i);
    }
  });

  it("does not present Atelier as a product catalog or second company", () => {
    const page = readFileSync("src/app/services/commerce/page.tsx", "utf8");
    const copy = readFileSync("src/lib/offers/commerce.ts", "utf8");
    expect(page).toContain("ATELIER_COMMERCE_PUBLIC_TITLE");
    expect(page).toMatch(/not a second company/i);
    expect(copy).toMatch(/not an Atelier catalog/i);
    expect(copy).toMatch(/not a second brand/i);
    expect(copy).not.toMatch(/winning products/i);
  });
});
