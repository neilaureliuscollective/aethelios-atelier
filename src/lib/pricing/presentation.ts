import "server-only";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { billingBoundary } from "@/lib/billing/boundary";
import { SERVICE_CATEGORY_COPY, serviceBriefHref, type VisibleProjectType } from "@/lib/serviceCategories";
import { planDiscussionHref } from "@/lib/pricing/context";
import {
  QUOTED_SETUP_LABEL,
  TERMS_UNAVAILABLE_LABEL,
  formatMonthlyCharge,
  formatSetupCharge,
  isPublishableUsdAmount
} from "@/lib/pricing/format";
import { PLAN_IDS, PLAN_LABELS, type PlanId } from "@/lib/pricing/ids";
import { resolvePricingMode } from "@/lib/pricing/review";
import {
  PRICING_PUBLICATION_STATUS,
  STARTING_COMMERCIAL_TERMS,
  type StartingCommercialTerms,
  type StartingPlanTerms
} from "@/lib/pricing/terms";

export type PricingMode = "public" | "local_review";

export type ChargeKind = "amount" | "quoted" | "discuss" | "unavailable";

export type ChargePresentation = {
  kind: ChargeKind;
  label: string;
  formatted: string;
  amountUsd: number | null;
};

export type PlanPresentation = {
  id: PlanId;
  name: string;
  relationship: string;
  setup: ChargePresentation;
  recurring: ChargePresentation;
  action: {
    href: string;
    label: "Discuss this plan";
  };
  founderDecisions: string[];
};

export type CommissionId = Exclude<VisibleProjectType, "undecided">;

export type CommissionPresentation = {
  id: CommissionId;
  title: string;
  summary: string;
  status: "offered" | "exploratory";
  href: string;
  action: string;
};

export type ComparisonRow = {
  id: string;
  label: string;
  values: Record<PlanId, string>;
  founderDecision?: boolean;
};

export type PricingFaq = {
  id: string;
  question: string;
  answer: string;
};

export type PricingPresentation = {
  publicationStatus: typeof PRICING_PUBLICATION_STATUS;
  mode: PricingMode;
  reviewBanner: string | null;
  billingEnabled: false;
  paymentCollected: false;
  plans: PlanPresentation[];
  commissions: CommissionPresentation[];
  comparison: ComparisonRow[];
  founderChecklist: string[];
  faq: PricingFaq[];
};

const PLAN_RELATIONSHIP: Record<PlanId, string> = {
  atelier:
    "The starting monthly relationship around your private commission workspace and founder-led support. It is not the main Aethelios product.",
  connected:
    "A closer monthly cadence. The listed prices are published; what Connected adds beyond Atelier is confirmed in a proposal.",
  partnership:
    "The closest operating relationship, including founder review of larger changes. Setup is quoted for the specific engagement."
};

const LOCAL_FOUNDER_DECISIONS: Record<PlanId, string[]> = {
  atelier: [
    "Workspace and service inclusions for Atelier are still confirmed by Neil.",
    "Usage budgets are not sold as purchased quotas.",
    "Voice, live AI, and integrations that are not offered yet must not be sold as included."
  ],
  connected: [
    "What Connected adds beyond Atelier is not published as an inclusion list.",
    "Do not advertise higher Talk, image, or voice budgets as purchased allowances.",
    "Do not imply more websites, coding, revisions, or integrations than Neil has confirmed."
  ],
  partnership: [
    "Partnership setup remains quoted until Neil writes a specific figure.",
    "Founder review of larger changes is a relationship note, not unlimited revisions.",
    "Minimum commitments, cancellation, tax treatment, and billing start dates are not approved."
  ]
};

const COMMISSION_ORDER: CommissionId[] = [
  "website",
  "custom_apps_platforms",
  "ecommerce_storefronts",
  "digital_infrastructure"
];

function quotedCharge(): ChargePresentation {
  return { kind: "quoted", label: QUOTED_SETUP_LABEL, formatted: QUOTED_SETUP_LABEL, amountUsd: null };
}

function unavailableCharge(): ChargePresentation {
  return {
    kind: "unavailable",
    label: TERMS_UNAVAILABLE_LABEL,
    formatted: TERMS_UNAVAILABLE_LABEL,
    amountUsd: null
  };
}

function amountCharge(amountUsd: number, formatted: string, label: string): ChargePresentation {
  return { kind: "amount", label, formatted, amountUsd };
}

