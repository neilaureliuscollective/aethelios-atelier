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
import { BARBERS_SALONS_OFFER_ID, type ServiceOfferId } from "@/lib/offers/ids";
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

export function offerStarterById(offerId: string) {
  if (offerId === BARBERS_SALONS_OFFER.id) return BARBERS_SALONS_OFFER.starter;
  return undefined;
}

export function matchingOfferStarterValue(brief: Brief, key: BriefFieldKey, offerId: string | undefined) {
  const starter = offerId ? offerStarterById(offerId) : undefined;
  if (!starter || !(key in starter)) return false;
  return brief[key].value.trim() === starter[key as BarbersSalonStarterKey].trim();
}

export function applyOfferStarterField(
  brief: Brief,
  key: BriefFieldKey,
  value: string,
  previousStarter: string,
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
  if (current && current !== previousStarter.trim()) return brief;
  if (current === nextValue) return brief;
  return current ? brief : applyClientValue(brief, key, nextValue);
}

export { applyOfferStarters, clearMatchingOfferStarters };

export function proposeOfferImport(brief: Brief, offerId: ServiceOfferId = BARBERS_SALONS_OFFER_ID): OfferImportProposal {
  const offer = offerId === BARBERS_SALONS_OFFER.id ? BARBERS_SALONS_OFFER : undefined;
  const starter = offer?.starter ?? BARBERS_SALONS_OFFER.starter;
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
          label: BARBERS_SALON_FIELD_LABELS[key],
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
  let next = applyBriefContext(brief, { offerId, purpose: "business", route: "business", bookingNeeded: true });
  if (!next.projectType.value.trim()) {
    next = applyClientValue(next, "projectType", "website");
  }
  for (const key of OFFER_STARTER_KEYS) {
    const decision = decisions[key] ?? "skip";
    next = applyOfferStarterField(next, key, starter[key], "", decision);
  }
  return next;
}

export function dismissOfferImport(brief: Brief): Brief {
  const offerId = brief.context?.offerId;
  const cleared = offerId ? clearMatchingOfferStarters(brief, offerId) : brief;
  return applyBriefContext(cleared, { offerId: "" });
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
    bookingDestination: brief.bookingProvider.value.trim() || "Not yet captured",
    bookingCheck: booking,
    assets: brief.references.value.trim() || "Not yet captured",
    scope: [brief.goals.value.trim(), brief.priorities.value.trim()].filter(Boolean).join(" · ") || "Not yet captured",
    location: brief.constraints.value.trim() || "Not yet captured",
    unresolved
  };
}

export function emptyOfferAwareBrief() {
  return normalizeBrief(createEmptyBrief());
}

export function offerDecisionCopy(decision: FieldDecision) {
  return fieldDecisionLabel(decision);
}
