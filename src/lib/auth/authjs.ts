import "server-only";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { NextAuthConfig, NextAuthResult } from "next-auth";
import { createLazyAtelierAuthAdapter } from "@/lib/auth/adapter";
import { decideSignIn, evaluateAccountLink, hasVerifiedIdentity } from "@/lib/auth/identityTrust";
import { emailProviderFrom, sendAtelierVerificationRequest } from "@/lib/auth/sendEmail";
import { SESSION_COOKIE, SESSION_MS, sessionCookieOptions } from "@/lib/auth/session";
import { loadConfig } from "@/lib/config";
import { getStore } from "@/lib/persistence/store";
import { UnconfiguredError } from "@/lib/domain/errors";
import { readGoogleOAuth, readResendEmail } from "@/lib/runtime/hosted";

let cached: NextAuthResult | null = null;

export function createAuthjsConfig(): NextAuthConfig {
  const config = loadConfig();
  if (config.auth.adapter !== "authjs" || !config.auth.ready) {
    throw new UnconfiguredError(config.auth.missing ?? "Auth.js is not configured.");
  }

  const google = readGoogleOAuth();
  const resend = readResendEmail();
  const providers: NextAuthConfig["providers"] = [];

  if (config.auth.providers.some((provider) => provider.id === "google") && google.id && google.secret) {
    providers.push(
      Google({
        clientId: google.id,
        clientSecret: google.secret,
        // Auth.js only attempts an email match when this is set. The signIn
        // callback below is the actual linking policy: verified-to-verified
        // same email only. Unverified or colliding identities are refused.
        allowDangerousEmailAccountLinking: true
      })
    );
  }

  if (config.auth.providers.some((provider) => provider.id === "email")) {
    providers.push({
      id: "email",
      name: "Email",
      type: "email",
      from: emailProviderFrom(config),
      maxAge: 60 * 60 * 24,
      apiKey: resend.apiKey || undefined,
      sendVerificationRequest: ({ identifier, url, provider }) =>
        sendAtelierVerificationRequest({ identifier, url, provider })
    });
  }

  const cookie = sessionCookieOptions(new Date(Date.now() + SESSION_MS));

  return {
    secret: config.sessionSecret,
    trustHost: true,
    adapter: createLazyAtelierAuthAdapter(),
    providers,
    session: {
      strategy: "database",
      maxAge: SESSION_MS / 1000,
      updateAge: 60 * 60 * 24
    },
    cookies: {
      sessionToken: {
        name: SESSION_COOKIE,
        options: {
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
          path: cookie.path,
          secure: cookie.secure
        }
      }
    },
    pages: {
      signIn: "/account",
      verifyRequest: "/account",
      error: "/account"
    },
    callbacks: {
      async signIn({ user, account, profile }) {
        const decision = decideSignIn({
          provider: account?.provider ?? "",
          email: user.email,
          profile
        });
        if (!decision.ok) return false;

        if (account?.provider === "google" && decision.email) {
          const store = await getStore();
          const existing = await store.getUserByEmail(decision.email);
          const alreadyLinked = await store.getAuthAccount("google", account.providerAccountId);
          if (existing && !alreadyLinked) {
            const link = evaluateAccountLink({
              incomingEmail: decision.email,
              incomingVerified: true,
              existingEmail: existing.email,
              existingVerified: hasVerifiedIdentity(existing)
            });
            if (!link.allowed) return false;
          }
        }

        return true;
      }
    }
  };
}

export function getAuthjs(): NextAuthResult {
  const config = loadConfig();
  if (config.auth.adapter !== "authjs" || !config.auth.ready) {
    throw new UnconfiguredError(
      config.auth.missing ??
        "Auth.js is not configured. Set ATELIER_AUTH_ADAPTER=authjs plus AUTH_SECRET and a real Google or Resend provider."
    );
  }
  if (!cached) {
    cached = NextAuth(createAuthjsConfig());
  }
  return cached;
}

export function resetAuthjsForTests() {
  cached = null;
}
