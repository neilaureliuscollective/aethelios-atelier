import { ConflictError, DomainError } from "@/lib/domain/errors";
import { normalizeProfile } from "@/lib/cofounder/profile";
import { type DocumentPage, type ExtractedSource } from "@/lib/cofounder/documents";
import {
  PROFILE_FIELD_KEYS,
  type BusinessDocument,
  type BusinessProfile,
  type DocumentFactCandidate
} from "@/lib/cofounder/types";

export const INTAKE_FIELD_KEYS = ["services", "products", "audience", "tone", "brandNotes"] as const;
export type IntakeFieldKey = (typeof INTAKE_FIELD_KEYS)[number];

export const INTAKE_FIELD_LABELS: Record<IntakeFieldKey, string> = {
  services: "Services",
  products: "Products",
  audience: "Audience",
  tone: "Brand voice",
  brandNotes: "Brand notes"
};

export const OWNER_CONFIRMED_FROM_DOCUMENT = "owner_confirmed_from_document";
export const OWNER_EDITED_FROM_DOCUMENT = "owner_edited_from_document";
export const INTAKE_VALUE_LIMIT = 4000;
export const INTAKE_EXCERPT_LIMIT = 1800;

export const INTAKE_BOUNDARY_NOTE =
  "Talk and other Aethelios tools can only read files you select as sources. Confirming a fact saves it with a page reference. Unconfirmed excerpts stay pending and are not trusted context.";

export function isIntakeFieldKey(value: string): value is IntakeFieldKey {
  return (INTAKE_FIELD_KEYS as readonly string[]).includes(value);
}

export function pageCitation(pageNumber: number) {
  return `page ${pageNumber}`;
}

export function formatDocumentProvenance(input: {
  title: string;
  pageNumber: number;
  ownerEdited?: boolean;
}) {
  const prefix = input.ownerEdited ? OWNER_EDITED_FROM_DOCUMENT : OWNER_CONFIRMED_FROM_DOCUMENT;
  return `${prefix} · ${input.title} · ${pageCitation(input.pageNumber)}`;
}

