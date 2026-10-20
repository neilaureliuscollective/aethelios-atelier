import "server-only";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { billingBoundary } from "@/lib/billing/boundary";
import { SERVICE_CATEGORY_COPY, type VisibleProjectType } from "@/lib/serviceCategories";
import { planDiscussionHref } from "@/lib/pricing/context";
import {
  PUBLIC_RECURRING_LABEL,
  PUBLIC_SETUP_LABEL,
  QUOTED_SETUP_LABEL,
  TERMS_UNAVAILABLE_LABEL,
  formatMonthlyCharge,
  formatSetupCharge,
  isFiniteUsdAmount
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
    "The starting ongoing relationship around the private workspace and founder-led digital work. Inclusions are not published until Neil finalizes terms.",
  connected:
    "A closer ongoing cadence across more of the work. Differentiation beyond the starting setup and monthly structure is still a founder decision.",
  partnership:
    "The closest operating relationship, including founder review of larger changes. Setup is scoped with Neil. Other inclusions remain unpublished."
};

const LOCAL_FOUNDER_DECISIONS: Record<PlanId, string[]> = {
  atelier: [
    "Which workspace and service inclusions belong on Atelier, if any, is still a founder decision.",
    "Operational usage budgets are not customer-facing purchased quotas.",
    "Voice, live AI, integrations, and publication capabilities that exist only as disabled code must not be sold as included."
  ],
  connected: [
    "What “Connected” adds beyond Atelier is not an approved public inclusion list.",
    "Do not advertise higher Talk, image, or voice budgets as purchased allowances.",
    "Do not imply more websites, coding, revisions, or integrations than Neil has confirmed."
  ],
  partnership: [
    "Partnership setup remains quoted until Neil writes a specific figure.",
    "“Founder-reviewed larger changes” is a relationship note, not an unlimited-revision promise.",
    "Minimum commitments, cancellation, tax treatment, and billing start dates are not approved."
  ]
};

const COMMISSION_ORDER: CommissionId[] = [
  "website",
  "custom_apps_platforms",
  "ecommerce_storefronts",
  "digital_infrastructure"
];

function discussCharge(label: string): ChargePresentation {
  return { kind: "discuss", label, formatted: label, amountUsd: null };
}

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

function setupCharge(mode: PricingMode, terms: StartingPlanTerms | null): ChargePresentation {
  if (mode === "public") return discussCharge(PUBLIC_SETUP_LABEL);
  if (!terms) return unavailableCharge();
  if (terms.setup === "quoted" || terms.setupUsd == null) return quotedCharge();
  if (!isFiniteUsdAmount(terms.setupUsd)) return unavailableCharge();
  return amountCharge(terms.setupUsd, formatSetupCharge(terms.setupUsd), "One-time setup");
}

function recurringCharge(mode: PricingMode, terms: StartingPlanTerms | null): ChargePresentation {
  if (mode === "public") return discussCharge(PUBLIC_RECURRING_LABEL);
  if (!terms || !isFiniteUsdAmount(terms.monthlyUsd)) return unavailableCharge();
  return amountCharge(terms.monthlyUsd, formatMonthlyCharge(terms.monthlyUsd), "Ongoing");
}

function publicComparison(): ComparisonRow[] {
  return [
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
        atelier: "Scoped separately after review",
        connected: "Scoped separately after review",
        partnership: "Scoped separately after review"
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
      label: "Who confirms price and timing",
      values: {
        atelier: "Neil, after review",
        connected: "Neil, after review",
        partnership: "Neil, after review"
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
    }
  ];
}

