import { LimitError } from "@/lib/domain/errors";
import { limitsForPlan } from "@/lib/cofounder/entitlements";
import { configuredLimitOverrides } from "@/lib/cofounder/usage";
import type { BusinessDocument, CompanionBlob, PlanId } from "@/lib/cofounder/types";

const TEXT_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/xml",
  "text/html"
]);

export function canExtractDocumentText(mime: string) {
  return TEXT_MIME.has(mime) || mime.startsWith("text/");
}

export function extractDocumentText(mime: string, bytes: Uint8Array): string | null {
  if (!canExtractDocumentText(mime)) return null;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.slice(0, 24_000);
}

export function documentExcerpt(text: string, query?: string, limit = 1800) {
  const cleaned = text.replace(/\u0000/g, "").trim();
  if (!query?.trim()) return cleaned.slice(0, limit);
  const haystack = cleaned.toLowerCase();
  const needle = query.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index < 0) return cleaned.slice(0, limit);
  const start = Math.max(0, index - 240);
  return cleaned.slice(start, start + limit);
}

export function assertDocumentQuota(input: {
  planId: PlanId;
  currentCount: number;
}) {
  const limit = limitsForPlan(input.planId, configuredLimitOverrides()).documents;
  if (input.currentCount >= limit) {
    throw new LimitError(
      "This workspace has reached its configured document limit. Delete a source document before uploading another."
    );
  }
}

export function selectedDocumentSources(documents: BusinessDocument[], selectedIds: string[]) {
  return documents.filter((doc) => selectedIds.includes(doc.id) && doc.status !== "deleted");
}

export function blobTextOrUnavailable(document: BusinessDocument, blob?: CompanionBlob | null) {
  if (!blob) {
    return {
      documentId: document.id,
      title: document.title,
      available: false as const,
      reason: "The file bytes are not stored for this document."
    };
  }
  const text = extractDocumentText(document.mime, blob.bytes);
  if (!text) {
    return {
      documentId: document.id,
      title: document.title,
      available: false as const,
      reason:
        "This file type is stored, but text extraction is only available for owner-uploaded text documents. Binary files are not treated as executable instructions."
    };
  }
  return {
    documentId: document.id,
    title: document.title,
    available: true as const,
    mime: document.mime,
    text
  };
}
