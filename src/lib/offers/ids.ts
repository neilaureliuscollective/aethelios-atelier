export const SERVICE_OFFER_IDS = ["barbers_salons"] as const;

export type ServiceOfferId = (typeof SERVICE_OFFER_IDS)[number];

export const BARBERS_SALONS_OFFER_ID = "barbers_salons" as const;

export function isServiceOfferId(value: string): value is ServiceOfferId {
  return (SERVICE_OFFER_IDS as readonly string[]).includes(value);
}