export function normalizeComparable(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function excerptAppearsOnPage(pageText: string, excerpt: string) {
  const needle = normalizeComparable(excerpt);
  if (!needle) return false;
  return normalizeComparable(pageText).includes(needle);
}

export function isGroundedInExcerpt(proposedValue: string, excerpt: string) {
  const proposed = normalizeComparable(proposedValue);
  const source = normalizeComparable(excerpt);
  if (!proposed || !source) return false;
  return source.includes(proposed);
}

export function findPage(pages: DocumentPage[], pageNumber: number) {
  return pages.find((page) => page.pageNumber === pageNumber);
}

export type IntakeDraft = {
  documentId: string;
  title: string;
  fieldKey: IntakeFieldKey;
  fieldLabel: string;
  pageNumber: number;
  pageLabel: string;
  excerpt: string;
  currentValue: string;
  proposedValue: string;
  proposedTruncated: boolean;
  provenance: string;
  grounded: boolean;
  requiresOwnerEdit: boolean;
  conflict?: {
    currentValue: string;
    currentSource?: string;
  };
};

export function draftIntakeChange(input: {
  document: Pick<BusinessDocument, "id" | "title">;
  profile: BusinessProfile;
  extracted: ExtractedSource;
  fieldKey: string;
  pageNumber: number;
  excerpt: string;
  proposedValue?: string;
}): IntakeDraft {
  if (!isIntakeFieldKey(input.fieldKey)) {
    throw new DomainError("Choose services, products, audience, brand voice, or brand notes.", "invalid_intake", 400);
  }
  if (!input.extracted.available) {
    throw new DomainError(input.extracted.reason ?? "This document has no extractable text.", "invalid_intake", 400);
  }
  const page = findPage(input.extracted.pages, input.pageNumber);
  if (!page) {
    throw new DomainError("That page is not in the source preview.", "invalid_intake", 400);
  }
  const excerpt = input.excerpt.replace(/\u0000/g, "").trim();
  if (excerpt.length < 8) {
    throw new DomainError("Select a longer excerpt from the source before reviewing a change.", "invalid_intake", 400);
  }
  if (!excerptAppearsOnPage(page.text, excerpt)) {
    throw new DomainError("The selected excerpt does not appear on the cited page.", "invalid_intake", 400);
  }
  const proposedRaw = (input.proposedValue ?? excerpt).replace(/\u0000/g, "").trim();
  if (!proposedRaw) {
    throw new DomainError("Enter the information you want to save.", "invalid_intake", 400);
  }
  const proposedValue = proposedRaw.slice(0, INTAKE_VALUE_LIMIT);
  const current = input.profile.fields[input.fieldKey];
  const currentValue = current?.value ?? "";
  const grounded = isGroundedInExcerpt(proposedValue, excerpt);
  const hasConflict = Boolean(
    current?.kind === "confirmed" &&
      currentValue.trim() &&
      normalizeComparable(currentValue) !== normalizeComparable(proposedValue)
  );
  return {
    documentId: input.document.id,
    title: input.document.title,
    fieldKey: input.fieldKey,
    fieldLabel: INTAKE_FIELD_LABELS[input.fieldKey],
    pageNumber: page.pageNumber,
    pageLabel: page.label,
    excerpt: excerpt.slice(0, INTAKE_EXCERPT_LIMIT),
    currentValue,
    proposedValue,
    proposedTruncated: proposedRaw.length > INTAKE_VALUE_LIMIT,
    provenance: formatDocumentProvenance({ title: input.document.title, pageNumber: page.pageNumber }),
    grounded,
    requiresOwnerEdit: !grounded,
    conflict: hasConflict
      ? { currentValue, currentSource: current?.source }
      : undefined
  };
}

export function candidateFromDraft(
  draft: IntakeDraft,
  input: { id: string; createdAt: string; status?: DocumentFactCandidate["status"] }
): DocumentFactCandidate {
  return {
    id: input.id,
    documentId: draft.documentId,
    documentTitle: draft.title,
    fieldKey: draft.fieldKey,
    fieldLabel: draft.fieldLabel,
    proposedValue: draft.proposedValue,
    excerpt: draft.excerpt,
    pageNumber: draft.pageNumber,
    pageLabel: draft.pageLabel,
    provenance: draft.provenance,
    status: input.status ?? "pending",
    createdAt: input.createdAt,
    ownerEdited: draft.requiresOwnerEdit,
    conflict: draft.conflict
  };
}

export function upsertDocumentCandidate(profile: BusinessProfile, candidate: DocumentFactCandidate) {
  const rest = profile.documentCandidates.filter((item) => item.id !== candidate.id);
  return normalizeProfile({
    ...profile,
    documentCandidates: [candidate, ...rest]
  });
}

export function applyConfirmedIntake(
  profile: BusinessProfile,
  draft: IntakeDraft,
  updatedBy: string,
  options: {
    updatedAt?: string;
    ownerEdited?: boolean;
    selectSource?: boolean;
    conflictResolution?: "replace" | "keep";
    candidate?: DocumentFactCandidate;
  } = {}
) {
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const ownerEdited = options.ownerEdited === true || draft.requiresOwnerEdit;
  if (draft.requiresOwnerEdit && options.ownerEdited !== true) {
    throw new DomainError(
      "The proposed value is not in the cited excerpt. Mark it as an owner edit to save your wording.",
      "ungrounded_intake",
      400
    );
  }
  if (draft.conflict && !options.conflictResolution) {
    throw new ConflictError(
      "This field already has a different confirmed value. Choose replace or keep the current fact."
    );
  }

  const candidates = profile.documentCandidates.map((item) =>
    options.candidate && item.id === options.candidate.id
      ? {
          ...item,
          proposedValue: draft.proposedValue,
          excerpt: draft.excerpt,
          ownerEdited,
          status: (options.conflictResolution === "keep" ? "rejected" : ownerEdited ? "edited" : "confirmed") as DocumentFactCandidate["status"],
          resolvedAt: updatedAt,
          resolvedBy: updatedBy
        }
      : item
  );

  if (options.conflictResolution === "keep") {
    return {
      profile: normalizeProfile({
        ...profile,
        documentCandidates: options.candidate ? candidates : profile.documentCandidates,
        updatedAt,
        updatedBy
      }),
      confirmation: {
        fieldKey: draft.fieldKey,
        fieldLabel: draft.fieldLabel,
        previousValue: draft.currentValue,
        value: profile.fields[draft.fieldKey].value,
        source: profile.fields[draft.fieldKey].source,
        sourceDocumentId: profile.fields[draft.fieldKey].sourceDocumentId,
        sourcePage: profile.fields[draft.fieldKey].sourcePage,
        sourceExcerpt: profile.fields[draft.fieldKey].sourceExcerpt,
        keptExisting: true as const
      }
    };
  }

  const sourceDocumentIds =
    options.selectSource === false || profile.sourceDocumentIds.includes(draft.documentId)
      ? profile.sourceDocumentIds
      : [...profile.sourceDocumentIds, draft.documentId];
  const next = normalizeProfile({
    ...profile,
    fields: {
      ...profile.fields,
      [draft.fieldKey]: {
        key: draft.fieldKey,
        value: draft.proposedValue,
        kind: "confirmed",
        source: formatDocumentProvenance({
          title: draft.title,
          pageNumber: draft.pageNumber,
          ownerEdited
        }),
        updatedAt,
        sourceDocumentId: draft.documentId,
        sourcePage: draft.pageNumber,
        sourceExcerpt: draft.excerpt,
        sourceStatus: sourceDocumentIds.includes(draft.documentId) ? "live" : "deselected"
      }
    },
    sourceDocumentIds,
    documentCandidates: options.candidate ? candidates : profile.documentCandidates,
    updatedAt,
    updatedBy
  });
  return {
    profile: next,
    confirmation: {
      fieldKey: draft.fieldKey,
      fieldLabel: draft.fieldLabel,
      previousValue: draft.currentValue,
      value: next.fields[draft.fieldKey].value,
      source: next.fields[draft.fieldKey].source,
      sourceDocumentId: next.fields[draft.fieldKey].sourceDocumentId,
      sourcePage: next.fields[draft.fieldKey].sourcePage,
      sourceExcerpt: next.fields[draft.fieldKey].sourceExcerpt,
      keptExisting: false as const
    }
  };
}

export function rejectDocumentCandidatesForSource(
  profile: BusinessProfile,
  documentId: string,
  resolvedBy: string,
  resolvedAt = new Date().toISOString()
) {
  return normalizeProfile({
    ...profile,
    documentCandidates: profile.documentCandidates.map((candidate) =>
      candidate.documentId === documentId && candidate.status === "pending"
        ? { ...candidate, status: "rejected", resolvedAt, resolvedBy }
        : candidate
    )
  });
}

export function refreshFieldSourceStatuses(
  profile: BusinessProfile,
  liveDocumentIds: Set<string>,
  selectedIds: Set<string>
) {
  const fields = { ...profile.fields };
  for (const key of PROFILE_FIELD_KEYS) {
    const field = fields[key];
    if (!field.sourceDocumentId) continue;
    let sourceStatus = field.sourceStatus;
    if (!liveDocumentIds.has(field.sourceDocumentId)) sourceStatus = "stale";
    else if (!selectedIds.has(field.sourceDocumentId)) sourceStatus = "deselected";
    else sourceStatus = "live";
    fields[key] = { ...field, sourceStatus };
  }
  return normalizeProfile({
    ...profile,
    fields,
    sourceDocumentIds: [...selectedIds]
  });
}

export function intakeFieldKeys() {
  return INTAKE_FIELD_KEYS.filter((key) => PROFILE_FIELD_KEYS.includes(key));
}
