import "server-only";
import { emailCaptureAllowed } from "@/lib/runtime/hosted";
import { normalizeEmail } from "@/lib/auth/roles";

type CapturedLink = {
  email: string;
  url: string;
  createdAt: string;
};

const captures = new Map<string, CapturedLink>();

export function storeCapturedSignInUrl(email: string, url: string) {
  if (!emailCaptureAllowed().allowed) {
    throw new Error("Email capture is not allowed in this environment.");
  }
  const normalized = normalizeEmail(email);
  captures.set(normalized, {
    email: normalized,
    url,
    createdAt: new Date().toISOString()
  });
}

export function readCapturedSignInUrl(email: string) {
  if (!emailCaptureAllowed().allowed) return null;
  return captures.get(normalizeEmail(email)) ?? null;
}

export function clearCapturedSignInUrls() {
  captures.clear();
}
