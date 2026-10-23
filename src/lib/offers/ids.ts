export const SERVICE_OFFER_IDS = ["barbers_salons", "commerce_foundation", "commerce_launch"] as const;

export type ServiceOfferId = (typeof SERVICE_OFFER_IDS)[number];

export const BARBERS_SALONS_OFFER_ID = "barbers_salons" as const;
export const COMMERCE_FOUNDATION_OFFER_ID = "commerce_foundation" as const;
export const COMMERCE_LAUNCH_OFFER_ID = "commerce_launch" as const;

export function isServiceOfferId(value: string): value is ServiceOfferId {
  return (SERVICE_OFFER_IDS as readonly string[]).includes(value);
}

export function isCommerceOfferId(
  value: string | undefined | null
): value is typeof COMMERCE_FOUNDATION_OFFER_ID | typeof COMMERCE_LAUNCH_OFFER_ID {
  return value === COMMERCE_FOUNDATION_OFFER_ID || value === COMMERCE_LAUNCH_OFFER_ID;
}
