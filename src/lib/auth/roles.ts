import type { Role } from "@/lib/types";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function resolveRole(email: string, founderEmails: string[]): Role {
  return founderEmails.includes(normalizeEmail(email)) ? "founder" : "client";
}

export function displayNameFromEmail(email: string, fallback?: string | null) {
  const trimmed = fallback?.trim();
  if (trimmed) return trimmed;
  const local = normalizeEmail(email).split("@")[0] ?? "Client";
  return local.replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) || "Client";
}
