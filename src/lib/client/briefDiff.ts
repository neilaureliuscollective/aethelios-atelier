import { FIELD_LABELS, displayFieldValue } from "@/lib/brief";
import {
  displayPurposeLabel,
  emptyCommissionContext,
  normalizeCommissionContext,
  type CommissionContext
} from "@/lib/commissionContext";
import { exampleById } from "@/lib/customProjectExamples";
import { displayOfferLabel } from "@/lib/offers/barbersSalons";
import { BRIEF_FIELD_KEYS, type Brief, type BriefFieldKey } from "@/lib/types";

export const CONTEXT_DIFF_KEYS = ["purpose", "route", "exampleId", "bookingNeeded", "offerId"] as const;
export type ContextDiffKey = (typeof CONTEXT_DIFF_KEYS)[number];

export const CONTEXT_FIELD_LABELS: Record<ContextDiffKey, string> = {
  purpose: "Project kind",
  route: "Entry route",
  exampleId: "Starting example",
  bookingNeeded: "Booking required",
  offerId: "Focused offer"
};

const ROUTE_LABELS: Record<string, string> = {
  business: "Business commission",
  custom_project: "Custom project"
};

export function resolvedBriefContext(brief: Brief): CommissionContext {
  return normalizeCommissionContext(brief.context) ?? emptyCommissionContext();
}

export function briefsEqual(a: Brief, b: Brief) {
  if (!BRIEF_FIELD_KEYS.every((key) => a[key].value === b[key].value)) return false;
  const left = resolvedBriefContext(a);
  const right = resolvedBriefContext(b);
  return CONTEXT_DIFF_KEYS.every((key) => left[key] === right[key]);
}

export type BriefDifference = {
  key: BriefFieldKey | ContextDiffKey;
  label: string;
  local: string;
  server: string;
};

export function displayContextValue(key: ContextDiffKey, context: CommissionContext) {
  switch (key) {
    case "purpose":
      return displayPurposeLabel(context.purpose) || "Not specified";
    case "route":
      return ROUTE_LABELS[context.route] || "Not specified";
    case "exampleId": {
      const example = context.exampleId ? exampleById(context.exampleId) : undefined;
      return example?.title || (context.exampleId ? context.exampleId : "Not specified");
    }
    case "bookingNeeded":
      if (context.bookingNeeded === true) return "Yes";
      if (context.bookingNeeded === false) return "No";
      return "Not specified";
    case "offerId":
      return displayOfferLabel(context.offerId) || (context.offerId ? context.offerId : "Not specified");
  }
}

export function briefDifferences(local: Brief, server: Brief): BriefDifference[] {
  const fieldDiffs = BRIEF_FIELD_KEYS.flatMap((key) => {
    if (local[key].value === server[key].value) return [];
    return [
      {
        key,
        label: FIELD_LABELS[key],
        local: displayFieldValue(key, local[key].value) || "Empty",
        server: displayFieldValue(key, server[key].value) || "Empty"
      }
    ];
  });
  const localContext = resolvedBriefContext(local);
  const serverContext = resolvedBriefContext(server);
  const contextDiffs = CONTEXT_DIFF_KEYS.flatMap((key) => {
    if (localContext[key] === serverContext[key]) return [];
    return [
      {
        key,
        label: CONTEXT_FIELD_LABELS[key],
        local: displayContextValue(key, localContext),
        server: displayContextValue(key, serverContext)
      }
    ];
  });
  return [...fieldDiffs, ...contextDiffs];
}

export function wordingMatchesMessage(differences: BriefDifference[]) {
  return differences.length === 0 ? "The wording matches. You can continue from the saved copy." : null;
}
