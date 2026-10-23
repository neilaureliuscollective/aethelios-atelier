import "server-only";
import { z } from "zod";
import { INQUIRY_CONSENT_TEXT } from "@/lib/copy";
import { ForbiddenError, InquiryDeliveryError, LimitError, UnconfiguredError } from "@/lib/domain/errors";
import { createId, createReceiptId } from "@/lib/ids";
import { resolveInquiryDelivery } from "@/lib/inquiry/destination";
import { inquiryRateLimited } from "@/lib/inquiry/rateLimit";
import { sendInquiryEmail } from "@/lib/inquiry/send";
import { buildMailtoHref, INQUIRY_LIMITS } from "@/lib/inquiry/summary";
import type { InquiryAccepted, InquiryUnavailable, StoredInquiry } from "@/lib/inquiry/types";
import { extractBusinessSketch, sketchLabel } from "./extract";
import { conciergeHistorySchema, presentationDraftSchema } from "./schema";

const handoffSchema = z.object({
  name: z.string().trim().min(1).max(INQUIRY_LIMITS.name),
  email: z.string().trim().email().max(INQUIRY_LIMITS.email),
  sessionId: z.string().min(8).max(80),
  messages: z.array(conciergeHistorySchema).min(1).max(24),
  document: presentationDraftSchema.optional(),
  previewGenerated: z.boolean().optional().default(false),
  honeypot: z.string().max(INQUIRY_LIMITS.honey).optional().default("")
});

export type ConciergeHandoffInput = z.infer<typeof handoffSchema>;

const acceptedBySession = new Map<string, InquiryAccepted>();

export function resetConciergeHandoffForTests() {
  acceptedBySession.clear();
}

export function parseConciergeHandoff(raw: unknown): ConciergeHandoffInput {
  return handoffSchema.parse(raw);
}

export function formatHandoffDocument(input: ConciergeHandoffInput): string {
  const visitorLines = input.messages.filter((item) => item.role === "user").map((item) => item.content);
  const spoken = visitorLines.join("\n");
  const sketch = extractBusinessSketch(spoken || visitorLines[0] || "");
  const label = sketchLabel(sketch);
  const slides = input.document?.slides ?? [];
  const lines = [
    "Atelier conversation intake",
    "This is a request from a talk session. It is not a booking, quote, or payment.",
    "",
    `From: ${input.name} <${input.email}>`,
    `Session: ${input.sessionId}`,
    `Business: ${label}`,
    sketch.kind !== "unknown" ? `Kind: ${sketch.kind}` : "",
    sketch.place ? `Place: ${sketch.place}` : "",
    sketch.qualities.length ? `Qualities they asked for: ${sketch.qualities.join(", ")}` : "",
    "",
    input.document
      ? [
          "What they saw",
          `Canvas: ${input.document.title}`,
          `Thesis: ${input.document.thesis}`,
          ...slides.map((slide, index) => `${String(index + 1).padStart(2, "0")}. ${slide.kicker ?? slide.layout} — ${slide.headline ?? ""}`.trim()),
          `Illustrative site preview: ${input.previewGenerated ? "yes" : "no"}`
        ].join("\n")
      : "What they saw: no canvas was opened.",
    "",
    "Visitor transcript",
    ...input.messages.map((item) => `${item.role === "user" ? "Visitor" : "Aethelios"}: ${item.content}`),
    "",
    INQUIRY_CONSENT_TEXT
  ];
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n").trim();
}

function needFrom(input: ConciergeHandoffInput) {
  const first = input.messages.find((item) => item.role === "user")?.content.trim() ?? "Talk session";
  return first.slice(0, INQUIRY_LIMITS.need);
}

export async function submitConciergeHandoff(
  raw: unknown,
  options: { clientKey?: string } = {}
): Promise<InquiryAccepted | InquiryUnavailable> {
  const input = parseConciergeHandoff(raw);
  if (input.honeypot?.trim()) {
    throw new ForbiddenError("This conversation could not be sent.");
  }
  if (options.clientKey && inquiryRateLimited(options.clientKey)) {
    throw new LimitError("Too many conversations were sent from this connection. Try again later.");
  }
  const prior = acceptedBySession.get(input.sessionId);
  if (prior) return prior;

  const resolved = resolveInquiryDelivery();
  const sketch = extractBusinessSketch(
    input.messages
      .filter((item) => item.role === "user")
      .map((item) => item.content)
      .join("\n")
  );
  const text = formatHandoffDocument(input);
  const inquiry: StoredInquiry = {
    id: createId("inq"),
    receiptId: createReceiptId(),
    createdAt: new Date().toISOString(),
    name: input.name,
    email: input.email,
    business: sketchLabel(sketch),
    need: needFrom(input),
    source: "concierge",
    briefTitle: input.document?.title,
    delivery: resolved.delivery === "capture" ? "capture" : "email"
  };

  if (resolved.delivery === "email") {
    try {
      await sendInquiryEmail(inquiry, text, resolved.destination);
    } catch (error) {
      return {
        ok: false,
        error: "delivery_failed",
        message:
          error instanceof InquiryDeliveryError
            ? error.message
            : "Resend could not send this conversation. You can still open the mail app.",
        mailto: buildMailtoHref(resolved.destination, {
          subject: `Atelier conversation from ${input.name}`,
          body: text
        })
      };
    }
    const accepted: InquiryAccepted = {
      ok: true,
      submitted: true,
      delivery: "email",
      receiptId: inquiry.receiptId,
      inquiryId: inquiry.id,
      labeled: false,
      note: "This conversation was sent to Neil for review. It is a request, not a booking or payment."
    };
    acceptedBySession.set(input.sessionId, accepted);
    return accepted;
  }

  if (resolved.delivery === "mailto") {
    return {
      ok: false,
      error: "unconfigured",
      message: resolved.missing ?? "This site cannot send the conversation directly yet.",
      mailto: buildMailtoHref(resolved.destination, {
        subject: `Atelier conversation from ${input.name}`,
        body: text
      })
    };
  }

  throw new UnconfiguredError(
    resolved.missing ?? "Conversations cannot be delivered from this site yet."
  );
}
