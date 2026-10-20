import { LIFESTYLE_PALETTE, type BrandPalette } from "@/lib/cofounder/composition";
import type { FactKind, ProfileField, ProfileFieldKey } from "@/lib/cofounder/types";

/**
 * Confirmed facts only for Neil’s AETHELIOS LIFESTYLE rebrand.
 * Do not invent product benefits, ingredients, endorsements, results, or prices.
 */
export const LIFESTYLE_PROJECT = {
  brandName: "AETHELIOS LIFESTYLE",
  owner: "Neil Stutes",
  kind: "founder_product_rebrand" as const,
  story:
    "Before I use Atelier to elevate your business, here is how I elevate mine.",
  confirmed: {
    name: "AETHELIOS LIFESTYLE",
    owner: "Neil Stutes",
    relationship: "The founder’s own product brand, not a fabricated customer story."
  },
  missingAssets: [
    {
      id: "lifestyle-logo",
      title: "AETHELIOS LIFESTYLE logo",
      neededFor: "Studio composition and Discovery wordmark",
      status: "unavailable" as const
    },
    {
      id: "lifestyle-product-photography",
      title: "Product photography",
      neededFor: "Discovery hero and Studio background",
      status: "unavailable" as const
    },
    {
      id: "lifestyle-labels",
      title: "Product labels",
      neededFor: "Packaging hierarchy on the concept site",
      status: "unavailable" as const
    }
  ],
  palette: LIFESTYLE_PALETTE satisfies BrandPalette
};

export function lifestyleMissingCopy() {
  return LIFESTYLE_PROJECT.missingAssets
    .map((asset) => `${asset.title} — needed for ${asset.neededFor}`)
    .join(" · ");
}

export function lifestyleProfileFields(now: string): Record<ProfileFieldKey, ProfileField> {
  const field = (key: ProfileFieldKey, value: string, kind: FactKind): ProfileField => ({
    key,
    value,
    kind,
    source: "confirmed_founder_project",
    updatedAt: now
  });
  return {
    name: field("name", LIFESTYLE_PROJECT.brandName, "confirmed"),
    audience: field("audience", "", "suggestion"),
    services: field("services", "", "suggestion"),
    products: field("products", "", "suggestion"),
    approvedPrices: field("approvedPrices", "", "suggestion"),
    tone: field("tone", "", "suggestion"),
    priorities: field("priorities", "Elevate the founder’s own product brand before client work.", "preference"),
    brandNotes: field(
      "brandNotes",
      "Lifestyle rebrand. Use supplied logo and product assets only. Do not invent benefits, ingredients, endorsements, results, or prices.",
      "confirmed"
    )
  };
}

export function lifestyleOwnerEmails() {
  const extras = (process.env.ATELIER_LIFESTYLE_OWNER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return ["neil.local@atelier.invalid", ...extras];
}

export function isLifestyleOwner(email: string) {
  return lifestyleOwnerEmails().includes(email.trim().toLowerCase());
}
