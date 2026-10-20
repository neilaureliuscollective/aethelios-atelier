import { isApprovedReturnPath } from "@/lib/auth/returnRoutes";

const DEFAULT_CALLBACK = "/account";

export function safeCallbackUrl(value: unknown, fallback = DEFAULT_CALLBACK) {
  if (typeof value !== "string") return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  const pathname = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  if (!isApprovedReturnPath(pathname)) return fallback;
  return trimmed;
}
