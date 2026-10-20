import type { ProjectType } from "@/lib/types";

/** Stored id kept for briefs saved before the Custom apps headline. */
export const HISTORICAL_BOOKING_PROJECT_TYPE = "booking_connected_website" as const;

export const VISIBLE_PROJECT_TYPES = [
  "website",
  "custom_apps_platforms",
  "ecommerce_storefronts",
  "digital_infrastructure",
  "undecided"
] as const;

export type VisibleProjectType = (typeof VISIBLE_PROJECT_TYPES)[number];

export const PROJECT_TYPE_COMPATIBILITY: Record<string, VisibleProjectType> = {
  booking_connected_website: "custom_apps_platforms"
};

export const SERVICE_CATEGORY_COPY: Record<
  VisibleProjectType,
  { title: string; short: string; summary: string; action: string }
> = {
  website: {
    title: "Branded websites",
    short: "Business presence",
    summary:
      "A considered public presence that presents the business clearly and builds trust. Identity work is a consistent quality here, and a separate rebrand is only scoped when you ask for it.",
    action: "Explore a website direction"
  },
  custom_apps_platforms: {
    title: "Custom apps & platforms",
    short: "Purpose-built tools",
    summary:
      "Web tools, portals, and installable experiences shaped around how the work actually happens. Linking an existing booking provider is only asked when that is part of the request — Atelier does not replace that provider with a scheduling product.",
    action: "Begin a custom app brief"
  },
  ecommerce_storefronts: {
    title: "E-commerce & storefronts",
    short: "Online commerce",
    summary:
      "A storefront that presents products or services for sale and can connect to the commerce tools you already use. Payments are not collected in Atelier.",
    action: "Explore a storefront direction"
  },
  digital_infrastructure: {
    title: "Digital infrastructure",
    short: "Integrations & workflows",
    summary:
      "Practical connections between the site, the tools already in use, and the workflows that keep work moving. This is reviewed as a fit, not sold as a packaged CRM or proprietary platform.",
    action: "Open a brief to discuss this"
  },
  undecided: {
    title: "Not sure yet",
    short: "Begin with the idea",
    summary: "Start with what you know. Aethelios can help organize it; Neil decides what can be accepted.",
    action: "Begin a brief"
  }
};

export function isVisibleProjectType(value: string): value is VisibleProjectType {
  return (VISIBLE_PROJECT_TYPES as readonly string[]).includes(value);
}

export function canonicalProjectType(value: string | null | undefined): VisibleProjectType | null {
  if (!value) return null;
  if (isVisibleProjectType(value)) return value;
  return PROJECT_TYPE_COMPATIBILITY[value] ?? null;
}

export function displayProjectTypeLabel(value: string): string {
  const canonical = canonicalProjectType(value);
  if (canonical) return SERVICE_CATEGORY_COPY[canonical].title;
  return value;
}

export function historicalProjectTypeNote(value: string): string | null {
  if (value !== HISTORICAL_BOOKING_PROJECT_TYPE) return null;
  return "This brief was saved as a booking-connected website. That category is now listed as Custom apps & platforms. Linking an existing booking tool remains an example within it — it is not a replacement booking engine. The saved type is unchanged until you choose a category.";
}

export function asksBookingProvider(
  projectType: string,
  context?: { bookingNeeded?: boolean | null } | null
): boolean {
  if (context?.bookingNeeded === true) return true;
  if (context?.bookingNeeded === false) return false;
  return projectType === HISTORICAL_BOOKING_PROJECT_TYPE;
}

export function serviceInterestToStoredProjectType(interest: string): ProjectType | null {
  if (interest === "unspecified") return null;
  if (interest === HISTORICAL_BOOKING_PROJECT_TYPE) return HISTORICAL_BOOKING_PROJECT_TYPE;
  if (isVisibleProjectType(interest) && interest !== "undecided") return interest;
  return null;
}

export function normalizeIncomingServiceInterest(
  value: string | null
):
  | "unspecified"
  | "website"
  | "custom_apps_platforms"
  | "ecommerce_storefronts"
  | "digital_infrastructure"
  | "booking_connected_website"
  | null {
  if (!value) return null;
  if (value === HISTORICAL_BOOKING_PROJECT_TYPE) return HISTORICAL_BOOKING_PROJECT_TYPE;
  if (
    value === "website" ||
    value === "custom_apps_platforms" ||
    value === "ecommerce_storefronts" ||
    value === "digital_infrastructure" ||
    value === "unspecified"
  ) {
    return value;
  }
  return null;
}

export const COMMISSION_TYPE_OPTIONS: Array<{ id: ProjectType; label: string }> = [
  { id: "website", label: SERVICE_CATEGORY_COPY.website.title },
  { id: "custom_apps_platforms", label: SERVICE_CATEGORY_COPY.custom_apps_platforms.title },
  { id: "ecommerce_storefronts", label: SERVICE_CATEGORY_COPY.ecommerce_storefronts.title },
  { id: "digital_infrastructure", label: SERVICE_CATEGORY_COPY.digital_infrastructure.title },
  { id: "undecided", label: SERVICE_CATEGORY_COPY.undecided.title }
];

export function optionPressed(stored: string, optionId: ProjectType): boolean {
  return stored === optionId;
}
