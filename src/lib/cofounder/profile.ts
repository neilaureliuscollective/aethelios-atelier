import { parseBrandKit } from "@/lib/cofounder/brandKit";
import {
  DOCUMENT_CANDIDATE_STATUSES,
  PROFILE_FIELD_KEYS,
  SOURCE_STATUSES,
  type ApprovedRate,
  type BusinessProfile,
  type DocumentFactCandidate,
  type ProfileField,
  type ProfileFieldKey,
  type SourceStatus
} from "@/lib/cofounder/types";

export function emptyProfile(businessId: string, updatedAt: string): BusinessProfile {
  const fields = Object.fromEntries(
    PROFILE_FIELD_KEYS.map((key) => [
      key,
      {
        key,
        value: "",
        kind: "confirmed"
      } satisfies ProfileField
    ])
  ) as Record<ProfileFieldKey, ProfileField>;
  return {
    businessId,
    fields,
    approvedRates: [],
    brandAssets: [],
    sourceDocumentIds: [],
    documentCandidates: [],
    updatedAt
  };
}

export function normalizeProfile(input: Partial<BusinessProfile> & { businessId: string }): BusinessProfile {
  const base = emptyProfile(input.businessId, input.updatedAt ?? new Date().toISOString());
  for (const key of PROFILE_FIELD_KEYS) {
    const incoming = input.fields?.[key];
    if (!incoming) continue;
    base.fields[key] = {
      key,
      value: typeof incoming.value === "string" ? incoming.value.slice(0, 4000) : "",
      kind: incoming.kind === "preference" || incoming.kind === "suggestion" ? incoming.kind : "confirmed",
      source: incoming.source,
      updatedAt: incoming.updatedAt,
      sourceDocumentId: typeof incoming.sourceDocumentId === "string" ? incoming.sourceDocumentId : undefined,
      sourcePage: typeof incoming.sourcePage === "number" && Number.isInteger(incoming.sourcePage) ? incoming.sourcePage : undefined,
      sourceExcerpt: typeof incoming.sourceExcerpt === "string" ? incoming.sourceExcerpt.slice(0, 400) : undefined,
      sourceStatus: isSourceStatus(incoming.sourceStatus) ? incoming.sourceStatus : undefined
    };
  }
  base.approvedRates = (input.approvedRates ?? []).filter(isApprovedRate);
  base.brandAssets = input.brandAssets ?? [];
  base.sourceDocumentIds = [...new Set(input.sourceDocumentIds ?? [])];
  base.documentCandidates = normalizeCandidates(input.documentCandidates);
  base.updatedBy = input.updatedBy;
  base.brandKit = parseBrandKit(input.brandKit) ?? undefined;
  return base;
}

export function confirmedFacts(profile: BusinessProfile) {
  return Object.values(profile.fields)
    .filter((field) => field.kind === "confirmed" && field.value.trim())
    .map((field) => ({
      key: field.key,
      value: field.value,
      source: field.source ?? "owner",
      updatedAt: field.updatedAt,
      sourceDocumentId: field.sourceDocumentId,
      sourcePage: field.sourcePage,
      sourceStatus: field.sourceStatus
    }));
}

export function preferences(profile: BusinessProfile) {
  return Object.values(profile.fields).filter((field) => field.kind === "preference" && field.value.trim());
}

export function pendingDocumentCandidates(profile: BusinessProfile) {
  return profile.documentCandidates.filter((candidate) => candidate.status === "pending");
}

function isSourceStatus(value: unknown): value is SourceStatus {
  return SOURCE_STATUSES.includes(value as SourceStatus);
}

function normalizeCandidates(input?: DocumentFactCandidate[]) {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item.id !== "string" || typeof item.documentId !== "string") return [];
    if (!PROFILE_FIELD_KEYS.includes(item.fieldKey)) return [];
    if (!DOCUMENT_CANDIDATE_STATUSES.includes(item.status)) return [];
    return [
      {
        id: item.id,
        documentId: item.documentId,
        documentTitle: typeof item.documentTitle === "string" ? item.documentTitle : "",
        fieldKey: item.fieldKey,
        fieldLabel: typeof item.fieldLabel === "string" ? item.fieldLabel : item.fieldKey,
        proposedValue: typeof item.proposedValue === "string" ? item.proposedValue.slice(0, 4000) : "",
        excerpt: typeof item.excerpt === "string" ? item.excerpt.slice(0, 1800) : "",
        pageNumber: Number.isInteger(item.pageNumber) ? item.pageNumber : 1,
        pageLabel: typeof item.pageLabel === "string" ? item.pageLabel : `page ${item.pageNumber}`,
        provenance: typeof item.provenance === "string" ? item.provenance : "",
        status: item.status,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
        resolvedAt: typeof item.resolvedAt === "string" ? item.resolvedAt : undefined,
        resolvedBy: typeof item.resolvedBy === "string" ? item.resolvedBy : undefined,
        ownerEdited: item.ownerEdited === true,
        conflict: item.conflict
          ? {
              currentValue: item.conflict.currentValue,
              currentSource: item.conflict.currentSource
            }
          : undefined
      } satisfies DocumentFactCandidate
    ];
  });
}

function isApprovedRate(value: ApprovedRate): value is ApprovedRate {
  return (
    Boolean(value?.id) &&
    typeof value.label === "string" &&
    Number.isInteger(value.amountCents) &&
    value.amountCents >= 0 &&
    (value.unit === "each" || value.unit === "hour" || value.unit === "project")
  );
}
