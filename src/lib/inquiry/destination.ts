import { hostedPlatformName, readResendEmail } from "@/lib/runtime/hosted";

export const PLACEHOLDER_INQUIRY_DOMAIN = /(^|\.)invalid$|(^|\.)example\.com$|(^|\.)localhost$/i;

type Env = Record<string, string | undefined>;

export function normalizeInquiryEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isPlaceholderInquiryEmail(email: string): boolean {
  const normalized = normalizeInquiryEmail(email);
  const at = normalized.lastIndexOf("@");
  if (at < 1) return true;
  return PLACEHOLDER_INQUIRY_DOMAIN.test(normalized.slice(at + 1));
}

export function readInquiryDestination(env: Env = process.env): string {
  return normalizeInquiryEmail(env.ATELIER_INQUIRY_TO ?? "");
}

export function inquiryCaptureAllowed(env: Env = process.env): {
  allowed: boolean;
  reason?: string;
} {
  if (env.ATELIER_INQUIRY_CAPTURE !== "true") {
    return { allowed: false, reason: "ATELIER_INQUIRY_CAPTURE is not true" };
  }
  const hosted = hostedPlatformName(env);
  if (hosted) {
    return {
      allowed: false,
      reason: `Inquiry capture is refused on hosted platform (${hosted}). Set ATELIER_INQUIRY_TO and AUTH_RESEND_KEY / AUTH_RESEND_FROM.`
    };
  }
  return { allowed: true };
}

export function inquiryResendReady(env: Env = process.env): boolean {
  const resend = readResendEmail(env);
  return Boolean(resend.apiKey && resend.from);
}

export type InquiryDelivery = "email" | "capture" | "mailto" | "unconfigured";

export function resolveInquiryDelivery(env: Env = process.env): {
  delivery: InquiryDelivery;
  destination: string;
  missing?: string;
} {
  const destination = readInquiryDestination(env);
  const capture = inquiryCaptureAllowed(env);
  const liveDestination = Boolean(destination) && !isPlaceholderInquiryEmail(destination);

  if (liveDestination && inquiryResendReady(env)) {
    return { delivery: "email", destination };
  }
  if (capture.allowed) {
    return {
      delivery: "capture",
      destination: destination || "captured.local@atelier.invalid"
    };
  }
  if (liveDestination) {
    return {
      delivery: "mailto",
      destination,
      missing:
        "Direct sending is not configured. Set AUTH_RESEND_KEY and AUTH_RESEND_FROM, or open the mail app to send this inquiry."
    };
  }
  return {
    delivery: "unconfigured",
    destination: "",
    missing:
      "Inquiries cannot be delivered yet. Set ATELIER_INQUIRY_TO to a real inbox. On an isolated local machine, ATELIER_INQUIRY_CAPTURE=true stores rehearsal inquiries without sending mail."
  };
}

export function publicInquiryState(env: Env = process.env) {
  const resolved = resolveInquiryDelivery(env);
  return {
    accept: resolved.delivery === "email" || resolved.delivery === "capture",
    canMailto: resolved.delivery === "mailto" || resolved.delivery === "email",
    labeled: resolved.delivery === "capture",
    missing: resolved.missing
  };
}
