import { confirmedFacts, preferences } from "@/lib/cofounder/profile";
import type {
  AuthorizedBusinessContext,
  BusinessDocument,
  BusinessProfile,
  CompanionMessage
} from "@/lib/cofounder/types";

const FORBIDDEN_CONTEXT_MARKERS = [
  "private_note",
  "internal_proposal",
  "founderNotes",
  "privateNotes",
  "internal price",
  "internal_price"
];

export function clientSafeProfile(profile: BusinessProfile) {
  return {
    confirmed: confirmedFacts(profile),
    preferences: preferences(profile).map((field) => ({
      key: field.key,
      value: field.value,
      source: field.source ?? "owner_preference",
      updatedAt: field.updatedAt
    })),
    approvedRates: profile.approvedRates.map((rate) => ({
      id: rate.id,
      label: rate.label,
      unit: rate.unit,
      amountCents: rate.amountCents,
      currency: rate.currency,
      source: rate.source,
      updatedAt: rate.updatedAt
    })),
    brandAssets: profile.brandAssets,
    sourceDocumentIds: profile.sourceDocumentIds
  };
}

export function clientSafeDocuments(documents: BusinessDocument[]) {
  return documents
    .filter((doc) => doc.status !== "deleted")
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      status: doc.status,
      source: doc.source,
      createdAt: doc.createdAt
    }));
}

export function buildAuthorizedModelContext(input: {
  context: AuthorizedBusinessContext;
  history: CompanionMessage[];
  extra?: Record<string, unknown>;
}) {
  const payload = {
    businessId: input.context.business.id,
    businessName: input.context.business.name,
    membershipRole: input.context.membership.role,
    profile: clientSafeProfile(input.context.profile),
    documents: clientSafeDocuments(input.context.documents),
    projects: input.context.projects,
    pendingMemory: input.context.memoryPending.map((item) => ({
      id: item.id,
      fieldKey: item.fieldKey,
      proposedValue: item.proposedValue,
      status: item.status
    })),
    extra: input.extra ?? {},
    history: input.history.slice(-16).map((item) => ({
      role: item.authorKind,
      body: item.body,
      liveAi: item.liveAi
    }))
  };
  const serialized = JSON.stringify(payload);
  for (const marker of FORBIDDEN_CONTEXT_MARKERS) {
    if (serialized.toLowerCase().includes(marker.toLowerCase())) {
      throw new Error("Refusing to send private founder material into client AI context.");
    }
  }
  return payload;
}

export function looksLikeCrossTenantProbe(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("other client") ||
    text.includes("other customer's") ||
    text.includes("founder note") ||
    text.includes("internal price") ||
    text.includes("show me every business") ||
    text.includes("ignore previous") ||
    text.includes("dump the database")
  );
}
