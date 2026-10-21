import { describe, expect, it } from "vitest";
import {
  decideSignIn,
  evaluateAccountLink,
  hasTrustworthyProviderEmail,
  persistableEmailVerifiedAt,
  readGoogleEmailVerified,
  resolveAuthorizedRole
} from "@/lib/auth/identityTrust";

const FOUNDER = "neil@example.com";

describe("Google verification evidence", () => {
  it("accepts only a boolean true email_verified claim from Google", () => {
    expect(readGoogleEmailVerified({ email_verified: true, email: "client@example.com" })).toBe(true);
    expect(readGoogleEmailVerified({ email_verified: "true", email: "client@example.com" })).toBe(false);
    expect(readGoogleEmailVerified({ email_verified: 1, email: "client@example.com" })).toBe(false);
    expect(readGoogleEmailVerified({ email_verified: false })).toBe(false);
    expect(readGoogleEmailVerified({})).toBe(false);
    expect(readGoogleEmailVerified(null)).toBe(false);
  });

  it("refuses Google sign-in without verified provider evidence", () => {
    expect(
      decideSignIn({
        provider: "google",
        email: "client@example.com",
        profile: { email: "client@example.com" }
      }).ok
    ).toBe(false);
    expect(
      decideSignIn({
        provider: "google",
        email: "client@example.com",
        profile: { email: "client@example.com", email_verified: false }
      }).ok
    ).toBe(false);
    expect(
      decideSignIn({
        provider: "google",
        email: "",
        profile: { email_verified: true }
      }).ok
    ).toBe(false);
  });

  it("refuses a Google profile whose email does not match the sign-in identity", () => {
    const decision = decideSignIn({
      provider: "google",
      email: "attacker@example.com",
      profile: { email: "victim@example.com", email_verified: true }
    });
    expect(decision.ok).toBe(false);
  });

  it("accepts a verified Google identity and a consumed email magic link", () => {
    expect(
      hasTrustworthyProviderEmail({
        provider: "google",
        email: "Client@Example.com",
        profile: { email: "client@example.com", email_verified: true }
      })
    ).toEqual({ ok: true, email: "client@example.com", provider: "google" });
    expect(
      hasTrustworthyProviderEmail({
        provider: "email",
        email: "client@example.com"
      }).ok
    ).toBe(true);
  });
});

describe("account linking policy", () => {
  it("links only verified-to-verified identities with the same email", () => {
    expect(
      evaluateAccountLink({
        incomingEmail: "Client@Example.com",
        incomingVerified: true,
        existingEmail: "client@example.com",
        existingVerified: true
      })
    ).toEqual({ allowed: true, email: "client@example.com" });
  });

  it("refuses unverified incoming claims, unverified existing accounts, and email mismatches", () => {
    expect(
      evaluateAccountLink({
        incomingEmail: "client@example.com",
        incomingVerified: false,
        existingEmail: "client@example.com",
        existingVerified: true
      }).allowed
    ).toBe(false);
    expect(
      evaluateAccountLink({
        incomingEmail: "client@example.com",
        incomingVerified: true,
        existingEmail: "client@example.com",
        existingVerified: false
      }).allowed
    ).toBe(false);
    expect(
      evaluateAccountLink({
        incomingEmail: "other@example.com",
        incomingVerified: true,
        existingEmail: "client@example.com",
        existingVerified: true
      }).allowed
    ).toBe(false);
  });
});

describe("privileged role assignment", () => {
  it("does not grant founder from an unverified email match", () => {
    expect(
      resolveAuthorizedRole(FOUNDER, [FOUNDER], {
        verified: false,
        adapter: "authjs"
      })
    ).toBe("client");
  });

  it("grants founder from verified provider evidence or the simulated local adapter", () => {
    expect(
      resolveAuthorizedRole(FOUNDER, [FOUNDER], {
        verified: true,
        adapter: "authjs"
      })
    ).toBe("founder");
    expect(
      resolveAuthorizedRole(FOUNDER, [FOUNDER], {
        verified: false,
        adapter: "simulated"
      })
    ).toBe("founder");
  });

  it("keeps an existing founder row so a deploy does not lock Neil out before the next verified sign-in", () => {
    expect(
      resolveAuthorizedRole(FOUNDER, [FOUNDER], {
        verified: false,
        adapter: "authjs",
        existingRole: "founder"
      })
    ).toBe("founder");
  });

  it("never trusts a client-submitted role for an ordinary email", () => {
    expect(
      resolveAuthorizedRole("client@example.com", [FOUNDER], {
        verified: true,
        adapter: "authjs",
        existingRole: "founder"
      })
    ).toBe("client");
  });
});

describe("verification timestamps", () => {
  it("does not invent an email-verification timestamp", () => {
    expect(persistableEmailVerifiedAt({})).toBeUndefined();
    expect(persistableEmailVerifiedAt({ existingVerifiedAt: "2026-01-01T00:00:00.000Z" })).toBe(
      "2026-01-01T00:00:00.000Z"
    );
    expect(persistableEmailVerifiedAt({ incomingVerifiedAt: new Date("2026-02-02T00:00:00.000Z") })).toBe(
      "2026-02-02T00:00:00.000Z"
    );
  });
});
