import { AURELIUS_FACTS, SERVICE_CATALOG } from "@/lib/catalog";
import { SERVICE_CATEGORY_COPY, serviceBriefHref, type VisibleProjectType } from "@/lib/serviceCategories";
import { FIX_IT_SHOP } from "@/lib/work/fixItShop";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";

export const CONCIERGE_POSITIONING = {
  studio: "Aethelios Atelier",
  founder: "Neil Stutes",
  line: "Built for What’s Next.",
  nature:
    "A founder-led digital infrastructure and experience studio. It helps businesses build a stronger, more professional digital presence — websites, brand experience, custom applications, storefronts, and practical systems.",
  not:
    "Not a generic AI agency, not a template mill, and not a freelance marketplace competing primarily on price. Not the main Aethelios product, and not an autonomous website generator."
} as const;

export const CONCIERGE_PROCESS = [
  {
    title: "Understand the business",
    body: "A conversation or structured brief captures what the business does, who it serves, and what is not working. Nothing is sent until you review it."
  },
  {
    title: "Shape a living brief",
    body: "Suggestions stay pending until you accept them. You can also write the brief yourself."
  },
  {
    title: "Send a request",
    body: "An inquiry or brief is a request for Neil’s review — not a booking, quote, or payment."
  },
  {
    title: "Founder review",
    body: "Neil alone accepts work and confirms scope, timing, and investment. There is no implied acceptance from sending a request."
  }
] as const;

export const CONCIERGE_LIMITATIONS = [
  "Aethelios does not accept work, set price, bind timing, or speak for Neil.",
  "Payments are not collected in Atelier.",
  "Plan prices on the pricing page describe a studio relationship when they are shown. They are not a project quote and are labeled not finalized.",
  "Atelier does not become a booking engine, CRM product, or payment processor for the client.",
  "Digital infrastructure is exploratory: a fit conversation, not a packaged platform.",
  "Only verified public work may be cited. Labeled demonstrations on the site are not client results.",
  "No testimonials, conversion rates, delivery dates, or invented case studies."
] as const;

export const VERIFIED_WORK = [
  {
    id: FIX_IT_SHOP.id,
    title: FIX_IT_SHOP.title,
    summary: FIX_IT_SHOP.business,
    href: "/services/barbers-salons",
    liveHref: FIX_IT_SHOP.liveHref,
    note: `${FIX_IT_SHOP.distinction.real} ${FIX_IT_SHOP.distinction.illustrative} This is not a testimonial and does not claim business results.`
  }
] as const;

export const CONCIERGE_OUT_OF_SCOPE = [
  "Native App Store products sold as a packaged mobile app business",
  "Legal, accounting, or licensed professional advice",
  "SEO retainers, ads management, or social-media management as a product",
  "Replacing a client’s booking tool, CRM, or payment processor with an Atelier product",
  "Guaranteed rankings, revenue, or lead volume"
] as const;

export type ConciergeServiceCard = {
  id: VisibleProjectType;
  status: "offered" | "exploratory";
  title: string;
  summary: string;
  href: string;
  briefHref: string;
};

export function conciergeServices(): ConciergeServiceCard[] {
  return SERVICE_CATALOG.offers
    .filter((offer) => offer.id !== "undecided")
    .map((offer) => {
      const id = offer.id as Exclude<VisibleProjectType, "undecided">;
      return {
        id,
        status: offer.status,
        title: SERVICE_CATEGORY_COPY[id].title,
        summary: SERVICE_CATEGORY_COPY[id].summary,
        href: id === "website" || id === "ecommerce_storefronts" ? "/services" : "/services",
        briefHref: serviceBriefHref(id)
      };
    });
}

export function serviceForIntent(intent?: string): ConciergeServiceCard | undefined {
  const map: Record<string, VisibleProjectType> = {
    website: "website",
    presence: "website",
    application: "custom_apps_platforms",
    ecommerce: "ecommerce_storefronts",
    infrastructure: "digital_infrastructure"
  };
  const id = intent ? map[intent] : undefined;
  return conciergeServices().find((service) => service.id === id);
}

export function verifiedKnowledgePayload() {
  return {
    identity: {
      name: INTELLIGENCE_DISPLAY_NAME,
      studio: CONCIERGE_POSITIONING.studio,
      founder: CONCIERGE_POSITIONING.founder,
      line: CONCIERGE_POSITIONING.line
    },
    facts: AURELIUS_FACTS,
    positioning: CONCIERGE_POSITIONING,
    catalog: {
      pricingStatus: SERVICE_CATALOG.pricingStatus,
      offers: SERVICE_CATALOG.offers.map((offer) => ({
        id: offer.id,
        status: offer.status,
        title: offer.title,
        summary: offer.summary,
        includes: offer.includes,
        excludes: offer.excludes
      }))
    },
    process: CONCIERGE_PROCESS,
    verifiedWork: VERIFIED_WORK,
    limitations: CONCIERGE_LIMITATIONS,
    outOfScope: CONCIERGE_OUT_OF_SCOPE,
    routes: {
      services: "/services",
      approach: "/approach",
      about: "/about",
      pricing: "/pricing",
      discover: "/discover",
      project: "/project",
      inquire: "/inquire",
      customProjects: "/custom-projects",
      barbers: "/services/barbers-salons"
    }
  };
}
