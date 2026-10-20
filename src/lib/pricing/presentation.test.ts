import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { billingBoundary } from "@/lib/billing/boundary";
import { publicRuntimeConfig } from "@/lib/config";
import {
  buildPricingPresentation,
  presentationContainsInternalBudgets,
  publicPricingFacts,
  recurringCharge,
  setupCharge
} from "./presentation";
import { STARTING_COMMERCIAL_TERMS } from "./terms";

const PUBLIC_ENV = {
  VERCEL: "1",
  ATELIER_PRICING_LOCAL_REVIEW: "true",
  ATELIER_ISOLATED_LOCAL: "true"
};

describe("pricing presentation", () => {
  it("reuses one canonical starting structure without marking remaining terms approved", () => {
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
  });

  it("renders exact setup and monthly amounts in normal public mode without a review flag", () => {
    const pub = buildPricingPresentation({ mode: "public", env: PUBLIC_ENV });
    expect(pub.mode).toBe("public");
    expect(pub.reviewBanner).toBeNull();
    expect(pub.founderChecklist).toEqual([]);
    expect(pub.billingEnabled).toBe(false);
    expect(pub.paymentCollected).toBe(false);
    expect(pub.plans.map((plan) => [plan.id, plan.setup.formatted, plan.recurring.formatted])).toEqual([
      ["atelier", "$299 one-time setup", "$249/month"],
      ["connected", "$499 one-time setup", "$399/month"],
      ["partnership", "Setup quoted", "$699/month"]
    ]);
    expect(pub.plans.find((plan) => plan.id === "partnership")?.setup.amountUsd).toBeNull();
    expect(JSON.stringify(pub)).not.toMatch(/\$0|0 one-time setup/);
    expect(pub.plans.every((plan) => plan.founderDecisions.length === 0)).toBe(true);
  });

  it("keeps hosted review flags from hiding the public amounts", () => {
    const pub = buildPricingPresentation({ env: PUBLIC_ENV });
    expect(pub.mode).toBe("public");
    expect(pub.plans[0]?.setup.formatted).toBe("$299 one-time setup");
    expect(pub.plans[0]?.recurring.formatted).toBe("$249/month");
  });

  it("does not invent amounts when terms are missing and never enables billing", () => {
    const incomplete = buildPricingPresentation({
      mode: "public",
      terms: {
        ...STARTING_COMMERCIAL_TERMS,
        plans: {
          ...STARTING_COMMERCIAL_TERMS.plans,
          connected: { setupUsd: 0, monthlyUsd: Number.NaN, setup: "amount" }
        }
      }
    });
    const connected = incomplete.plans.find((plan) => plan.id === "connected");
    expect(setupCharge({ setupUsd: 0, monthlyUsd: 399, setup: "amount" })).toMatchObject({
      kind: "unavailable",
      formatted: "Terms unavailable",
      amountUsd: null
    });
    expect(recurringCharge({ setupUsd: 499, monthlyUsd: Number.NaN, setup: "amount" })).toMatchObject({
      kind: "unavailable",
      formatted: "Terms unavailable",
      amountUsd: null
    });
    expect(connected?.setup.formatted).toBe("Terms unavailable");
    expect(connected?.recurring.formatted).toBe("Terms unavailable");
    expect(connected?.setup.amountUsd).toBeNull();
    expect(connected?.recurring.amountUsd).toBeNull();
    expect(billingBoundary.enabled).toBe(false);
    expect(billingBoundary.status().ready).toBe(false);
    expect(incomplete.billingEnabled).toBe(false);
    expect(incomplete.paymentCollected).toBe(false);
  });

  it("keeps quoted partnership setup from becoming zero and keeps payment collection off", () => {
    const pub = buildPricingPresentation({ mode: "public" });
    const partnership = pub.plans.find((plan) => plan.id === "partnership");
    expect(partnership?.setup.kind).toBe("quoted");
    expect(partnership?.setup.formatted).toBe("Setup quoted");
    expect(partnership?.setup.amountUsd).toBeNull();
    expect(partnership?.recurring.formatted).toBe("$699/month");
    expect(pub.billingEnabled).toBe(false);
    expect(pub.paymentCollected).toBe(false);
    expect(publicPricingFacts().billing.enabled).toBe(false);
    expect(JSON.stringify(pub)).not.toMatch(/buy now|start subscription|most popular|free trial/i);
  });

  it("does not publish unapproved inclusions or internal budgets as benefits", () => {
    const pub = buildPricingPresentation({ mode: "public" });
    const serialized = JSON.stringify(pub);
    expect(presentationContainsInternalBudgets(pub)).toBe(false);
    expect(serialized).not.toMatch(/unlimited websites included|includes unlimited websites/i);
    expect(serialized).not.toMatch(/differentiation is still a founder decision/i);
    expect(serialized).not.toMatch(/displayed prices are unpublished|unpublished commercial/i);
    expect(pub.comparison.find((row) => row.id === "unlimited")?.values.atelier).toBe("Not included");
    expect(pub.comparison.find((row) => row.id === "disabled")?.values.connected).toMatch(/not offered/i);
    expect(pub.faq.find((item) => item.id === "unlimited")?.answer).toMatch(/nothing here is an unlimited/i);
  });

  it("keeps cards, comparison, and FAQs in agreement", () => {
    const pub = buildPricingPresentation({ mode: "public" });
    const setupRow = pub.comparison.find((row) => row.id === "setup");
    const monthlyRow = pub.comparison.find((row) => row.id === "monthly");
    for (const plan of pub.plans) {
      expect(setupRow?.values[plan.id]).toBe(plan.setup.formatted);
      expect(monthlyRow?.values[plan.id]).toBe(plan.recurring.formatted);
    }
    expect(pub.comparison.find((row) => row.id === "payments")?.values.atelier).toBe("Not collected");
    expect(pub.comparison.find((row) => row.id === "commissions")?.values.connected).toMatch(/separately/i);
    expect(pub.faq.find((item) => item.id === "payments")?.answer).toMatch(/not collected/i);
    expect(pub.faq.find((item) => item.id === "charges")?.answer).toMatch(/scoped and priced separately/i);
    expect(pub.faq.find((item) => item.id === "confirm")?.answer).toMatch(/written proposal/i);
  });

  it("uses truthful discussion actions and verified commission destinations", () => {
    const pub = buildPricingPresentation({ mode: "public" });
    expect(pub.plans.map((plan) => plan.action)).toEqual([
      { href: "/project?plan=atelier", label: "Discuss this plan" },
      { href: "/project?plan=connected", label: "Discuss this plan" },
      { href: "/project?plan=partnership", label: "Discuss this plan" }
    ]);
    expect(pub.commissions.map((item) => item.href)).toEqual([
      "/discover?interest=website",
      "/project?interest=custom_apps_platforms&purpose=business",
      "/discover?interest=ecommerce_storefronts",
      "/project?interest=digital_infrastructure&purpose=business"
    ]);
  });

  it("does not put plan amounts in client-safe pricing modules", () => {
    const clientSafe = [
      "src/lib/pricing/ids.ts",
      "src/lib/pricing/context.ts",
      "src/lib/pricing/format.ts",
      "src/components/project/PlanInterest.tsx",
      "src/components/shell/SiteHeader.tsx",
      "src/components/shell/SiteFooter.tsx"
    ];
    for (const file of clientSafe) {
      expect(readFileSync(file, "utf8")).not.toMatch(/\b(?:249|299|399|499|699)\b/);
    }
    const experience = readFileSync("src/components/pricing/PricingExperience.tsx", "utf8");
    expect(experience).not.toMatch(/\b(?:249|299|399|499|699)\b/);
    expect(experience).toContain("plan.action.href");
    expect(experience).toContain("plan.setup.formatted");
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain(".pricing-plan.surface-obsidian .tiny");
    expect(css).toContain(".pricing-plan.surface-obsidian .pricing-charges dt");
  });

  it("keeps public config free of collected payments and internal budgets", () => {
    const previous = process.env.ATELIER_PRICING_LOCAL_REVIEW;
    const isolated = process.env.ATELIER_ISOLATED_LOCAL;
    process.env.ATELIER_PRICING_LOCAL_REVIEW = "true";
    process.env.ATELIER_ISOLATED_LOCAL = "true";
    process.env.VERCEL = "1";
    try {
      const config = publicRuntimeConfig();
      expect(config.pricing.status).toBe("not_finalized");
      expect(config.pricing.note).toMatch(/payments are not collected/i);
      expect(config.billing.enabled).toBe(false);
      expect(JSON.stringify(config)).not.toMatch(/\b(?:249|299|399|499|699)\b/);
      expect(presentationContainsInternalBudgets(config)).toBe(false);
      expect(publicPricingFacts().note).toMatch(/shown in USD/i);
    } finally {
      if (previous === undefined) delete process.env.ATELIER_PRICING_LOCAL_REVIEW;
      else process.env.ATELIER_PRICING_LOCAL_REVIEW = previous;
      if (isolated === undefined) delete process.env.ATELIER_ISOLATED_LOCAL;
      else process.env.ATELIER_ISOLATED_LOCAL = isolated;
      delete process.env.VERCEL;
    }
  });
});