export function setupCharge(terms: StartingPlanTerms | null): ChargePresentation {
  if (!terms) return unavailableCharge();
  if (terms.setup === "quoted" || terms.setupUsd == null) return quotedCharge();
  if (!isPublishableUsdAmount(terms.setupUsd)) return unavailableCharge();
  return amountCharge(terms.setupUsd, formatSetupCharge(terms.setupUsd), "One-time setup");
}

export function recurringCharge(terms: StartingPlanTerms | null): ChargePresentation {
  if (!terms || !isPublishableUsdAmount(terms.monthlyUsd)) return unavailableCharge();
  return amountCharge(terms.monthlyUsd, formatMonthlyCharge(terms.monthlyUsd), "Ongoing");
}

function chargeComparison(plans: PlanPresentation[]): ComparisonRow[] {
  const byId = Object.fromEntries(plans.map((plan) => [plan.id, plan])) as Record<PlanId, PlanPresentation>;
  return [
    {
      id: "setup",
      label: "One-time setup",
      values: {
        atelier: byId.atelier.setup.formatted,
        connected: byId.connected.setup.formatted,
        partnership: byId.partnership.setup.formatted
      }
    },
    {
      id: "monthly",
      label: "Monthly service",
      values: {
        atelier: byId.atelier.recurring.formatted,
        connected: byId.connected.recurring.formatted,
        partnership: byId.partnership.recurring.formatted
      }
    }
  ];
}

function publicComparison(plans: PlanPresentation[]): ComparisonRow[] {
  return [
    ...chargeComparison(plans),
    {
      id: "explore",
      label: "Explore Discovery and write a brief",
      values: {
        atelier: "Open — no plan required",
        connected: "Open — no plan required",
        partnership: "Open — no plan required"
      }
    },
    {
      id: "commissions",
      label: "Founder-led commissions",
      values: {
        atelier: "Scoped and priced separately",
        connected: "Scoped and priced separately",
        partnership: "Scoped and priced separately"
      }
    },
    {
      id: "branding",
      label: "A rebrand to begin",
      values: {
        atelier: "Not required",
        connected: "Not required",
        partnership: "Not required"
      }
    },
    {
      id: "unlimited",
      label: "Unlimited websites, coding, or revisions",
      values: {
        atelier: "Not included",
        connected: "Not included",
        partnership: "Not included"
      }
    },
    {
      id: "price",
      label: "Who confirms deliverables and remaining terms",
      values: {
        atelier: "Neil, in a written proposal",
        connected: "Neil, in a written proposal",
        partnership: "Neil, in a written proposal"
      }
    },
    {
      id: "payments",
      label: "Card details or checkout here",
      values: {
        atelier: "Not collected",
        connected: "Not collected",
        partnership: "Not collected"
      }
    },
    {
      id: "disabled",
      label: "Live AI, voice, or integrations as purchased extras",
      values: {
        atelier: "Not offered as available services",
        connected: "Not offered as available services",
        partnership: "Not offered as available services"
      }
    },
    {
      id: "difference",
      label: "Approved differences beyond the listed prices",
      values: {
        atelier: "Not published as a separate inclusion list",
        connected: "Not published as a separate inclusion list",
        partnership: "Quoted setup; remaining inclusions confirmed by Neil"
      }
    }
  ];
}

function localComparison(plans: PlanPresentation[]): ComparisonRow[] {
  return [
    ...publicComparison(plans),
    {
      id: "inclusions",
      label: "Published inclusions and limits",
      founderDecision: true,
      values: {
        atelier: "Not an approved inclusion list",
        connected: "Not an approved inclusion list",
        partnership: "Not an approved inclusion list"
      }
    }
  ];
}

function commissions(): CommissionPresentation[] {
  return COMMISSION_ORDER.map((id) => {
    const offer = SERVICE_CATALOG.offers.find((item) => item.id === id);
    const copy = SERVICE_CATEGORY_COPY[id];
    return {
      id,
      title: offer?.title ?? copy.title,
      summary: copy.summary,
      status: offer?.status === "exploratory" ? "exploratory" : "offered",
      href: serviceBriefHref(id),
      action: copy.action
    };
  });
}

