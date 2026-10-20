import "server-only";
import { STARTING_COMMERCIAL_TERMS as FOUNDER_STARTING_TERMS } from "@/lib/cofounder/entitlements";
import { PLAN_IDS, type PlanId } from "@/lib/pricing/ids";

export const PRICING_PUBLICATION_STATUS = "not_finalized" as const;

export type PricingPublicationStatus = typeof PRICING_PUBLICATION_STATUS;

export type StartingPlanTerms = {
  setupUsd: number | null;
  monthlyUsd: number | null;
  setup: "quoted" | "amount";
};

function presentPlan(plan: { setupUsd: number | null; monthlyUsd: number | null; setup?: "quoted" }): StartingPlanTerms {
  return {
    setupUsd: plan.setupUsd,
    monthlyUsd: plan.monthlyUsd,
    setup: plan.setup === "quoted" || plan.setupUsd == null ? "quoted" : "amount"
  };
}

/**
 * Presentation wrapper around the founder starting structure in entitlements.
 * Amounts may be shown publicly. This is not a second entitlement system and not checkout.
 */
export const STARTING_COMMERCIAL_TERMS = {
  status: FOUNDER_STARTING_TERMS.status,
  source: FOUNDER_STARTING_TERMS.source,
  note: "Displayed plan prices in USD. Not activated as Stripe products or collected charges.",
  currency: "USD" as const,
  plans: {
    atelier: presentPlan(FOUNDER_STARTING_TERMS.plans.atelier),
    connected: presentPlan(FOUNDER_STARTING_TERMS.plans.connected),
    partnership: presentPlan(FOUNDER_STARTING_TERMS.plans.partnership)
  } satisfies Record<PlanId, StartingPlanTerms>
};

export type StartingCommercialTerms = typeof STARTING_COMMERCIAL_TERMS;

export function startingTermsForPlan(
  planId: PlanId,
  terms: StartingCommercialTerms = STARTING_COMMERCIAL_TERMS
): StartingPlanTerms | null {
  const plan = terms.plans[planId];
  return plan ?? null;
}

export function allStartingPlanIds(): PlanId[] {
  return [...PLAN_IDS];
}
