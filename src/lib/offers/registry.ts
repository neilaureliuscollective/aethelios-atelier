import {
  BARBERS_SALON_FIELD_HINTS,
  BARBERS_SALON_FIELD_LABELS,
  BARBERS_SALONS_OFFER,
  isBarbersSalonOffer
} from "@/lib/offers/barbersSalons";
import {
  COMMERCE_FIELD_HINTS,
  COMMERCE_FIELD_LABELS,
  commerceOfferById,
  isCommerceOffer
} from "@/lib/offers/commerce";
import { isCommerceOfferId, isServiceOfferId, type ServiceOfferId } from "@/lib/offers/ids";
import type { Brief, BriefFieldKey } from "@/lib/types";

export function focusedOfferById(id: string | undefined | null) {
  if (id === BARBERS_SALONS_OFFER.id) return BARBERS_SALONS_OFFER;
  return commerceOfferById(id);
}

export function displayFocusedOfferLabel(id: string | undefined | null) {
  return focusedOfferById(id)?.title ?? "";
}

export function offerStarterById(offerId: string) {
  const offer = focusedOfferById(offerId);
  return offer?.starter;
}

export function isFocusedOffer(brief: { context?: { offerId?: string } | undefined } | null | undefined) {
  return isBarbersSalonOffer(brief) || isCommerceOffer(brief);
}

export function focusedOfferFieldLabels(brief: Brief): Partial<Record<BriefFieldKey, string>> | undefined {
  if (isBarbersSalonOffer(brief)) return BARBERS_SALON_FIELD_LABELS;
  if (isCommerceOffer(brief)) return COMMERCE_FIELD_LABELS;
  return undefined;
}

export function focusedOfferFieldHints(brief: Brief): Partial<Record<BriefFieldKey, string>> | undefined {
  if (isBarbersSalonOffer(brief)) return BARBERS_SALON_FIELD_HINTS;
  if (isCommerceOffer(brief)) return COMMERCE_FIELD_HINTS;
  return undefined;
}

export function offerImportNotice(offerId: ServiceOfferId | string) {
  if (offerId === BARBERS_SALONS_OFFER.id) {
    return "This is a request for a branded website connected to the booking system already in use. It does not buy a plan or create an appointment.";
  }
  if (isCommerceOfferId(offerId)) {
    return "This is a request for Atelier Commerce. It does not buy a plan, collect store payments, or create a catalog of Atelier products.";
  }
  return "This is a request for a focused offer. It does not buy a plan or collect payment.";
}

export function resolveServiceOfferId(value: string | undefined | null): ServiceOfferId | undefined {
  return value && isServiceOfferId(value) ? value : undefined;
}
