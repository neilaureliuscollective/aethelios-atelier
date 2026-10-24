import {
  applyBriefContext,
  applyClientValue,
  applyOfferStarters,
  clearMatchingOfferStarters,
  createEmptyBrief,
  normalizeBrief
} from "@/lib/brief";
import { fieldDecisionLabel, type FieldDecision } from "@/lib/copy";
import {
  BARBERS_SALON_FIELD_LABELS,
  BARBERS_SALONS_OFFER,
  isBarbersSalonOffer,
  type BarbersSalonStarterKey
} from "@/lib/offers/barbersSalons";
import { COMMERCE_FIELD_LABELS, commerceOfferById, isCommerceOffer } from "@/lib/offers/commerce";
import { BARBERS_SALONS_OFFER_ID, isCommerceOfferId, type ServiceOfferId } from "@/lib/offers/ids";
import { focusedOfferById, offerStarterById } from "@/lib/offers/registry";
import { checkBookingDestination } from "@/lib/offers/bookingDestination";
import { BRIEF_FIELD_KEYS, type Brief, type BriefFieldKey } from "@/lib/types";

export const OFFER_STARTER_KEYS = [
  "vision",
  "audience",
  "existingWebsite",
  "bookingProvider",
  "goals",
  "priorities",
  "constraints"
] as const satisfies readonly BarbersSalonStarterKey[];

export type OfferImportProposal = {
  offerId: ServiceOfferId;
  title: string;
  fields: Array<{
    key: BriefFieldKey;
    label: string;
    current: string;
    proposed: string;
    defaultDecision: FieldDecision;
  }>;
};

export { offerStarterById };

export function matchingOfferStarterValue(brief: Brief, key: BriefFieldKey, offerId: string | undefined) {
  const starter = offerId ? offerStarterById(offerId) : undefined;
  if (!starter || !(key in starter)) return false;
  return brief[key].value.trim() === starter[key as BarbersSalonStarterKey].trim();
}

export function applyOfferStarterField(
  brief: Brief,
  key: BriefFieldKey,
  value: string,
  decision: FieldDecision = "skip"
): Brief {
  const nextValue = value.trim();
  const current = brief[key].value.trim();
  if (decision === "replace") return applyClientValue(brief, key, nextValue);
  if (!nextValue) return brief;
  if (decision === "append") {
    if (!current) return applyClientValue(brief, key, nextValue);
    if (current === nextValue) return brief;
    return applyClientValue(brief, key, `${current}\n\n${nextValue}`);
  }
  return brief;
}

export { applyOfferStarters, clearMatchingOfferStarters };

export function proposeOfferImport(brief: Brief, offerId: ServiceOfferId = BARBERS_SALONS_OFFER_ID): OfferImportProposal {
  const offer = focusedOfferById(offerId);
  const starter = offer?.starter ?? BARBERS_SALONS_OFFER.starter;
  const labels = isCommerceOfferId(offerId) ? COMMERCE_FIELD_LABELS : BARBERS_SALON_FIELD_LABELS;
  return {
    offerId,
    title: offer?.title ?? BARBERS_SALONS_OFFER.title,
    fields: OFFER_STARTER_KEYS.flatMap((key) => {
      const proposed = starter[key].trim();
      if (!proposed) return [];
      const current = brief[key].value.trim();
      return [
        {
          key,
          label: labels[key],
          current,
          proposed,
          defaultDecision: current && current !== proposed ? "skip" : "append"
        }
      ];
    })
  };
}

export function applyOfferImportDecisions(
  brief: Brief,
  decisions: Partial<Record<BriefFieldKey, FieldDecision>>,
  offerId: ServiceOfferId = BARBERS_SALONS_OFFER_ID
): Brief {
  const starter = offerStarterById(offerId);
  if (!starter) return brief;
  const commerce = isCommerceOfferId(offerId);
  let next = applyBriefContext(brief, {
    offerId,
    purpose: "business",
    route: "business",
    bookingNeeded: commerce ? false : true
  });
  if (!next.projectType.value.trim()) {
    next = applyClientValue(next, "projectType", commerce ? "ecommerce_storefronts" : "website");
  }
  for (const key of OFFER_STARTER_KEYS) {
    const decision = decisions[key] ?? "skip";
    next = applyOfferStarterField(next, key, starter[key], decision);
  }
  return next;
}

export function dismissOfferImport(brief: Brief): Brief {
  return applyBriefContext(brief, { offerId: "" });
}

export function barbersSalonReviewSummary(brief: Brief) {
  if (!isBarbersSalonOffer(brief)) return null;
  const booking = checkBookingDestination(brief.bookingProvider.value);
  const unresolved = BRIEF_FIELD_KEYS.filter((key) => {
    if (key === "budget" || key === "timing" || key === "projectType") return false;
    return !brief[key].value.trim();
  }).map((key) => key);
  return {
    offerId: BARBERS_SALONS_OFFER_ID,
    offerTitle: BARBERS_SALONS_OFFER.title,
    kind: "barbers_salons" as const,
    bookingDestination: brief.bookingProvider.value.trim() || "Not yet captured",
    bookingCheck: booking,
    assets: brief.references.value.trim() || "Not yet captured",
    scope: [brief.goals.value.trim(), brief.priorities.value.trim()].filter(Boolean).join(" · ") || "Not yet captured",
    location: brief.constraints.value.trim() || "Not yet captured",
    unresolved
  };
}

export function commerceReviewSummary(brief: Brief) {
  if (!isCommerceOffer(brief)) return null;
  const offer = commerceOfferById(brief.context?.offerId);
  const unresolved = BRIEF_FIELD_KEYS.filter((key) => {
    if (key === "budget" || key === "timing" || key === "projectType") return false;
    return !brief[key].value.trim();
  }).map((key) => key);
  return {
    offerId: offer?.id ?? brief.context?.offerId ?? "",
    offerTitle: offer?.title ?? "Atelier Commerce",
    kind: "commerce" as const,
    commerceSetup: brief.bookingProvider.value.trim() || "Not yet captured",
    assets: brief.references.value.trim() || "Not yet captured",
    scope: [brief.goals.value.trim(), brief.priorities.value.trim()].filter(Boolean).join(" · ") || "Not yet captured",
    constraints: brief.constraints.value.trim() || "Not yet captured",
    unresolved
  };
}

export function emptyOfferAwareBrief() {
  return normalizeBrief(createEmptyBrief());
}

export function offerDecisionCopy(decision: FieldDecision) {
  return fieldDecisionLabel(decision);
}
