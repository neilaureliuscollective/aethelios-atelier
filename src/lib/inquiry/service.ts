import "server-only";
import { z } from "zod";
import { INQUIRY_CONSENT_TEXT } from "@/lib/copy";
import { UnconfiguredError, LimitError, ForbiddenError, InquiryDeliveryError } from "@/lib/domain/errors";
import { createId, createReceiptId } from "@/lib/ids";
import { loadConfig } from "@/lib/config";
import {
  appendInquiryLog,
  listCapturedInquiries,
  readInquiryLog,
  storeCapturedInquiry
} from "@/lib/inquiry/capture";
import { resolveInquiryDelivery } from "@/lib/inquiry/destination";
import { inquiryRateLimited } from "@/lib/inquiry/rateLimit";
import { sendInquiryEmail } from "@/lib/inquiry/send";
import {
  INQUIRY_LIMITS,
  buildMailtoHref,
  formatInquiryText,
  summarizeBrief
} from "@/lib/inquiry/summary";
import type { InquiryAccepted, InquiryInput, InquiryUnavailable, StoredInquiry } from "@/lib/inquiry/types";

const inputSchema = z.object({
  name: z.string().trim().min(1).max(INQUIRY_LIMITS.name),
  email: z.string().trim().email().max(INQUIRY_LIMITS.email),
  business: z.string().trim().max(INQUIRY_LIMITS.business).optional().default(""),
  need: z.string().trim().min(8).max(INQUIRY_LIMITS.need),
  source: z.enum(["brief", "inquire"]).default("inquire"),
  consent: z.literal(true),
  honeypot: z.string().max(INQUIRY_LIMITS.honey).optional().default(""),
  brief: z.unknown().optional(),
  idempotencyKey: z.string().min(8).max(80).optional()
});

const acceptedByKey = new Map<string, InquiryAccepted>();

export function resetInquiryServiceForTests() {
  acceptedByKey.clear();
}

export function parseInquiryInput(raw: unknown): InquiryInput {
  const parsed = inputSchema.parse(raw);
  return {
    name: parsed.name,
    email: parsed.email,
    business: parsed.business,
    need: parsed.need,
    source: parsed.source,
    consent: true,
    honeypot: parsed.honeypot,
    brief: parsed.brief,
    idempotencyKey: parsed.idempotencyKey
  };
}

function toStored(input: InquiryInput, delivery: "email" | "capture"): StoredInquiry {
  const brief = summarizeBrief(input.brief);
  return {
    id: createId("inq"),
    receiptId: createReceiptId(),
    createdAt: new Date().toISOString(),
    name: input.name,
    email: input.email,
    business: input.business,
    need: input.need,
    source: input.source,
    briefTitle: brief?.title,
    briefLines: brief?.lines,
    delivery
  };
}

export function inquiryMailto(input: InquiryInput, destination: string) {
  const brief = summarizeBrief(input.brief);
  const body = formatInquiryText({
    name: input.name,
    email: input.email,
    business: input.business,
    need: input.need,
    source: input.source,
    brief
  });
  return buildMailtoHref(destination, {
    subject: `Atelier inquiry from ${input.name}`,
    body
  });
}

function acceptedFrom(inquiry: StoredInquiry, labeled: boolean): InquiryAccepted {
  return {
    ok: true,
    submitted: true,
    delivery: inquiry.delivery,
    receiptId: inquiry.receiptId,
    inquiryId: inquiry.id,
    labeled,
    note:
      inquiry.delivery === "capture"
        ? "Stored locally for rehearsal. This is not a hosted delivery and not a booking."
        : "This inquiry was sent to Neil for review. It is a request, not a booking or payment."
  };
}

export async function submitInquiry(
  raw: unknown,
  options: { clientKey?: string } = {}
): Promise<InquiryAccepted | InquiryUnavailable> {
  const input = parseInquiryInput(raw);
  if (input.honeypot?.trim()) {
    throw new ForbiddenError("This inquiry could not be accepted.");
  }
  if (options.clientKey && inquiryRateLimited(options.clientKey)) {
    throw new LimitError("Too many inquiries were sent from this connection. Try again later.");
  }
  if (input.idempotencyKey) {
    const prior = acceptedByKey.get(input.idempotencyKey);
    if (prior) return prior;
  }

  const resolved = resolveInquiryDelivery();
  const brief = summarizeBrief(input.brief);
  const text = formatInquiryText({
    name: input.name,
    email: input.email,
    business: input.business,
    need: input.need,
    source: input.source,
    brief
  });

  if (resolved.delivery === "email") {
    const inquiry = toStored(input, "email");
    try {
      await sendInquiryEmail(inquiry, `${text}\n\n${INQUIRY_CONSENT_TEXT}`, resolved.destination);
    } catch (error) {
      return {
        ok: false,
        error: "delivery_failed",
        message:
          error instanceof InquiryDeliveryError
            ? error.message
            : "Resend could not send this inquiry. You can still open the mail app.",
        mailto: inquiryMailto(input, resolved.destination)
      };
    }
    const accepted = acceptedFrom(inquiry, false);
    if (input.idempotencyKey) acceptedByKey.set(input.idempotencyKey, accepted);
    return accepted;
  }

  if (resolved.delivery === "capture") {
    const inquiry = toStored(input, "capture");
    storeCapturedInquiry(inquiry);
    try {
      appendInquiryLog(loadConfig().dataDir, inquiry);
    } catch {
      /* capture memory is enough for local rehearsal */
    }
    const accepted = acceptedFrom(inquiry, true);
    if (input.idempotencyKey) acceptedByKey.set(input.idempotencyKey, accepted);
    return accepted;
  }

  if (resolved.delivery === "mailto") {
    return {
      ok: false,
      error: "unconfigured",
      message: resolved.missing ?? "This site cannot send the inquiry directly yet.",
      mailto: inquiryMailto(input, resolved.destination)
    };
  }

  throw new UnconfiguredError(
    resolved.missing ?? "Inquiries cannot be delivered from this site yet."
  );
}

export function listFounderInquiries(): StoredInquiry[] {
  const config = loadConfig();
  const logged = readInquiryLog(config.dataDir);
  const captured = listCapturedInquiries();
  const byId = new Map<string, StoredInquiry>();
  for (const item of [...logged, ...captured]) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
