import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BARBERS_SALONS_OFFER_REVIEW, isApprovedForPublic } from "@/lib/offers/barbersSalonsReview";
import {
  BARBERS_SALONS_BRIEF_HREF,
  BARBERS_SALONS_CORE_MESSAGE,
  BARBERS_SALONS_OFFER,
  BARBERS_SALONS_PUBLIC_TERMS
} from "@/lib/offers/barbersSalons";

const PUBLIC_SURFACES = [
  "src/app/services/barbers-salons/page.tsx",
  "src/app/page.tsx",
  "src/components/marketing/AtelierManifesto.tsx",
  "src/app/services/page.tsx",
  "src/lib/offers/barbersSalons.ts",
  "src/lib/offers/demo.ts",
  "src/lib/work/fixItShop.ts",
  "src/components/marketing/barbers/ValeCrownDemo.tsx",
  "src/components/marketing/barbers/BarbersSalonShowcase.tsx",
  "src/components/work/SelectedWork.tsx",
  "src/components/project/OfferImport.tsx",
  "src/components/project/OfferReview.tsx",
  "src/components/pricing/PricingExperience.tsx"
];

describe("barbers and salons public offer", () => {
  it("keeps the working title, core message, and brief destination stable", () => {
    expect(BARBERS_SALONS_OFFER.title).toBe("Atelier for Barbers & Salons");
    expect(BARBERS_SALONS_CORE_MESSAGE).toMatch(/booking system you already use/i);
    expect(BARBERS_SALONS_BRIEF_HREF).toBe("/#aethelios");
    expect(BARBERS_SALONS_PUBLIC_TERMS).toMatch(/one-time build fee plus ongoing hosting and care/i);
    expect(BARBERS_SALONS_PUBLIC_TERMS).not.toMatch(/plan prices/i);
  });

  it("keeps the unapproved commercial proposal out of public surfaces", () => {
    expect(BARBERS_SALONS_OFFER_REVIEW.status).toBe("proposal_unapproved_for_public");
    expect(isApprovedForPublic()).toBe(false);
    expect(BARBERS_SALONS_OFFER_REVIEW.setupUsd).toBe(299);
    expect(BARBERS_SALONS_OFFER_REVIEW.monthlyUsd).toBe(79);
    expect(BARBERS_SALONS_OFFER_REVIEW.monthlyContentUpdateMinutes).toBe(20);
    for (const file of PUBLIC_SURFACES) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\$79\b/);
      expect(source, file).not.toMatch(/20 minutes|20-minute/);
      expect(source, file).not.toMatch(/two launch revision/i);
      expect(source, file).not.toMatch(/setupUsd|monthlyUsd/);
    }
  });

  it("keeps the unapproved offer figures out of the public offer module", () => {
    expect(readFileSync("src/lib/offers/barbersSalons.ts", "utf8")).not.toMatch(/\$79|\$249|\$299|\$399|\$699/);
  });
});
