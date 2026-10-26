import { BEGIN_HREF } from "@/lib/publicSite";
import {
  COMMERCE_FOUNDATION_OFFER_ID,
  COMMERCE_LAUNCH_OFFER_ID,
  isCommerceOfferId,
  type ServiceOfferId
} from "@/lib/offers/ids";
import type { BriefFieldKey } from "@/lib/types";

export const ATELIER_COMMERCE_PUBLIC_TITLE = "Atelier Commerce";

export const ATELIER_COMMERCE_CORE_MESSAGE =
  "Source a first assortment and launch a storefront the client owns — not an Atelier catalog.";

export const ATELIER_COMMERCE_HREF = "/services/commerce";

export const COMMERCE_FOUNDATION_BRIEF_HREF = BEGIN_HREF;

export const COMMERCE_LAUNCH_BRIEF_HREF = BEGIN_HREF;

export const ATELIER_COMMERCE_PUBLIC_TERMS =
  "Atelier Commerce is a founder-led commission. Neil confirms the exact proposal. Payments for the client's store are not collected in Atelier.";

export type CommerceStarterKey =
  | "vision"
  | "audience"
  | "existingWebsite"
  | "bookingProvider"
  | "goals"
  | "priorities"
  | "constraints";

export type CommerceOffer = {
  id: typeof COMMERCE_FOUNDATION_OFFER_ID | typeof COMMERCE_LAUNCH_OFFER_ID;
  title: string;
  short: string;
  kicker: string;
  summary: string;
  briefHref: string;
  pageHref: string;
  starter: Record<CommerceStarterKey, string>;
};

export const COMMERCE_FOUNDATION_OFFER: CommerceOffer = {
  id: COMMERCE_FOUNDATION_OFFER_ID,
  title: "Commerce Foundation",
  short: "Storefront",
  kicker: "You already know what you sell",
  summary:
    "A professional storefront on a platform the client owns, for a founder or business that already has products and suppliers. Atelier designs, configures, and prepares launch. The client remains the seller of record.",
  briefHref: COMMERCE_FOUNDATION_BRIEF_HREF,
  pageHref: ATELIER_COMMERCE_HREF,
  starter: {
    vision: "A professional storefront for products I already know I will sell, presented under my own brand.",
    audience: "",
    existingWebsite: "",
    bookingProvider: "",
    goals:
      "Present my products clearly, take payment on a platform I own, and launch with a bounded first assortment.",
    priorities:
      "Store architecture, product presentation, payments and shipping configuration, and a clean handoff. I will own the store account.",
    constraints:
      "Keep payments on my commerce platform. Do not collect charges inside Atelier. Do not promise sales, rankings, or a full catalog before the assortment exists."
  }
};

export const COMMERCE_LAUNCH_OFFER: CommerceOffer = {
  id: COMMERCE_LAUNCH_OFFER_ID,
  title: "Commerce Launch",
  short: "Source and launch",
  kicker: "You need help establishing what to sell",
  summary:
    "Research and white-label direction for a first assortment, then the same storefront work as Foundation. Atelier helps the client source and present products under the client's brand. Research is preliminary. It does not guarantee demand, profit, or supplier reliability.",
  briefHref: COMMERCE_LAUNCH_BRIEF_HREF,
  pageHref: ATELIER_COMMERCE_HREF,
  starter: {
    vision:
      "Help me source and white-label a first assortment, then build a storefront under my own brand.",
    audience: "",
    existingWebsite: "",
    bookingProvider: "",
    goals:
      "Research a first assortment, shortlist suppliers I can evaluate, and prepare a storefront for my brand — not an Atelier catalog.",
    priorities:
      "Category direction, supplier comparison, assortment architecture, then a bounded storefront. I decide what to sell.",
    constraints:
      "Research is preliminary. Identifying a supplier is not verification, demand, or profit. I remain the seller of record. Do not promise a full catalog."
  }
};

export const ATELIER_COMMERCE_OFFERS = [COMMERCE_FOUNDATION_OFFER, COMMERCE_LAUNCH_OFFER] as const;

