import { offerById } from "@/lib/catalog";
import { isFunctionalPurpose } from "@/lib/commissionContext";
import { ForbiddenError } from "@/lib/domain/errors";
import { asksBookingProvider, canonicalProjectType } from "@/lib/serviceCategories";
import type {
  Brief,
  DeliveryVersion,
  Proposal,
  ProposalPrice,
  ProposalScope,
  ProposalStatus
} from "@/lib/types";

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}_${value.length}`;
}

export const DEFAULT_PRICE_TERMS =
  "Founder-set for this proposal version. Not a charge, invoice, or collected payment.";

const CLIENT_VISIBLE_PROPOSAL: ProposalStatus[] = [
  "published",
  "superseded",
  "changes_requested",
  "approved"
];

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function emptyProposalScope(): ProposalScope {
  return {
    summary: "",
    deliverables: [],
    includedPages: [],
    includedFeatures: [],
    exclusions: [],
    clientResponsibilities: [],
    milestones: [],
    price: {
      amount: "",
      currency: "USD",
      terms: DEFAULT_PRICE_TERMS,
      paymentStatus: "not_collected"
    },
    brandDirection: ""
  };
}

export function normalizePrice(input: unknown): ProposalPrice {
  const record = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  return {
    amount: asString(record.amount).trim(),
    currency: "USD",
    terms: asString(record.terms, DEFAULT_PRICE_TERMS).trim() || DEFAULT_PRICE_TERMS,
    paymentStatus: "not_collected"
  };
}

export function normalizeProposalScope(input: unknown): ProposalScope {
  const empty = emptyProposalScope();
  if (!input || typeof input !== "object") return empty;
  const record = input as Record<string, unknown>;
  const milestones = Array.isArray(record.milestones)
    ? record.milestones
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          const title = asString(row.title).trim();
          if (!title) return null;
          return {
            title,
            description: asString(row.description).trim(),
            timing: asString(row.timing).trim() || undefined
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  return {
    summary: asString(record.summary).trim(),
    deliverables: asStringList(record.deliverables),
    includedPages: asStringList(record.includedPages),
    includedFeatures: asStringList(record.includedFeatures),
    exclusions: asStringList(record.exclusions),
    clientResponsibilities: asStringList(record.clientResponsibilities),
    milestones,
    price: normalizePrice(record.price),
    brandDirection: asString(record.brandDirection).trim()
  };
}

export type ProposalSeedKind =
  | "website"
  | "commerce"
  | "booking_site"
  | "business_tool"
  | "professional_tool"
  | "study"
  | "personal"
  | "infrastructure"
  | "undecided";

export function proposalSeedKind(brief: Brief): ProposalSeedKind {
  if (asksBookingProvider(brief.projectType.value, brief.context)) return "booking_site";
  const purpose = brief.context?.purpose;
  if (purpose === "study") return "study";
  if (purpose === "personal") return "personal";
  if (purpose === "professional_workflow") return "professional_tool";
  const type = canonicalProjectType(brief.projectType.value) ?? brief.projectType.value;
  if (type === "website") return "website";
  if (type === "ecommerce_storefronts") return "commerce";
  if (type === "digital_infrastructure") return "infrastructure";
  if (type === "custom_apps_platforms") return "business_tool";
  if (isFunctionalPurpose(purpose)) return "professional_tool";
  return "undecided";
}

function seedByKind(kind: ProposalSeedKind, offerIncludes: string[], offerExcludes: string[]): Omit<
  ProposalScope,
  "summary" | "price" | "brandDirection"
> {
  const review = "Review each published version and either request changes or record agreement to that exact version.";
  const commonExclusions = [
    ...offerExcludes,
    "Unlimited revisions or support as a standing promise",
    "Autonomous generation or an Aethelios subscription product"
  ];
  switch (kind) {
    case "website":
      return {
        deliverables: offerIncludes.length
          ? offerIncludes
          : [
              "A branded marketing website shaped around the business",
              "Identity treated as a consistent quality of the work"
            ],
        includedPages: ["Home", "About", "Contact"],
        includedFeatures: ["Public customer journey", "Clear enquiry path"],
        exclusions: commonExclusions,
        clientResponsibilities: [
          "Provide brand materials, copy, and photographs when requested.",
          review
        ],
        milestones: websiteMilestones()
      };
    case "commerce":
      return {
        deliverables: offerIncludes,
        includedPages: ["Home", "Collection", "Product", "Contact"],
        includedFeatures: ["Storefront presentation", "Path into existing commerce tools"],
        exclusions: commonExclusions,
        clientResponsibilities: [
          "Provide product facts, images, and the commerce tools already in use.",
          review
        ],
        milestones: websiteMilestones()
      };
    case "booking_site":
      return {
        deliverables: offerIncludes,
        includedPages: ["Home", "About", "Booking destination", "Contact"],
        includedFeatures: ["Link to the booking provider already in use"],
        exclusions: commonExclusions,
        clientResponsibilities: [
          "Provide brand materials, copy, and photographs when requested.",
          "Confirm the live booking destination if this site should link to one.",
          review
        ],
        milestones: websiteMilestones()
      };
    case "business_tool":
    case "professional_tool":
      return {
        deliverables: [
          "A bounded first version of the requested workflow",
          "Documented actions, roles if needed, and data assumptions",
          "Founder review of integration boundaries before work is accepted"
        ],
        includedPages: [],
        includedFeatures: [
          "Essential actions for the first version",
          "Inputs and outputs the tool must handle",
          "Stated assumptions about existing tools and permissions"
        ],
        exclusions: [
          ...commonExclusions,
          "A replacement booking engine or CRM product",
          "Automatic access to employer or third-party systems"
        ],
        clientResponsibilities: [
          "Describe the current process and who should be able to see what.",
          "Name existing tools only if they are already used — Atelier will not invent connections.",
          review
        ],
        milestones: toolMilestones()
      };
    case "study":
      return {
        deliverables: [
          "A bounded study organizer for the requested subject",
          "Ways to keep topics, practice misses, and a simple review together"
        ],
        includedPages: [],
        includedFeatures: [
          "Topic organization",
          "Practice or error log",
          "A simple review interaction"
        ],
        exclusions: [
          ...commonExclusions,
          "A live tutoring service or school-system integration",
          "A claim of grades, outcomes, or completed learning"
        ],
        clientResponsibilities: [
          "Share the topics or materials that should appear in a first version.",
          "Say what “reviewed” means for you.",
          review
        ],
        milestones: toolMilestones()
      };
    case "personal":
      return {
        deliverables: [
          "A bounded personal utility for the stated outcome",
          "The controls needed to add, update, and close items"
        ],
        includedPages: [],
        includedFeatures: ["A useful first version limited to the requested tracker or organizer"],
        exclusions: [
          ...commonExclusions,
          "Health, finance, or legal advice",
          "Connected accounts that were not requested"
        ],
        clientResponsibilities: [
          "Say what should stay private and what a finished first version looks like.",
          review
        ],
        milestones: toolMilestones()
      };
    case "infrastructure":
      return {
        deliverables: offerIncludes.length
          ? offerIncludes
          : ["A founder conversation about operational needs and the tools already in place"],
        includedPages: [],
        includedFeatures: ["Documented integration assumptions", "Reviewed fit — not a packaged platform"],
        exclusions: commonExclusions,
        clientResponsibilities: [
          "Name the tools already in use and the workflow that should connect them.",
          review
        ],
        milestones: toolMilestones()
      };
    default:
      return {
        deliverables: offerIncludes.length ? offerIncludes : ["A guided brief with no obligation to buy"],
        includedPages: [],
        includedFeatures: [],
        exclusions: commonExclusions,
        clientResponsibilities: [review],
        milestones: [
          {
            title: "Confirm scope",
            description: "Agree the proposal version that will be delivered.",
            timing: "Before work begins"
          }
        ]
      };
  }
}

function websiteMilestones() {
  return [
    {
      title: "Confirm scope",
      description: "Agree the proposal version that will be delivered.",
      timing: "Before design begins"
    },
    {
      title: "Assemble client content",
      description: "Collect remaining brand, copy, and destination details.",
      timing: "Before the first design review"
    },
    {
      title: "Design review",
      description: "Present a design version for feedback or approval.",
      timing: "After scope is confirmed"
    },
    {
      title: "Build review",
      description: "Present a build version for feedback or approval.",
      timing: "After design is approved"
    }
  ];
}

function toolMilestones() {
  return [
    {
      title: "Confirm scope",
      description: "Agree the proposal version that will be delivered.",
      timing: "Before work begins"
    },
    {
      title: "Assemble needed inputs",
      description: "Collect sample workflows, roles, and any existing-tool facts that were requested.",
      timing: "Before the first working review"
    },
    {
      title: "Working review",
      description: "Present a working version for feedback or approval.",
      timing: "After scope is confirmed"
    },
    {
      title: "Handover",
      description: "Review the completed first version against the agreed proposal.",
      timing: "After the working version is approved"
    }
  ];
}

export function seedProposalScope(brief: Brief): ProposalScope {
  const offer = offerById(brief.projectType.value) ?? offerById("undecided");
  const kind = proposalSeedKind(brief);
  const seeded = seedByKind(kind, offer?.includes ?? [], offer?.excludes ?? []);
  return {
    summary: brief.vision.value.trim(),
    ...seeded,
    price: {
      amount: "",
      currency: "USD",
      terms: DEFAULT_PRICE_TERMS,
      paymentStatus: "not_collected"
    },
    brandDirection: needsBrandDirection(kind)
      ? [brief.references.value, brief.priorities.value]
          .map((value) => value.trim())
          .filter(Boolean)
          .join("\n\n")
      : brief.priorities.value.trim()
  };
}

function needsBrandDirection(kind: ProposalSeedKind) {
  return kind === "website" || kind === "commerce" || kind === "booking_site";
}

export function proposalFingerprint(scope: ProposalScope, version: number, changeSummary: string) {
  return fingerprint(
    JSON.stringify({
      version,
      changeSummary: changeSummary.trim(),
      scope: normalizeProposalScope(scope)
    })
  );
}

export function deliveryFingerprint(input: {
  kind: string;
  version: number;
  title: string;
  summary: string;
  previewUrl?: string;
  notes: string;
}) {
  return fingerprint(
    JSON.stringify({
      kind: input.kind,
      version: input.version,
      title: input.title.trim(),
      summary: input.summary.trim(),
      previewUrl: input.previewUrl?.trim() ?? "",
      notes: input.notes.trim()
    })
  );
}

export function assertPublishableScope(scope: ProposalScope) {
  const normalized = normalizeProposalScope(scope);
  if (!normalized.summary) {
    throw new ForbiddenError("A published proposal needs a written summary of the work.");
  }
  if (!normalized.deliverables.length) {
    throw new ForbiddenError("A published proposal needs at least one deliverable.");
  }
  if (!normalized.exclusions.length) {
    throw new ForbiddenError("A published proposal needs at least one exclusion so the edge of the work is explicit.");
  }
  if (!normalized.price.amount) {
    throw new ForbiddenError("Set a founder price before publishing. This is not a collected payment.");
  }
  if (normalized.price.paymentStatus !== "not_collected") {
    throw new ForbiddenError("Payments are not collected in Atelier. Leave the price labeled as not collected.");
  }
  return normalized;
}

export function isClientVisibleProposal(proposal: Proposal) {
  return CLIENT_VISIBLE_PROPOSAL.includes(proposal.status);
}

export function isClientVisibleDelivery(version: DeliveryVersion) {
  return version.status !== "draft";
}

export function latestOf<T extends { version: number }>(items: T[]) {
  return items.reduce<T | null>((latest, item) => {
    if (!latest || item.version > latest.version) return item;
    return latest;
  }, null);
}

export function currentClientProposal(proposals: Proposal[]) {
  const visible = proposals.filter(isClientVisibleProposal);
  const awaiting = visible.filter(
    (item) => item.status === "published" || item.status === "changes_requested"
  );
  return latestOf(awaiting) ?? latestOf(visible);
}

export function confirmedProposal(proposals: Proposal[]) {
  return latestOf(proposals.filter((item) => item.status === "approved"));
}

export function currentDeliveryReview(versions: DeliveryVersion[]) {
  const visible = versions.filter(isClientVisibleDelivery);
  const awaiting = visible.filter(
    (item) => item.status === "awaiting_review" || item.status === "changes_requested"
  );
  return latestOf(awaiting);
}
