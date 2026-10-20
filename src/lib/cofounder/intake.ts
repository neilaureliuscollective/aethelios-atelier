import { DomainError } from "@/lib/domain/errors";
import { normalizeProfile } from "@/lib/cofounder/profile";
import {
  type ExtractedSource,
  type DocumentPage
} from "@/lib/cofounder/documents";
import {
  PROFILE_FIELD_KEYS,
  type BusinessDocument,
  type BusinessProfile
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
export const INTAKE_VALUE_LIMIT = 4000;
export const INTAKE_EXCERPT_LIMIT = 1800;

export const INTAKE_BOUNDARY_NOTE =
  "Confirming a fact saves it to this business profile with a page reference. This does not hide the file from later Aethelios tools.";

export function isIntakeFieldKey(value: string): value is IntakeFieldKey {
  return (INTAKE_FIELD_KEYS as readonly string[]).includes(value);
}

export function pageCitation(pageNumber: number) {
  return `page ${pageNumber}`;
}

export function formatDocumentProvenance(input: { title: string; pageNumber: number }) {
  return `${OWNER_CONFIRMED_FROM_DOCUMENT} · ${input.title} · ${pageCitation(input.pageNumber)}`;
}

export function normalizeComparable(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function excerptAppearsOnPage(pageText: string, excerpt: string) {
  const needle = normalizeComparable(excerpt);
  if (!needle) return false;
  return normalizeComparable(pageText).includes(needle);
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
  return {
    documentId: input.document.id,
    title: input.document.title,
    fieldKey: input.fieldKey,
    fieldLabel: INTAKE_FIELD_LABELS[input.fieldKey],
    pageNumber: page.pageNumber,
    pageLabel: page.label,
    excerpt: excerpt.slice(0, INTAKE_EXCERPT_LIMIT),
    currentValue: input.profile.fields[input.fieldKey]?.value ?? "",
    proposedValue,
    proposedTruncated: proposedRaw.length > INTAKE_VALUE_LIMIT,
    provenance: formatDocumentProvenance({ title: input.document.title, pageNumber: page.pageNumber })
  };
}

export function applyConfirmedIntake(
  profile: BusinessProfile,
  draft: IntakeDraft,
  updatedBy: string,
  updatedAt = new Date().toISOString()
) {
  const sourceDocumentIds = profile.sourceDocumentIds.includes(draft.documentId)
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
        source: draft.provenance,
        updatedAt,
        sourceDocumentId: draft.documentId,
        sourcePage: draft.pageNumber,
        sourceExcerpt: draft.excerpt
      }
    },
    sourceDocumentIds,
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
      sourceExcerpt: next.fields[draft.fieldKey].sourceExcerpt
    }
  };
}

export function intakeFieldKeys() {
  return INTAKE_FIELD_KEYS.filter((key) => PROFILE_FIELD_KEYS.includes(key));
}