export const COMMERCE_FIELD_LABELS: Record<BriefFieldKey, string> = {
  vision: "Project vision",
  projectType: "Project type",
  audience: "Who you want to sell to",
  existingWebsite: "Existing website or store",
  bookingProvider: "Products, suppliers, and commerce tools today",
  goals: "What this commission should make possible",
  references: "Brand assets, photography, and references",
  priorities: "What must be true first",
  timing: "Timing",
  budget: "Budget (optional)",
  constraints: "What must stay unchanged, and what must not be promised"
};

export const COMMERCE_FIELD_HINTS: Record<BriefFieldKey, string> = {
  vision: "What would you like this storefront project to make possible?",
  projectType: "This offer is an e-commerce storefront commission. You can still change the type.",
  audience: "Who should buy, and what should feel considered about the offer. Unknown is fine.",
  existingWebsite: "A current site or store, if there is one. Leave blank if there is not.",
  bookingProvider:
    "Do you already have products, suppliers, or a Shopify or WooCommerce account? Unknown is fine.",
  goals: "A storefront you already know you need, help sourcing a first assortment, or both.",
  references: "Logo, colors, type, photography, and anything that must not be assumed.",
  priorities: "What must be true for a first launch, and what can wait until products exist.",
  timing: "Is there a real window, or is timing still to confirm?",
  budget: "Optional. Leave blank if you would rather discuss this with Neil.",
  constraints: "Ownership, platforms, categories to avoid, and anything that must not be promised."
};

export const COMMERCE_SITUATIONS = [
  {
    title: "You already know what you sell",
    body: "Products and suppliers are established. Atelier builds and launches the storefront.",
    path: "Foundation"
  },
  {
    title: "You need help deciding what to sell",
    body: "Atelier researches a first assortment and supplier options, then prepares the store under your brand.",
    path: "Launch"
  },
  {
    title: "You have products, but no suppliers",
    body: "Begin with Foundation and a supplier shortlist, or with Launch if the assortment itself is still open.",
    path: "Either, after review"
  }
] as const;

export const COMMERCE_BENEFITS = [
  {
    title: "Your brand, not ours",
    body: "The store, the account, and the assortment belong to the client. Atelier does not sell a product catalog."
  },
  {
    title: "Sourcing when it is needed",
    body: "Launch can research categories and shortlist suppliers. Foundation never forces that work on a client who already knows the offer."
  },
  {
    title: "A bounded first assortment",
    body: "A first set of products is configured when those products exist. A full catalog is not invented to fill the page."
  },
  {
    title: "The client remains the seller",
    body: "Payments, inventory, claims, and fulfilment stay with the client and the chosen commerce platform."
  }
] as const;

export const COMMERCE_COMPARISON = [
  {
    id: "client",
    label: "This is for",
    foundation: "A founder or business that already knows what it sells",
    launch: "A founder who still needs product and supplier direction"
  },
  {
    id: "work",
    label: "Atelier's work",
    foundation: "Store architecture, design, configuration, launch, and handoff",
    launch: "The Foundation store, plus research and a supplier shortlist"
  },
  {
    id: "client-owns",
    label: "The client owns",
    foundation: "Products, suppliers, inventory, claims, and the store account",
    launch: "The same, plus every product and supplier decision"
  },
  {
    id: "catalog",
    label: "Catalog",
    foundation: "A bounded first assortment the client already has",
    launch: "A first assortment after the client approves research — not a finished catalog"
  },
  {
    id: "not-promised",
    label: "Not promised",
    foundation: "Sales, rankings, or unlimited catalog operations",
    launch: "Demand, profit, or that a shortlisted supplier is reliable"
  }
] as const;

export const COMMERCE_LAUNCH_STEPS = [
  {
    title: "Lock the brief",
    body: "Category, price band, constraints, and claims that must not be made."
  },
  {
    title: "Write the opportunity",
    body: "A memo on demand signals, competitors, and positioning risks — not a sales forecast."
  },
  {
    title: "Shortlist products and suppliers",
    body: "Scored options with go / no-go notes, then two or three supplier candidates the client can evaluate."
  },
  {
    title: "Client decision",
    body: "Nothing is merchandised until the client chooses. Samples, if any, are client-funded."
  },
  {
    title: "Build the store",
    body: "The same Foundation storefront, under the client's brand, for the approved first assortment."
  }
] as const;

