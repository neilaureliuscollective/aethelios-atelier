import "server-only";
import { readResendEmail } from "@/lib/runtime/hosted";
import type { StoredInquiry } from "@/lib/inquiry/types";

export async function sendInquiryEmail(inquiry: StoredInquiry, text: string, destination: string) {
  const resend = readResendEmail();
  if (!resend.apiKey || !resend.from) {
    throw new Error("Inquiry email is not configured.");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resend.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: resend.from,
      to: destination,
      reply_to: inquiry.email,
      subject: `Atelier inquiry from ${inquiry.name}`,
      text
    })
  });
  if (!response.ok) {
    throw new Error("The inquiry email could not be sent.");
  }
}
