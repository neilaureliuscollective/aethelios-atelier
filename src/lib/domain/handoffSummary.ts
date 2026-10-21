import { displayPurposeLabel } from "@/lib/commissionContext";
import { displayOfferLabel } from "@/lib/offers/barbersSalons";
import { PLAN_LABELS } from "@/lib/pricing/ids";
import { displayShowcaseLabel } from "@/lib/work/fixItShop";
import type { Brief } from "@/lib/types";

export function handoffSummaryFromBrief(brief: Brief): string {
  const parts: string[] = [];
  const offer = displayOfferLabel(brief.context?.offerId);
  const purpose = displayPurposeLabel(brief.context?.purpose);
  const showcase = displayShowcaseLabel(brief.context?.showcaseId);
  if (offer) parts.push(offer);
  else if (purpose) parts.push(purpose);
  if (showcase) parts.push(`${showcase} showcase`);
  const constraints = brief.constraints?.value ?? "";
  if (constraints.includes("ongoing plan")) {
    for (const label of Object.values(PLAN_LABELS)) {
      if (constraints.includes(label)) {
        parts.push(`${label} plan interest`);
        break;
      }
    }
  }
  return parts.join(" · ");
}