export const COMMERCE_FOUNDATION_INCLUDES = [
  "Discovery and a written store architecture",
  "UX and UI on an agreed theme or section scope",
  "A responsive storefront on Shopify or WooCommerce when that is the fit",
  "Configuration of a bounded first assortment the client already has",
  "Payments, shipping, tax, and essential policy setup on the client's platform",
  "One or two named integrations confirmed in the proposal",
  "Foundational SEO and an analytics property",
  "Purchase-flow review, launch preparation, and a short handoff"
] as const;

export const COMMERCE_FOUNDATION_EXCLUDES = [
  "Payment collection inside Atelier",
  "A full product catalog invented before products exist",
  "Photography, identity, or copy unless separately scoped",
  "Guaranteed sales, rankings, or conversion rates",
  "Unlimited catalog operations or a standing merchandising subscription"
] as const;

export const COMMERCE_LAUNCH_INCLUDES = [
  "Everything in Commerce Foundation",
  "Customer and category discovery as a written memo",
  "Competitor and positioning notes, including claim risks",
  "A scored product shortlist with go / no-go language",
  "Two or three supplier candidates per approved item, with a comparison sheet",
  "Assortment and product-page architecture for the first approved set"
] as const;

export const COMMERCE_LAUNCH_EXCLUDES = [
  "A guarantee that a product will sell or a supplier can be trusted",
  "Factory audits, laboratory testing, or legal clearance",
  "Purchase orders, inventory, warehousing, or fulfilment",
  "An Atelier-owned catalog or white-label store sold as Atelier's products",
  "Unlimited research rounds after the agreed memo"
] as const;

export const COMMERCE_FAQ = [
  {
    id: "division",
    question: "Is this a separate company?",
    answer:
      "No. Atelier Commerce is a division of Aethelios Atelier. Neil reviews every commission. It is not a second brand and not a fourth published plan."
  },
  {
    id: "catalog",
    question: "Will Atelier supply a catalog of products?",
    answer:
      "No. Atelier does not sell a product catalog. Launch can help source and white-label a first assortment under the client's brand. A fuller catalog is configured later, when those products exist."
  },
  {
    id: "foundation-vs-launch",
    question: "Do I have to buy product research?",
    answer:
      "No. Commerce Foundation is for clients who already know what they sell. Commerce Launch adds research and supplier discovery only when that work is needed."
  },
  {
    id: "suppliers",
    question: "If you find a supplier, is that supplier verified?",
    answer:
      "No. A shortlist is preliminary research. Marketplace badges, quotes, and conversation notes are not verification. The client chooses, pays for samples, and remains the seller of record."
  },
  {
    id: "sales",
    question: "Do you guarantee sales or profit?",
    answer:
      "No. Atelier does not claim conversion rates, demand, or revenue outcomes. The work is to prepare a professional store and, when scoped, a considered first assortment."
  },
  {
    id: "ownership",
    question: "Who owns the store and the products?",
    answer:
      "The client. The commerce platform account, products, suppliers, and customer payments stay with the client. Atelier is granted access to build, then hands the work over."
  },
  {
    id: "payments",
    question: "Does Atelier take store payments?",
    answer:
      "No. Payments for the client's store are collected on the chosen commerce platform. Atelier does not operate checkout for that store."
  },
  {
    id: "price",
    question: "What does it cost?",
    answer: ATELIER_COMMERCE_PUBLIC_TERMS
  }
] as const;

export function commerceOfferById(id: string | undefined | null) {
  if (id === COMMERCE_FOUNDATION_OFFER.id) return COMMERCE_FOUNDATION_OFFER;
  if (id === COMMERCE_LAUNCH_OFFER.id) return COMMERCE_LAUNCH_OFFER;
  return undefined;
}

export function displayCommerceOfferLabel(id: string | undefined | null) {
  return commerceOfferById(id)?.title ?? "";
}

export function isCommerceOffer(brief: { context?: { offerId?: string } | undefined } | null | undefined) {
  return isCommerceOfferId(brief?.context?.offerId);
}

export function isCommerceOfferIdValue(value: string | undefined | null): value is ServiceOfferId {
  return isCommerceOfferId(value);
}