function localComparison(plans: PlanPresentation[]): ComparisonRow[] {
  const setup: ComparisonRow = {
    id: "setup",
    label: "Starting setup (draft, not finalized)",
    founderDecision: true,
    values: {
      atelier: plans.find((plan) => plan.id === "atelier")?.setup.formatted ?? TERMS_UNAVAILABLE_LABEL,
      connected: plans.find((plan) => plan.id === "connected")?.setup.formatted ?? TERMS_UNAVAILABLE_LABEL,
      partnership: plans.find((plan) => plan.id === "partnership")?.setup.formatted ?? TERMS_UNAVAILABLE_LABEL
    }
  };
  const monthly: ComparisonRow = {
    id: "monthly",
    label: "Starting monthly (draft, not finalized)",
    founderDecision: true,
    values: {
      atelier: plans.find((plan) => plan.id === "atelier")?.recurring.formatted ?? TERMS_UNAVAILABLE_LABEL,
      connected: plans.find((plan) => plan.id === "connected")?.recurring.formatted ?? TERMS_UNAVAILABLE_LABEL,
      partnership: plans.find((plan) => plan.id === "partnership")?.recurring.formatted ?? TERMS_UNAVAILABLE_LABEL
    }
  };
  const inclusions: ComparisonRow = {
    id: "inclusions",
    label: "Published inclusions and limits",
    founderDecision: true,
    values: {
      atelier: "Not approved — founder decision",
      connected: "Not approved — founder decision",
      partnership: "Not approved — founder decision"
    }
  };
  return [...publicComparison(), setup, monthly, inclusions];
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
      href: `/discover?interest=${id}`,
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
        "No. You can browse Discovery, begin a brief, and request a custom commission without a subscription. Selecting a plan only carries a discussion note into the brief if you choose to keep it."
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
        "No. Nothing here is an unlimited website, coding, revision, AI, or integration allowance. Live AI, voice, and integrations are not portrayed as available purchased services."
    },
    {
      id: "confirm",
      question: "When is a price actually confirmed?",
      answer:
        "Neil reviews the brief and confirms deliverables, price, and timing in a written proposal. The brief itself is a request, not a booking, quote, or payment."
    },
    {
      id: "payments",
      question: "Can I pay or start a subscription here?",
      answer:
        "No. Payments are not collected in Atelier. There is no checkout, card form, or activated billing. A founder-set proposal price stays labeled as not collected."
    },
    {
      id: "workspace",
      question: "What is the private workspace?",
      answer:
        "Signed-in clients use a private commission workspace to resume briefs, read founder responses, and review proposals. It is not a self-serve product studio and does not require a published plan to open a brief."
    },
    {
      id: "third-party",
      question: "Are booking, commerce, or other third-party tools included?",
      answer:
        "Existing booking and commerce providers can remain the destination for appointments and payments. Atelier does not replace those products or collect those charges. Third-party costs are outside this page’s unpublished terms."
    }
  ];
}

const FOUNDER_CHECKLIST = [
  "Approve or revise the starting setup and monthly amounts before any public publication.",
  "Write the actual inclusion and exclusion lists for each plan — do not inherit companion usage budgets.",
  "Decide whether Partnership setup stays quoted or receives a number.",
  "Confirm tax treatment, billing commencement, minimum commitments, and cancellation in a later legal pass.",
  "Keep billing disabled until a separate, authorized payment implementation exists.",
  "Do not mark these terms approved from this pricing-page work."
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
      setup: setupCharge(mode, planTerms),
      recurring: recurringCharge(mode, planTerms),
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
        ? "Draft pricing pending final terms. These starting amounts are for isolated local review only and are not published, billed, or approved."
        : null,
    billingEnabled: false,
    paymentCollected: false,
    plans,
    commissions: commissions(),
    comparison: mode === "local_review" ? localComparison(plans) : publicComparison(),
    founderChecklist: mode === "local_review" ? FOUNDER_CHECKLIST : [],
    faq: faq()
  };
}

export function publicPricingFacts() {
  return {
    status: PRICING_PUBLICATION_STATUS,
    note: "Pricing and commercial terms are not finalized. Estimates are nonbinding until Neil confirms a proposal.",
    billing: {
      enabled: false as const,
      ready: false as const,
      message: billingBoundary.status().message
    }
  };
}

export function presentationContainsUnapprovedAmounts(value: unknown): boolean {
  return /\b(?:249|299|399|499|699)\b/.test(JSON.stringify(value));
}
