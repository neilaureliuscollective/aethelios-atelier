import { normalizeEmail, resolveRole } from "@/lib/auth/roles";
import type { AuthAdapterKind, Role, User } from "@/lib/types";

export type SignInProvider = "google" | "email" | "simulated";

export type ProviderEmailEvidence = {
  provider: SignInProvider | string;
  email?: string | null;
  profile?: unknown;
  emailVerifiedClaim?: unknown;
};

export type AccountLinkInput = {
  incomingEmail?: string | null;
  incomingVerified: boolean;
  existingEmail: string;
  existingVerified: boolean;
};

export type TrustDecision =
  | { ok: true; email: string; provider: SignInProvider }
  | { ok: false; reason: string };

export type AccountLinkDecision =
  | { allowed: true; email: string }
  | { allowed: false; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function readGoogleEmailVerified(profile: unknown): boolean {
  if (!isRecord(profile)) return false;
  return profile.email_verified === true;
}

export function readProviderEmail(input: { email?: string | null; profile?: unknown }): string | null {
  const direct = typeof input.email === "string" ? normalizeEmail(input.email) : "";
  if (direct.includes("@")) return direct;
  if (isRecord(input.profile) && typeof input.profile.email === "string") {
    const fromProfile = normalizeEmail(input.profile.email);
    return fromProfile.includes("@") ? fromProfile : null;
  }
  return null;
}

export function hasTrustworthyProviderEmail(input: ProviderEmailEvidence): TrustDecision {
  const email = readProviderEmail(input);
  if (!email) {
    return { ok: false, reason: "A provider email is required." };
  }

  if (input.provider === "google") {
    if (!readGoogleEmailVerified(input.profile)) {
      return { ok: false, reason: "Google did not present a verified email." };
    }
    if (isRecord(input.profile) && typeof input.profile.email === "string") {
      const profileEmail = normalizeEmail(input.profile.email);
      if (profileEmail && profileEmail !== email) {
        return { ok: false, reason: "Google email evidence does not match the sign-in identity." };
      }
    }
    return { ok: true, email, provider: "google" };
  }

  if (input.provider === "email") {
    return { ok: true, email, provider: "email" };
  }

  if (input.provider === "simulated") {
    return { ok: true, email, provider: "simulated" };
  }

  return { ok: false, reason: "This sign-in provider is not trusted." };
}

export function evaluateAccountLink(input: AccountLinkInput): AccountLinkDecision {
  const incoming = typeof input.incomingEmail === "string" ? normalizeEmail(input.incomingEmail) : "";
  const existing = normalizeEmail(input.existingEmail);
  if (!incoming.includes("@") || !existing.includes("@")) {
    return { allowed: false, reason: "Both identities must include an email." };
  }
  if (incoming !== existing) {
    return { allowed: false, reason: "Provider email does not match the existing account." };
  }
  if (!input.incomingVerified) {
    return { allowed: false, reason: "Unverified provider email cannot attach to an existing account." };
  }
  if (!input.existingVerified) {
    return { allowed: false, reason: "An unverified account cannot be claimed by another sign-in method." };
  }
  return { allowed: true, email: incoming };
}

export function persistableEmailVerifiedAt(input: {
  incomingVerifiedAt?: Date | string | null;
  existingVerifiedAt?: string | null;
}): string | undefined {
  if (input.incomingVerifiedAt instanceof Date && !Number.isNaN(input.incomingVerifiedAt.getTime())) {
    return input.incomingVerifiedAt.toISOString();
  }
  if (typeof input.incomingVerifiedAt === "string" && input.incomingVerifiedAt.trim()) {
    const parsed = new Date(input.incomingVerifiedAt);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return input.existingVerifiedAt ?? undefined;
}

export function hasVerifiedIdentity(user: Pick<User, "adapter" | "emailVerifiedAt">): boolean {
  if (user.adapter === "simulated") return true;
  return Boolean(user.emailVerifiedAt);
}

export function resolveAuthorizedRole(
  email: string,
  founderEmails: string[],
  evidence: {
    verified: boolean;
    adapter?: AuthAdapterKind;
    existingRole?: Role;
  }
): Role {
  const listed = resolveRole(email, founderEmails);
  if (listed !== "founder") return "client";
  if (evidence.adapter === "simulated" || evidence.verified) return "founder";
  // Keep an already-persisted founder row so a deploy does not lock Neil out
  // before the next verified Google sign-in writes evidence.
  if (evidence.existingRole === "founder") return "founder";
  return "client";
}

export function decideSignIn(input: ProviderEmailEvidence): TrustDecision {
  return hasTrustworthyProviderEmail(input);
}
