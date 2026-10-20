import "server-only";
import { storeCapturedSignInUrl } from "@/lib/auth/emailCapture";
import type { AppConfig } from "@/lib/config";
import { emailCaptureAllowed, readResendEmail } from "@/lib/runtime/hosted";

export async function sendAtelierVerificationRequest(params: {
  identifier: string;
  url: string;
  provider: { from?: string; apiKey?: string };
}) {
  const capture = emailCaptureAllowed();
  if (capture.allowed) {
    storeCapturedSignInUrl(params.identifier, params.url);
    return;
  }

  const resend = readResendEmail();
  const apiKey = params.provider.apiKey || resend.apiKey;
  const from = params.provider.from || resend.from;
  if (!apiKey || !from) {
    throw new Error("Email sign-in is not configured. Set AUTH_RESEND_KEY and AUTH_RESEND_FROM.");
  }

  const host = new URL(params.url).host;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: params.identifier,
      subject: `Sign in to Aethelios Atelier`,
      text: `Sign in to Aethelios Atelier on ${host} using this link:\n${params.url}\n\nThis link expires. Signing in does not adopt or submit a guest draft.`,
      html: `<p>Sign in to Aethelios Atelier using this one-time link:</p><p><a href="${params.url}">Continue to Atelier</a></p><p>Signing in does not adopt or submit a guest draft. If you did not request this, ignore the email.</p>`
    })
  });
  if (!response.ok) {
    throw new Error("The sign-in email could not be sent.");
  }
}

export function emailProviderFrom(config: AppConfig) {
  const resend = readResendEmail();
  if (resend.from) return resend.from;
  if (emailCaptureAllowed().allowed) return "Atelier <auth@localhost>";
  return config.publicOrigin ? `Atelier <noreply@${new URL(config.publicOrigin).hostname}>` : "Atelier <auth@localhost>";
}
