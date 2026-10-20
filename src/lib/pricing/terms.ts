import "server-only";
import { PLAN_IDS, type PlanId } from "@/lib/pricing/ids";

export const PRICING_PUBLICATION_STATUS = "not_finalized" as const;

export type PricingPublicationStatus = typeof PRICING_PUBLICATION_STATUS;

export type StartingPlanTerms = {
  setupUsd: number | null;
  monthlyUsd: number | null;
  setup: "quoted" | "amount";
};

/**
 * Founder starting commercial structure from the current review.
 * Not approved for publication, not a live catalog, and not checkout.
 */
export const STARTING_COMMERCIAL_TERMS = {
  status: PRICING_PUBLICATION_STATUS,
  source: "founder_starting_structure" as const,
  note: "Draft pricing pending final terms. Not activated as Stripe products or billed amounts.",
  currency: "USD" as const,
  plans: {
    atelier: { setupUsd: 299, monthlyUsd: 249, setup: "amount" as const },
    connected: { setupUsd: 499, monthlyUsd: 399, setup: "amount" as const },
    partnership: { setupUsd: null, monthlyUsd: 699, setup: "quoted" as const }
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
