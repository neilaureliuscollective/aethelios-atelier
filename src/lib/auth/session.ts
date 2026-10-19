import "server-only";
import { cookies } from "next/headers";
import { loadConfig } from "@/lib/config";
import { AuthenticationError, UnconfiguredError } from "@/lib/domain/errors";
import { createId } from "@/lib/ids";
import { displayNameFromEmail, normalizeEmail, resolveRole } from "@/lib/auth/roles";
import { getStore } from "@/lib/persistence/store";
import type { AuthAdapterKind, AuthContext, User } from "@/lib/types";

export const SESSION_COOKIE = "atelier_session";
export const SESSION_MS = 1000 * 60 * 60 * 24 * 14;

const AUTHJS_EXTRA_COOKIES = [
  "authjs.csrf-token",
  "authjs.callback-url",
  "__Host-authjs.csrf-token",
  "authjs.pkce.code_verifier",
  "__Secure-authjs.pkce.code_verifier",
  "authjs.state",
  "__Secure-authjs.state",
  "authjs.nonce",
  "__Secure-authjs.nonce"
];

export function sessionCookieOptions(expires: Date) {
  const config = loadConfig();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: config.nodeEnv === "production",
    expires
  };
}

async function applyFounderRole(user: User): Promise<User> {
  const config = loadConfig();
  const role = resolveRole(user.email, config.founderEmailList);
  if (role === user.role) return { ...user, email: normalizeEmail(user.email) };
  const next = { ...user, email: normalizeEmail(user.email), role };
  try {
    await (await getStore()).upsertUser(next);
  } catch {
    // Authorization still uses the recomputed role even if persistence is briefly unavailable.
  }
  return next;
}

export async function readSession(): Promise<AuthContext | null> {
  const config = loadConfig();
  if (!config.auth.ready) return null;
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  let store;
  try {
    store = await getStore();
  } catch {
    return null;
  }
  const session = await store.getSession(sessionId);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    await store.deleteSession(session.id);
    return null;
  }
  const user = await store.getUserById(session.userId);
  if (!user) return null;
  return {
    user: await applyFounderRole(user),
    session,
    adapter: config.auth.adapter === "authjs" ? "authjs" : "simulated"
  };
}

export async function requireSession(): Promise<AuthContext> {
  const config = loadConfig();
  if (!config.auth.ready) {
    throw new UnconfiguredError(
      config.auth.missing ??
        "Auth is not configured. Simulated identities are disabled until the isolated-local simulator gate is enabled, and Auth.js stays off until a real provider is connected."
    );
  }
  const session = await readSession();
  if (!session) {
    throw new AuthenticationError();
  }
  return session;
}

export async function createSimulatedSession(email: string): Promise<AuthContext> {
  const config = loadConfig();
  if (config.auth.adapter !== "simulated" || !config.auth.ready) {
    throw new UnconfiguredError(
      "Simulated sign-in is disabled. Connect Auth.js with Google and/or Resend for hosted accounts, or enable the isolated-local simulator."
    );
  }
  const store = await getStore();
  const user = await store.getUserByEmail(email);
  if (!user) {
    throw new UnconfiguredError("That simulated identity is not available.");
  }
  return issueSession(await applyFounderRole(user), "simulated");
}

export async function issueSession(user: User, adapter: AuthAdapterKind): Promise<AuthContext> {
  const config = loadConfig();
  const store = await getStore();
  const now = Date.now();
  const session = await store.createSession({
    id: createId("sess"),
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_MS).toISOString()
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, sessionCookieOptions(new Date(now + SESSION_MS)));
  return { user, session, adapter: adapter === "authjs" ? "authjs" : config.auth.adapter === "authjs" ? "authjs" : "simulated" };
}

export async function upsertVerifiedUser(input: {
  email: string;
  displayName?: string | null;
  emailVerified?: Date | null;
  existingId?: string;
}): Promise<User> {
  const config = loadConfig();
  const store = await getStore();
  const email = normalizeEmail(input.email);
  const existing = input.existingId
    ? await store.getUserById(input.existingId)
    : await store.getUserByEmail(email);
  const now = new Date().toISOString();
  const user: User = {
    id: existing?.id ?? input.existingId ?? createId("user"),
    email,
    displayName: displayNameFromEmail(email, input.displayName ?? existing?.displayName),
    role: resolveRole(email, config.founderEmailList),
    adapter: "authjs",
    createdAt: existing?.createdAt ?? now,
    emailVerifiedAt: input.emailVerified?.toISOString() ?? existing?.emailVerifiedAt ?? now
  };
  return store.upsertUser(user);
}

export async function clearSession() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    try {
      await (await getStore()).deleteSession(sessionId);
    } catch {
      // Persistence may be unconfigured during sign-out; still clear the cookie.
    }
  }
  jar.delete(SESSION_COOKIE);
  for (const name of AUTHJS_EXTRA_COOKIES) {
    jar.delete(name);
  }
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    adapter: user.adapter
  };
}
