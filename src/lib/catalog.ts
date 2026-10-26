import type { ServiceOffer } from "@/lib/types";
import { SERVICE_CATEGORY_COPY, canonicalProjectType } from "@/lib/serviceCategories";

export const SERVICE_CATALOG: {
  version: 1;
  source: "approved_local_catalog";
  pricingStatus: "not_finalized";
  primaryOfferId: "custom_apps_platforms";
  offers: ServiceOffer[];
} = {
  version: 1,
  source: "approved_local_catalog",
  pricingStatus: "not_finalized",
  primaryOfferId: "custom_apps_platforms",
  offers: [
    {
      id: "website",
      status: "offered",
      title: SERVICE_CATEGORY_COPY.website.title,
      summary: SERVICE_CATEGORY_COPY.website.summary,
      includes: [
        "Strategy conversation and written brief",
        "Founder review of scope before work is accepted",
        "A branded marketing website shaped around the business",
        "Identity treated as a consistent quality of the work"
      ],
      excludes: [
        "A mandatory rebrand as part of every website",
        "Unlimited custom work",
        "Autonomous website generation",
        "A subscription product from Aethelios"
      ]
    },
    {
      id: "custom_apps_platforms",
      status: "offered",
      title: SERVICE_CATEGORY_COPY.custom_apps_platforms.title,
      summary: SERVICE_CATEGORY_COPY.custom_apps_platforms.summary,
      includes: [
        "Purpose-built web tools or portals reviewed by Neil",
        "Installable web-app presentation when it is a fit",
        "A booking-provider link only when that is part of the request"
      ],
      excludes: [
        "Building a replacement booking engine or CRM product",
        "Calendar synchronization as a scheduling product",
        "Taking appointment payments inside Atelier",
        "Unlimited custom work"
      ]
    },
    {
      id: "ecommerce_storefronts",
      status: "offered",
      title: SERVICE_CATEGORY_COPY.ecommerce_storefronts.title,
      summary: SERVICE_CATEGORY_COPY.ecommerce_storefronts.summary,
      includes: [
        "A storefront that presents products or services clearly",
        "A path into the commerce tools already in use",
        "Founder review of catalog and fulfilment assumptions"
      ],
      excludes: [
        "Payment collection inside Atelier",
        "A claim of conversion rates or revenue outcomes",
        "Unlimited catalog operations as a subscription"
      ]
    },
    {
      id: "digital_infrastructure",
      status: "exploratory",
      title: SERVICE_CATEGORY_COPY.digital_infrastructure.title,
      summary: SERVICE_CATEGORY_COPY.digital_infrastructure.summary,
      includes: ["A founder conversation about operational needs and the tools already in place"],
      excludes: [
        "A finished proprietary platform or CRM",
        "A claim that every niche is already supported",
        "Immediate delivery without review"
      ]
    },
    {
      id: "undecided",
      status: "offered",
      title: SERVICE_CATEGORY_COPY.undecided.title,
      summary: SERVICE_CATEGORY_COPY.undecided.summary,
      includes: ["A guided brief with no obligation to buy"],
      excludes: ["A commitment to a specific package before review"]
    }
  ]
};

export function offerById(id: string) {
  const canonical = canonicalProjectType(id) ?? id;
  return SERVICE_CATALOG.offers.find((offer) => offer.id === canonical);
}

export const AURELIUS_FACTS = [
  "Aethelios Atelier is founder-led by Neil Stutes.",
  "Aethelios is the in-app intelligence for Aethelios Atelier. It does not accept work, set price, or bind timing. Aurelius is Neil’s separate personal assistant and is not this guide.",
  "Atelier is business-first: Neil personally helps businesses create and elevate websites, brands, applications, and digital infrastructure.",
  "Owners can talk their business through with Aethelios and send Neil the direction without an account or a subscription.",
  "Commission paths currently discussed are branded websites, custom apps and platforms, e-commerce storefronts, and digital infrastructure.",
  "Other custom digital projects — professional workflow tools, study tools, and personal utilities — can be requested through the same commission path when the work is a fit. They do not replace business clients as the central audience.",
  "Custom apps and platforms may later point to a booking tool the client already uses, when that is part of the request. Atelier does not become that booking product.",
  "A focused website offer for barbers and salons can present one location and point to the booking provider already in use. It is not a booking product.",
  "Atelier Commerce is a focused e-commerce division inside Aethelios Atelier. It can help a founder source a first assortment and launch a storefront the client owns. It is not a second company and not an Atelier product catalog. Commerce Foundation is for clients who already know what they sell. Commerce Launch adds preliminary research and supplier discovery. Neil confirms every proposal. Payments for the client's store are not collected in Atelier.",
  "Branding is a quality of the work and can also be scoped as its own commission. A rebrand is not required to begin, and a functional tool does not require a new brand.",
  "A smaller project means a smaller complete scope, not lower quality or unlimited work at a discount.",
  "Every engagement is priced to its scope. There are no subscription plans or published package prices. Neil quotes each build, and any ongoing care, in a written proposal after he reviews the brief.",
  "Never state, estimate, or guess a price, range, or timeline. If asked, explain that Neil scopes and prices each project personally once he has the brief.",
  "Payments are not collected on this site. Neil confirms every proposal.",
  "Sending a brief is a request. Neil accepts work only after he reviews it.",
  "Private founder notes and internal prices never belong in client-visible replies."
];
