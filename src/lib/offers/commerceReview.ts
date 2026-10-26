import "server-only";
import {
  COMMERCE_FOUNDATION_OFFER_ID,
  COMMERCE_LAUNCH_OFFER_ID
} from "@/lib/offers/ids";

/**
 * Isolated founder-review proposal for Atelier Commerce.
 *
 * THESE AMOUNTS AND ALLOWANCES ARE NOT OWNER-APPROVED PUBLIC TERMS.
 * Do not import this module from public pages, metadata, structured data,
 * client components, or checkout. Public copy may describe a quoted commission
 * without naming these figures.
 */
export const COMMERCE_OFFER_REVIEW = {
  status: "proposal_unapproved_for_public" as const,
  currency: "USD" as const,
  foundation: {
    offerId: COMMERCE_FOUNDATION_OFFER_ID,
    setupUsd: 8000,
    skuCap: 20,
    extraConfiguredProductUsd: 100
  },
  launch: {
    offerId: COMMERCE_LAUNCH_OFFER_ID,
    setupUsd: 12000,
    skuCap: 20,
    extraConfiguredProductUsd: 100,
    supplierShortlistUsd: 2000
  },
  deposit: {
    startPercent: 50,
    stagingPercent: 25,
    launchPercent: 25
  },
  note:
    "Proposal only. Do not publish these amounts, SKU caps, or the extra-product rate until Neil explicitly approves them.",
  publicUntilApproved:
    "A founder-reviewed commerce commission. Neil confirms the exact proposal."
};

export type CommerceOfferReview = typeof COMMERCE_OFFER_REVIEW;

export function isCommerceApprovedForPublic(review: { status: string } = COMMERCE_OFFER_REVIEW) {
  return review.status === "approved_for_public";
}
