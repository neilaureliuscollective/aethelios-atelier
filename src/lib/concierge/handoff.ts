import "server-only";
import { z } from "zod";
import { loadConfig } from "@/lib/config";
import { INQUIRY_CONSENT_TEXT } from "@/lib/copy";
import { ForbiddenError, InquiryDeliveryError, LimitError, UnconfiguredError } from "@/lib/domain/errors";
import { createId, createReceiptId } from "@/lib/ids";
import { appendInquiryLog, storeCapturedInquiry } from "@/lib/inquiry/capture";
import { resolveInquiryDelivery } from "@/lib/inquiry/destination";
import { inquiryRateLimited } from "@/lib/inquiry/rateLimit";
import { sendInquiryEmail, sendVisitorConfirmation } from "@/lib/inquiry/send";
import { buildMailtoHref, INQUIRY_LIMITS } from "@/lib/inquiry/summary";
import type { InquiryAccepted, InquiryUnavailable, StoredInquiry } from "@/lib/inquiry/types";
import { briefLines, discoveryBriefSchema } from "./brief";
import { extractBusinessSketch, sketchLabel } from "./extract";
import { conciergeHistorySchema, presentationDraftSchema } from "./schema";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

const handoffSchema = z.object({
  name: z.string().trim().min(1).max(INQUIRY_LIMITS.name),
  email: z.string().trim().email().max(INQUIRY_LIMITS.email),
  business: optionalText(INQUIRY_LIMITS.business),
  phone: optionalText(40),
  timeline: optionalText(160),
  budget: optionalText(160),
  sessionId: z.string().min(8).max(80),
  messages: z.array(conciergeHistorySchema).min(1).max(24),
  brief: discoveryBriefSchema.optional(),
  document: presentationDraftSchema.optional(),
  previewGenerated: z.boolean().optional().default(false),
  honeypot: z.string().max(INQUIRY_LIMITS.honey).optional().default("")
});

export type ConciergeHandoffInput = z.input<typeof handoffSchema>;
type ParsedHandoff = z.output<typeof handoffSchema>;

const acceptedBySession = new Map<string, InquiryAccepted>();

export function resetConciergeHandoffForTests() {
  acceptedBySession.clear();
}

export function parseConciergeHandoff(raw: unknown): ParsedHandoff {
  return handoffSchema.parse(raw);
}

function visitorText(input: ParsedHandoff) {
  return input.messages
    .filter((item) => item.role === "user")
    .map((item) => item.content)
    .join("\n");
}

export function handoffBusinessLabel(raw: ConciergeHandoffInput | ParsedHandoff) {
  const input = handoffSchema.parse(raw);
  return input.business || input.brief?.businessName || sketchLabel(extractBusinessSketch(visitorText(input)));
}

function section(title: string, lines: string[]) {
  return [title.toUpperCase(), ...lines, ""];
}

/** What Neil reads: who it is, the brief, the direction they saw, then the conversation. */
export function formatHandoffDocument(raw: ConciergeHandoffInput | ParsedHandoff): string {
  const input = handoffSchema.parse(raw);
  const sketch = extractBusinessSketch(visitorText(input));
  const brief = input.brief ? briefLines(input.brief) : [];
  const slides = input.document?.slides ?? [];
  const lines = [
    "New direction from the Atelier site",
    "A request for review — not a booking, quote, or payment.",
    "",
    ...section("Contact", [
      `Name: ${input.name}`,
      `Email: ${input.email}`,
      input.phone ? `Phone: ${input.phone}` : "",
      `Business: ${handoffBusinessLabel(input)}`,
      input.timeline ? `Timing they gave: ${input.timeline}` : "",
      input.budget ? `Investment in mind: ${input.budget}` : ""
    ].filter(Boolean)),
    ...section(
      "The brief",
      brief.length
        ? brief
        : [
            `Business: ${sketchLabel(sketch)}`,
            sketch.kind !== "unknown" ? `Kind: ${sketch.kind}` : "",
            sketch.qualities.length ? `Qualities they asked for: ${sketch.qualities.join(", ")}` : ""
          ].filter(Boolean)
    ),
    ...section(
      "The direction they reviewed",
      input.document
        ? [
            `Title: ${input.document.title}`,
            `Thesis: ${input.document.thesis}`,
            ...slides.map((slide, index) => `${String(index + 1).padStart(2, "0")}. ${slide.kicker ?? slide.layout} — ${slide.headline ?? ""}`.trim()),
            `Illustrative site preview: ${input.previewGenerated ? "yes" : "no"}`
          ]
        : ["No direction was written. The conversation is below."]
    ),
    ...section(
      "Conversation",
      input.messages.map((item) => `${item.role === "user" ? "Visitor" : "Aethelios"}: ${item.content}`)
    ),
    `Session: ${input.sessionId}`,
    INQUIRY_CONSENT_TEXT
  ];
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n").trim();
}

function needFrom(input: ParsedHandoff) {
  const goal = input.brief?.goals || input.brief?.needs;
  const first = input.messages.find((item) => item.role === "user")?.content.trim() ?? "Talk session";
  return (goal || first).slice(0, INQUIRY_LIMITS.need);
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
  const business = handoffBusinessLabel(input);
  const text = formatHandoffDocument(input);
  const subject = `New direction · ${business} · ${input.name}`;
  const inquiry: StoredInquiry = {
    id: createId("inq"),
    receiptId: createReceiptId(),
    createdAt: new Date().toISOString(),
    name: input.name,
    email: input.email,
    business,
    need: needFrom(input),
    source: "concierge",
    briefTitle: input.document?.title,
    delivery: resolved.delivery === "capture" ? "capture" : "email"
  };
  const mailto = () => buildMailtoHref(resolved.destination, { subject, body: text });

  if (resolved.delivery === "email") {
    try {
      await sendInquiryEmail(inquiry, text, resolved.destination, { subject });
    } catch (error) {
      return {
        ok: false,
        error: "delivery_failed",
        message:
          error instanceof InquiryDeliveryError
            ? error.message
            : "Resend could not send this conversation. You can still open the mail app.",
        mailto: mailto()
      };
    }
    await sendVisitorConfirmation(inquiry, resolved.destination);
    const accepted: InquiryAccepted = {
      ok: true,
      submitted: true,
      delivery: "email",
      receiptId: inquiry.receiptId,
      inquiryId: inquiry.id,
      labeled: false,
      note: "Your direction was sent to Neil for review. It is a request, not a booking or payment."
    };
    acceptedBySession.set(input.sessionId, accepted);
    return accepted;
  }

  if (resolved.delivery === "capture") {
    storeCapturedInquiry(inquiry);
    try {
      appendInquiryLog(loadConfig().dataDir, inquiry);
    } catch {
      /* capture memory is enough for local rehearsal */
    }
    const accepted: InquiryAccepted = {
      ok: true,
      submitted: true,
      delivery: "capture",
      receiptId: inquiry.receiptId,
      inquiryId: inquiry.id,
      labeled: true,
      note: "Stored locally for rehearsal. This is not a hosted delivery and not a booking."
    };
    acceptedBySession.set(input.sessionId, accepted);
    return accepted;
  }

  if (resolved.delivery === "mailto") {
    return {
      ok: false,
      error: "unconfigured",
      message: resolved.missing ?? "This site cannot send the conversation directly yet.",
      mailto: mailto()
    };
  }

  throw new UnconfiguredError(resolved.missing ?? "Conversations cannot be delivered from this site yet.");
}
