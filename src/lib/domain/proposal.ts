import { offerById } from "@/lib/catalog";
import { ForbiddenError } from "@/lib/domain/errors";
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

export function seedProposalScope(brief: Brief): ProposalScope {
  const offer = offerById(brief.projectType.value) ?? offerById("undecided");
  const booking =
    brief.projectType.value === "booking_connected_website" ||
    brief.projectType.value === "custom_apps_platforms";
  return {
    summary: brief.vision.value.trim(),
    deliverables: offer?.includes ?? [],
    includedPages: booking
      ? ["Home", "About", "Booking destination", "Contact"]
      : ["Home", "About", "Contact"],
    includedFeatures: offer?.includes ?? [],
    exclusions: offer?.excludes ?? [],
    clientResponsibilities: [
      "Provide brand materials, copy, and photographs when requested.",
      "Confirm the live booking destination if this site should link to one.",
      "Review each published version and either request changes or record agreement to that exact version."
    ],
    milestones: [
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
    ],
    price: {
      amount: "",
      currency: "USD",
      terms: DEFAULT_PRICE_TERMS,
      paymentStatus: "not_collected"
    },
    brandDirection: [brief.references.value, brief.priorities.value]
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n\n")
  };
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
