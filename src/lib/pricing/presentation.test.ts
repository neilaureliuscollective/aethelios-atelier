import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { billingBoundary } from "@/lib/billing/boundary";
import { publicRuntimeConfig } from "@/lib/config";
import {
  buildPricingPresentation,
  presentationContainsUnapprovedAmounts,
  publicPricingFacts
} from "./presentation";
import { STARTING_COMMERCIAL_TERMS } from "./terms";

describe("pricing presentation", () => {
  it("reuses the current starting structure without marking it approved", () => {
    expect(STARTING_COMMERCIAL_TERMS.status).toBe("not_finalized");
    expect(STARTING_COMMERCIAL_TERMS.plans.atelier).toEqual({
      setupUsd: 299,
      monthlyUsd: 249,
      setup: "amount"
    });
    expect(STARTING_COMMERCIAL_TERMS.plans.connected).toEqual({
      setupUsd: 499,
      monthlyUsd: 399,
      setup: "amount"
    });
    expect(STARTING_COMMERCIAL_TERMS.plans.partnership).toEqual({
      setupUsd: null,
      monthlyUsd: 699,
      setup: "quoted"
    });

    const local = buildPricingPresentation({ mode: "local_review" });
    expect(local.publicationStatus).toBe("not_finalized");
    expect(local.billingEnabled).toBe(false);
    expect(local.paymentCollected).toBe(false);
    expect(local.plans.map((plan) => plan.setup.formatted)).toEqual([
      "$299 one-time setup",
      "$499 one-time setup",
      "Setup quoted"
    ]);
    expect(local.plans.map((plan) => plan.recurring.formatted)).toEqual([
      "$249/month",
      "$399/month",
      "$699/month"
    ]);
    expect(local.reviewBanner).toMatch(/draft pricing pending final terms/i);
  });

  it("omits unapproved amounts from the public presentation and public config", () => {
    const pub = buildPricingPresentation({
      mode: "public",
      env: { VERCEL: "1", ATELIER_PRICING_LOCAL_REVIEW: "true", ATELIER_ISOLATED_LOCAL: "true" }
    });
    expect(pub.mode).toBe("public");
    expect(pub.plans.every((plan) => plan.setup.formatted === "Discuss your scope")).toBe(true);
    expect(pub.plans.every((plan) => plan.recurring.formatted === "Request a proposal")).toBe(true);
    expect(pub.reviewBanner).toBeNull();
    expect(pub.founderChecklist).toEqual([]);
    expect(presentationContainsUnapprovedAmounts(pub)).toBe(false);
    expect(presentationContainsUnapprovedAmounts(publicPricingFacts())).toBe(false);

    const previous = process.env.ATELIER_PRICING_LOCAL_REVIEW;
    const isolated = process.env.ATELIER_ISOLATED_LOCAL;
    process.env.ATELIER_PRICING_LOCAL_REVIEW = "true";
    process.env.ATELIER_ISOLATED_LOCAL = "true";
    process.env.VERCEL = "1";
    try {
      expect(presentationContainsUnapprovedAmounts(publicRuntimeConfig())).toBe(false);
      expect(publicRuntimeConfig().pricing.status).toBe("not_finalized");
    } finally {
      if (previous === undefined) delete process.env.ATELIER_PRICING_LOCAL_REVIEW;
      else process.env.ATELIER_PRICING_LOCAL_REVIEW = previous;
      if (isolated === undefined) delete process.env.ATELIER_ISOLATED_LOCAL;
      else process.env.ATELIER_ISOLATED_LOCAL = isolated;
      delete process.env.VERCEL;
    }
  });

  it("does not invent amounts when terms are missing and never enables billing", () => {
    const incomplete = buildPricingPresentation({
      mode: "local_review",
      terms: {
        ...STARTING_COMMERCIAL_TERMS,
        plans: {
          ...STARTING_COMMERCIAL_TERMS.plans,
          connected: { setupUsd: 499, monthlyUsd: Number.NaN, setup: "amount" }
        }
      }
    });
    const connected = incomplete.plans.find((plan) => plan.id === "connected");
    expect(connected?.recurring.kind).toBe("unavailable");
    expect(connected?.recurring.formatted).toBe("Terms unavailable");
    expect(connected?.recurring.amountUsd).toBeNull();
    expect(billingBoundary.enabled).toBe(false);
    expect(billingBoundary.status().ready).toBe(false);
    expect(incomplete.billingEnabled).toBe(false);
  });

  it("uses truthful discussion actions and verified commission destinations", () => {
    const pub = buildPricingPresentation({ mode: "public" });
    expect(pub.plans.map((plan) => plan.action)).toEqual([
      { href: "/project?plan=atelier", label: "Discuss this plan" },
      { href: "/project?plan=connected", label: "Discuss this plan" },
      { href: "/project?plan=partnership", label: "Discuss this plan" }
    ]);
    expect(JSON.stringify(pub)).not.toMatch(/buy now|start subscription|most popular|free trial/i);
    expect(pub.commissions.map((item) => item.href)).toEqual([
      "/discover?interest=website",
      "/project?interest=custom_apps_platforms&purpose=business",
      "/discover?interest=ecommerce_storefronts",
      "/project?interest=digital_infrastructure&purpose=business"
    ]);
    expect(pub.faq.some((item) => /subscription/i.test(item.question))).toBe(true);
  });

  it("does not put draft amounts in client-safe pricing modules or public metadata", () => {
    const clientSafe = [
      "src/lib/pricing/ids.ts",
      "src/lib/pricing/context.ts",
      "src/lib/pricing/format.ts",
      "src/components/project/PlanInterest.tsx",
      "src/app/pricing/page.tsx",
      "src/components/shell/SiteHeader.tsx",
      "src/components/shell/SiteFooter.tsx"
    ];
    for (const file of clientSafe) {
      expect(readFileSync(file, "utf8")).not.toMatch(/\b(?:249|299|399|499|699)\b/);
    }
  });

  it("keeps operational budgets and disabled capabilities out of customer promises", () => {
    const local = buildPricingPresentation({ mode: "local_review" });
    const serialized = JSON.stringify(local);
    expect(serialized).not.toMatch(/\b(80|160|240|20|40|60) (talk|images|voice)/i);
    expect(serialized.toLowerCase()).not.toMatch(/includes unlimited websites|unlimited websites included/);
    expect(local.comparison.find((row) => row.id === "unlimited")?.values.atelier).toBe("Not included");
    expect(local.comparison.some((row) => row.id === "disabled")).toBe(true);
    expect(local.founderChecklist.length).toBeGreaterThan(0);
    expect(local.plans.every((plan) => plan.founderDecisions.length > 0)).toBe(true);
  });
});
