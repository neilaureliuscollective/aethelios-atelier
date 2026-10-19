import "server-only";
import { cookies } from "next/headers";
import { loadConfig } from "@/lib/config";
import { UnconfiguredError } from "@/lib/domain/errors";
import { createId } from "@/lib/ids";
import { getStore } from "@/lib/persistence/store";
import type { AuthContext, User } from "@/lib/types";

export const SESSION_COOKIE = "atelier_session";
const SESSION_MS = 1000 * 60 * 60 * 24 * 14;

export async function readSession(): Promise<AuthContext | null> {
  const config = loadConfig();
  if (!config.auth.ready) return null;
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;
  let store;
  try {
    store = getStore();
  } catch {
    return null;
  }
  const session = store.getSession(sessionId);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    store.deleteSession(session.id);
    return null;
  }
  const user = store.getUserById(session.userId);
  if (!user) return null;
  return { user, session, adapter: "simulated" };
}

export async function requireSession(): Promise<AuthContext> {
  const config = loadConfig();
  if (!config.auth.ready) {
    throw new UnconfiguredError(
      config.auth.missing ??
        "Auth is not configured. Simulated identities are disabled until the isolated-local simulator gate is enabled."
    );
  }
  const session = await readSession();
  if (!session) {
    throw new UnconfiguredError("Sign in is required for this action.");
  }
  return session;
}

export async function createSimulatedSession(email: string): Promise<AuthContext> {
  const config = loadConfig();
  if (!config.auth.ready) {
    throw new UnconfiguredError(
      "Auth is not configured. No hosted identity provider is connected."
    );
  }
  const store = getStore();
  const user = store.getUserByEmail(email);
  if (!user) {
    throw new UnconfiguredError("That simulated identity is not available.");
  }
  const now = Date.now();
  const session = store.createSession({
    id: createId("sess"),
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_MS).toISOString()
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: config.nodeEnv === "production",
    expires: new Date(now + SESSION_MS)
  });
  return { user, session, adapter: "simulated" };
}

export async function clearSession() {
  const jar = await cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    try {
      getStore().deleteSession(sessionId);
    } catch {
      // Persistence may be unconfigured during sign-out; still clear the cookie.
    }
  }
  jar.delete(SESSION_COOKIE);
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
