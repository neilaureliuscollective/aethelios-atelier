import "server-only";
import { BARBERS_SALONS_OFFER_ID } from "@/lib/offers/ids";

/**
 * Isolated founder-review proposal for the Barbers & Salons offer.
 *
 * THESE AMOUNTS AND ALLOWANCES ARE NOT OWNER-APPROVED PUBLIC TERMS.
 * Do not import this module from public pages, metadata, structured data,
 * client components, or checkout. Public copy may describe a one-time build
 * fee plus ongoing hosting and care without naming these figures.
 */
export const BARBERS_SALONS_OFFER_REVIEW = {
  offerId: BARBERS_SALONS_OFFER_ID,
  status: "proposal_unapproved_for_public" as const,
  currency: "USD" as const,
  setupUsd: 299,
  monthlyUsd: 79,
  launchRevisionRounds: 2,
  monthlyContentUpdateMinutes: 20,
  note:
    "Proposal only. Do not publish these amounts, revision rounds, or the 20-minute care cap until Neil explicitly approves them.",
  publicUntilApproved:
    "A one-time build fee plus ongoing hosting and care. Neil confirms the exact proposal."
};

export type BarbersSalonsOfferReview = typeof BARBERS_SALONS_OFFER_REVIEW;

export function isApprovedForPublic(review: { status: string } = BARBERS_SALONS_OFFER_REVIEW) {
  return review.status === "approved_for_public";
}
