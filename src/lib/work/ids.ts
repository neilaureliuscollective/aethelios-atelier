export const SHOWCASE_IDS = ["fix_it_shop"] as const;

export type ShowcaseId = (typeof SHOWCASE_IDS)[number];

export const FIX_IT_SHOP_SHOWCASE_ID = "fix_it_shop" as const;

export function isShowcaseId(value: string): value is ShowcaseId {
  return (SHOWCASE_IDS as readonly string[]).includes(value);
}