function faq(): PricingFaq[] {
  return [
    {
      id: "subscription",
      question: "Do I need a monthly plan to explore or request work?",
      answer:
        "No. You can browse Discovery, begin a brief, or send an inquiry without an account or a subscription. Selecting a plan only carries a discussion note into the brief if you choose to keep it."
    },
    {
      id: "charges",
      question: "What do setup and monthly charges cover?",
      answer:
        "Setup is the one-time starting charge for that plan. Monthly is the ongoing Atelier relationship around the private commission workspace and founder-led support. Custom commissions are scoped and priced separately. A written proposal confirms deliverables and remaining terms before work begins."
    },
    {
      id: "branding",
      question: "Do I have to purchase a rebrand?",
      answer:
        "No. Branding can be commissioned on its own, or treated as a quality of the work. Clients do not have to buy a rebrand to begin."
    },
    {
      id: "unlimited",
      question: "Does a monthly plan include unlimited websites, coding, or AI?",
      answer:
        "No. Nothing here is an unlimited website, coding, revision, AI, or integration allowance. Live AI, voice, and integrations are not offered as available purchased services. Beyond the listed prices, differences between plans are confirmed by Neil."
    },
    {
      id: "confirm",
      question: "When are deliverables and remaining terms confirmed?",
      answer:
        "Neil reviews the brief and confirms deliverables, any remaining terms, and timing in a written proposal. The brief itself is a request, not a booking or payment."
    },
    {
      id: "payments",
      question: "Can I pay or start a subscription here?",
      answer:
        "No. Payments are not collected in Atelier. There is no checkout, card form, or activated billing. Displayed plan prices are not a collected charge."
    },
    {
      id: "workspace",
      question: "What is the private workspace?",
      answer:
        "You can send an inquiry or a brief without creating an account. Signed-in clients may later use Commissions to resume work and read founder responses. Business Studio is an optional signed-in workspace, not a product you must learn to hire the studio."
    },
    {
      id: "aethelios",
      question: "Is an Atelier plan the same as Aethelios?",
      answer:
        "No. Aethelios is the in-app guide for this studio. An Atelier plan is the monthly relationship around your private commission workspace and founder-led support. It is not the main Aethelios product, and selecting a plan here does not start a subscription."
    },
    {
      id: "third-party",
      question: "Are booking, commerce, or other third-party tools included?",
      answer:
        "Existing booking and commerce providers can remain the destination for appointments and payments. Atelier does not replace those products or collect those charges. Third-party costs sit outside these plan prices."
    }
  ];
}

const FOUNDER_CHECKLIST = [
  "Write the actual inclusion and exclusion lists for each plan — do not inherit companion usage budgets.",
  "Confirm tax treatment, billing commencement, minimum commitments, and cancellation in a later legal pass.",
  "Keep billing disabled until a separate, authorized payment implementation exists.",
  "Do not mark remaining commercial terms approved merely because prices are displayed.",
  "The Barbers & Salons focused offer still has an unapproved commercial proposal in src/lib/offers/barbersSalonsReview.ts. Do not publish those amounts until Neil approves them.",
  "Atelier Commerce still has an unapproved commercial proposal in src/lib/offers/commerceReview.ts. Do not publish those amounts until Neil approves them."
];

export function buildPricingPresentation(input?: {
  mode?: PricingMode;
  terms?: StartingCommercialTerms;
  env?: Record<string, string | undefined>;
}): PricingPresentation {
  const mode = input?.mode ?? resolvePricingMode(input?.env);
  const terms = input?.terms ?? STARTING_COMMERCIAL_TERMS;
  const plans = PLAN_IDS.map((id) => {
    const planTerms = terms.plans[id] ?? null;
    return {
      id,
      name: PLAN_LABELS[id],
      relationship: PLAN_RELATIONSHIP[id],
      setup: setupCharge(planTerms),
      recurring: recurringCharge(planTerms),
      action: {
        href: planDiscussionHref(id),
        label: "Discuss this plan" as const
      },
      founderDecisions: mode === "local_review" ? LOCAL_FOUNDER_DECISIONS[id] : []
    };
  });

  return {
    publicationStatus: PRICING_PUBLICATION_STATUS,
    mode,
    reviewBanner:
      mode === "local_review"
        ? "Isolated local review. These are the same public amounts. Remaining commercial terms are not marked finalized."
        : null,
    billingEnabled: false,
    paymentCollected: false,
    plans,
    commissions: commissions(),
    comparison: mode === "local_review" ? localComparison(plans) : publicComparison(plans),
    founderChecklist: mode === "local_review" ? FOUNDER_CHECKLIST : [],
    faq: faq()
  };
}

export function publicPricingFacts() {
  return {
    status: PRICING_PUBLICATION_STATUS,
    note: "Plan prices are shown in USD. Payments are not collected here. A written proposal confirms deliverables and remaining terms before work begins.",
    billing: {
      enabled: false as const,
      ready: false as const,
      message: billingBoundary.status().message
    }
  };
}

export function presentationContainsInternalBudgets(value: unknown): boolean {
  return /\b(?:80|160|240) talk\b|\b(?:20|40|60) images\b|\b(?:30|60|90) voice/i.test(JSON.stringify(value));
}
