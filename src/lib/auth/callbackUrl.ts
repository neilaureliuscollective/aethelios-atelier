import { isApprovedReturnPath } from "@/lib/auth/returnRoutes";

const DEFAULT_CALLBACK = "/account";

export function safeCallbackUrl(value: unknown, fallback = DEFAULT_CALLBACK) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//")) return fallback;
  if (trimmed.includes("://")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  const pathOnly = trimmed.split("#")[0] ?? trimmed;
  if (!isApprovedReturnPath(pathOnly)) return fallback;
  return pathOnly;
}
