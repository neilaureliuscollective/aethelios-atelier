import { DomainError, LimitError } from "@/lib/domain/errors";
import { limitsForPlan } from "@/lib/cofounder/entitlements";
import { extractPdfPageTexts } from "@/lib/cofounder/pdfText";
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

/** Talk still uses this cap. Intake preview uses INTAKE_TEXT_CHAR_LIMIT. */
export const TALK_TEXT_CHAR_LIMIT = 24_000;
export const INTAKE_TEXT_CHAR_LIMIT = 200_000;
export const INTAKE_PAGE_CHAR_LIMIT = 20_000;
export const INTAKE_PAGE_LIMIT = 80;
export const DOCUMENT_UPLOAD_MAX_BYTES = 2_000_000;
export const TEXT_PART_TARGET = 12_000;

export type DocumentPage = {
  pageNumber: number;
  label: string;
  text: string;
  truncated: boolean;
};

export type ExtractedSource = {
  available: boolean;
  kind: "text" | "pdf_text" | "unavailable";
  pages: DocumentPage[];
  truncated: boolean;
  totalCharacters: number;
  reason?: string;
};

export function inferDocumentMime(mime: string, title: string) {
  const cleaned = mime.trim();
  if (cleaned && cleaned !== "application/octet-stream") return cleaned;
  const lower = title.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "text/markdown";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".xml")) return "application/xml";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
  if (lower.endsWith(".txt")) return "text/plain";
  return cleaned || "application/octet-stream";
}

export function isPdfMime(mime: string, title = "") {
  return mime === "application/pdf" || mime === "application/x-pdf" || title.toLowerCase().endsWith(".pdf");
}

export function canExtractDocumentText(mime: string) {
  return TEXT_MIME.has(mime) || mime.startsWith("text/");
}

export function canPreviewDocument(mime: string, title = "") {
  return canExtractDocumentText(mime) || isPdfMime(mime, title);
}

export function extractDocumentText(mime: string, bytes: Uint8Array): string | null {
  if (!canExtractDocumentText(mime)) return null;
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  return text.slice(0, TALK_TEXT_CHAR_LIMIT);
}

function splitTextParts(text: string) {
  const formFeed = text.split(/\f+/).map((part) => part.trim()).filter(Boolean);
  if (formFeed.length > 1) return formFeed.slice(0, INTAKE_PAGE_LIMIT);
  if (text.length <= TEXT_PART_TARGET) return [text];
  const parts: string[] = [];
  let remaining = text;
  while (remaining.length > 0 && parts.length < INTAKE_PAGE_LIMIT) {
    if (remaining.length <= TEXT_PART_TARGET) {
      parts.push(remaining);
      break;
    }
    const window = remaining.slice(0, TEXT_PART_TARGET);
    const breakAt = Math.max(window.lastIndexOf("\n\n"), window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const take = breakAt > TEXT_PART_TARGET * 0.6 ? breakAt : TEXT_PART_TARGET;
    parts.push(remaining.slice(0, take).trim());
    remaining = remaining.slice(take).trim();
  }
  return parts;
}

function toPages(kind: "text" | "pdf_text", texts: string[]): DocumentPage[] {
  return texts.slice(0, INTAKE_PAGE_LIMIT).map((raw, index) => {
    const truncated = raw.length > INTAKE_PAGE_CHAR_LIMIT;
    return {
      pageNumber: index + 1,
      label: kind === "pdf_text" ? `Page ${index + 1}` : texts.length > 1 ? `Part ${index + 1}` : "Document",
      text: raw.slice(0, INTAKE_PAGE_CHAR_LIMIT),
      truncated
    };
  });
}

export function extractDocumentPages(mime: string, bytes: Uint8Array, title = ""): ExtractedSource {
  if (isPdfMime(mime, title)) {
    const texts = extractPdfPageTexts(bytes);
    const pages = toPages("pdf_text", texts);
    const totalCharacters = pages.reduce((sum, page) => sum + page.text.length, 0);
    if (pages.length === 0 || totalCharacters === 0) {
      return {
        available: false,
        kind: "unavailable",
        pages: [],
        truncated: false,
        totalCharacters: 0,
        reason:
          "This PDF is stored, but Atelier could not read text from it. This version reads text-based PDFs. Scanned or image-only files are not extracted."
      };
    }
    const truncated = texts.length > INTAKE_PAGE_LIMIT || pages.some((page) => page.truncated);
    return { available: true, kind: "pdf_text", pages, truncated, totalCharacters };
  }

  if (!canExtractDocumentText(mime)) {
    return {
      available: false,
      kind: "unavailable",
      pages: [],
      truncated: false,
      totalCharacters: 0,
      reason:
        "This file type is stored, but text extraction is only available for text-based PDFs and existing text formats."
    };
  }

  const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/\u0000/g, "");
  const truncatedSource = decoded.length > INTAKE_TEXT_CHAR_LIMIT;
  const pages = toPages("text", splitTextParts(decoded.slice(0, INTAKE_TEXT_CHAR_LIMIT)));
  return {
    available: true,
    kind: "text",
    pages,
    truncated: truncatedSource || pages.some((page) => page.truncated),
    totalCharacters: pages.reduce((sum, page) => sum + page.text.length, 0)
  };
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
  const allowed = new Set(selectedIds);
  return documents.filter((doc) => allowed.has(doc.id) && doc.status !== "deleted");
}

export function assertSelectableSourceDocumentIds(documents: BusinessDocument[], selectedIds: string[]) {
  const liveIds = new Set(documents.filter((doc) => doc.status !== "deleted").map((doc) => doc.id));
  const unknown = [...new Set(selectedIds)].filter((id) => !liveIds.has(id));
  if (unknown.length > 0) {
    throw new DomainError(
      "Those files are not available as sources for this workspace.",
      "invalid_source_selection",
      400
    );
  }
  return [...new Set(selectedIds)];
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
  const pages = extractDocumentPages(document.mime, blob.bytes, document.title);
  if (pages.available) {
    return {
      documentId: document.id,
      title: document.title,
      available: true as const,
      mime: document.mime,
      text: pages.pages
        .map((page) => page.text)
        .join("\n\n")
        .slice(0, TALK_TEXT_CHAR_LIMIT)
    };
  }
  const text = extractDocumentText(document.mime, blob.bytes);
  if (!text) {
    return {
      documentId: document.id,
      title: document.title,
      available: false as const,
      reason:
        pages.reason ??
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
