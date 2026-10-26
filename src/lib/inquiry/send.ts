import "server-only";
import { InquiryDeliveryError } from "@/lib/domain/errors";
import { readResendEmail } from "@/lib/runtime/hosted";
import type { StoredInquiry } from "@/lib/inquiry/types";

export const RESEND_TEST_FROM = "Aethelios Atelier <beth.t@example.com>";

export function explainResendFailure(status: number, bodyText: string): string {
  const lower = bodyText.toLowerCase();
  if (status === 401 || lower.includes("api key") || lower.includes("unauthorized")) {
    return "Resend rejected the API key. Recreate AUTH_RESEND_KEY in the Resend dashboard and update Vercel.";
  }
  if (lower.includes("only send testing emails") || lower.includes("own email address")) {
    return "Resend’s free test domain can only mail the address you used to create the Resend account. Set ATELIER_INQUIRY_TO to that same email.";
  }
  if (lower.includes("not verified") || lower.includes("domain is not")) {
    return `The from address is not verified. Without a purchased domain, AUTH_RESEND_FROM must be exactly: ${RESEND_TEST_FROM}.`;
  }
  if (status === 422 || lower.includes("from")) {
    return `Resend rejected the from address. Set AUTH_RESEND_FROM to exactly: ${RESEND_TEST_FROM}.`;
  }
  return `Resend could not send this inquiry. Confirm AUTH_RESEND_FROM is ${RESEND_TEST_FROM} and ATELIER_INQUIRY_TO is the email on your Resend account. You can still open the mail app.`;
}

async function postResend(payload: { to: string; reply_to: string; subject: string; text: string }) {
  const resend = readResendEmail();
  if (!resend.apiKey || !resend.from) {
    throw new InquiryDeliveryError("Inquiry email is not configured.");
  }
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: resend.from, ...payload })
  });
}

export async function sendInquiryEmail(
  inquiry: StoredInquiry,
  text: string,
  destination: string,
  options: { subject?: string } = {}
) {
  const response = await postResend({
    to: destination,
    reply_to: inquiry.email,
    subject: options.subject ?? `Atelier inquiry from ${inquiry.name}`,
    text
  });
  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    console.error("atelier_inquiry_resend", response.status);
    throw new InquiryDeliveryError(explainResendFailure(response.status, bodyText));
  }
}

export function visitorConfirmationText(inquiry: Pick<StoredInquiry, "name" | "business">) {
  const first = inquiry.name.trim().split(/\s+/)[0] || inquiry.name.trim();
  return [
    `${first},`,
    "",
    `Your direction for ${inquiry.business} has reached Neil Stutes. He reads every one personally and will reply to this address with next steps.`,
    "",
    "Nothing has been booked or charged. If anything changes before he writes, simply reply to this email.",
    "",
    "— Aethelios, for Aethelios Atelier"
  ].join("\n");
}

/** A courtesy receipt to the visitor. Never fails the handoff: Neil already has the message. */
export async function sendVisitorConfirmation(inquiry: StoredInquiry, founderInbox: string) {
  try {
    const response = await postResend({
      to: inquiry.email,
      reply_to: founderInbox,
      subject: "Neil has your direction · Aethelios Atelier",
      text: visitorConfirmationText(inquiry)
    });
    if (!response.ok) console.error("atelier_visitor_confirmation", response.status);
  } catch {
    console.error("atelier_visitor_confirmation", "unsent");
  }
}
