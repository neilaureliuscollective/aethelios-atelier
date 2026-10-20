import type { Adapter, AdapterAccount, AdapterUser, VerificationToken } from "next-auth/adapters";
import { displayNameFromEmail, normalizeEmail, resolveRole } from "@/lib/auth/roles";
import { loadConfig } from "@/lib/config";
import { createId } from "@/lib/ids";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import { getStore } from "@/lib/persistence/store";
import type { AuthAccountRecord, Session, User } from "@/lib/types";

function toAdapterUser(user: User): AdapterUser {
  return {
    id: user.id,
    email: normalizeEmail(user.email),
    name: user.displayName,
    emailVerified: user.emailVerifiedAt ? new Date(user.emailVerifiedAt) : null,
    image: null
  };
}

function fromAdapterUser(user: AdapterUser, existing?: User | null): User {
  const config = loadConfig();
  const email = normalizeEmail(user.email);
  return {
    id: existing?.id || user.id || createId("user"),
    email,
    displayName: displayNameFromEmail(email, user.name ?? existing?.displayName),
    role: resolveRole(email, config.founderEmailList),
    adapter: "authjs",
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    emailVerifiedAt: user.emailVerified
      ? user.emailVerified.toISOString()
      : existing?.emailVerifiedAt
  };
}

function toAdapterSession(session: Session) {
  return {
    sessionToken: session.id,
    userId: session.userId,
    expires: new Date(session.expiresAt)
  };
}

function toAuthAccount(account: AdapterAccount): AuthAccountRecord {
  return {
    userId: account.userId,
    type: account.type,
    provider: account.provider,
    providerAccountId: account.providerAccountId,
    refresh_token: account.refresh_token ?? null,
    access_token: account.access_token ?? null,
    expires_at: account.expires_at ?? null,
    token_type: account.token_type ?? null,
    scope: account.scope ?? null,
    id_token: account.id_token ?? null,
    session_state: account.session_state == null ? null : String(account.session_state)
  };
}

export function createLazyAtelierAuthAdapter(): Adapter {
  const resolve = async () => createAtelierAuthAdapter(await getStore());
  const call = <K extends keyof Adapter>(key: K) => {
    return (async (...args: never[]) => {
      const adapter = await resolve();
      const method = adapter[key];
      if (!method) return null;
      return (method as (...params: never[]) => unknown)(...args);
    }) as NonNullable<Adapter[K]>;
  };
  return {
    createUser: call("createUser"),
    getUser: call("getUser"),
    getUserByEmail: call("getUserByEmail"),
    getUserByAccount: call("getUserByAccount"),
    updateUser: call("updateUser"),
    linkAccount: call("linkAccount"),
    unlinkAccount: call("unlinkAccount"),
    createSession: call("createSession"),
    getSessionAndUser: call("getSessionAndUser"),
    updateSession: call("updateSession"),
    deleteSession: call("deleteSession"),
    createVerificationToken: call("createVerificationToken"),
    useVerificationToken: call("useVerificationToken"),
    getAccount: call("getAccount")
  };
}

export function createAtelierAuthAdapter(store: PersistenceAdapter): Adapter {
  return {
    async createUser(user) {
      const created = fromAdapterUser(user);
      await store.upsertUser(created);
      return toAdapterUser(created);
    },
    async getUser(id) {
      const user = await store.getUserById(id);
      return user ? toAdapterUser(user) : null;
    },
    async getUserByEmail(email) {
      const user = await store.getUserByEmail(email);
      return user ? toAdapterUser(user) : null;
    },
    async getUserByAccount({ provider, providerAccountId }) {
      const account = await store.getAuthAccount(provider, providerAccountId);
      if (!account) return null;
      const user = await store.getUserById(account.userId);
      return user ? toAdapterUser(user) : null;
    },
    async updateUser(user) {
      const existing = await store.getUserById(user.id);
      if (!existing) throw new Error("User not found.");
      const next = fromAdapterUser(
        {
          ...toAdapterUser(existing),
          ...user,
          email: user.email ?? existing.email
        },
        existing
      );
      await store.upsertUser(next);
      return toAdapterUser(next);
    },
    async linkAccount(account) {
      await store.createAuthAccount(toAuthAccount(account));
      return account;
    },
    async unlinkAccount({ provider, providerAccountId }) {
      await store.deleteAuthAccount(provider, providerAccountId);
    },
    async createSession({ sessionToken, userId, expires }) {
      const now = new Date().toISOString();
      const session = await store.createSession({
        id: sessionToken,
        userId,
        createdAt: now,
        expiresAt: expires.toISOString()
      });
      return toAdapterSession(session);
    },
    async getSessionAndUser(sessionToken) {
      const session = await store.getSession(sessionToken);
      if (!session) return null;
      if (new Date(session.expiresAt).getTime() < Date.now()) {
        await store.deleteSession(session.id);
        return null;
      }
      const user = await store.getUserById(session.userId);
      if (!user) return null;
      return {
        session: toAdapterSession(session),
        user: toAdapterUser(user)
      };
    },
    async updateSession(session) {
      const existing = await store.getSession(session.sessionToken);
      if (!existing) return null;
      const next = await store.updateSession({
        id: existing.id,
        userId: session.userId ?? existing.userId,
        createdAt: existing.createdAt,
        expiresAt: session.expires ? session.expires.toISOString() : existing.expiresAt
      });
      return next ? toAdapterSession(next) : null;
    },
    async deleteSession(sessionToken) {
      await store.deleteSession(sessionToken);
    },
    async createVerificationToken(token) {
      return toVerification(await store.createVerificationToken(fromVerification(token)));
    },
    async useVerificationToken({ identifier, token }) {
      const used = await store.useVerificationToken(identifier, token);
      return used ? toVerification(used) : null;
    },
    async getAccount(providerAccountId, provider) {
      const account = await store.getAuthAccount(provider, providerAccountId);
      if (!account) return null;
      return {
        userId: account.userId,
        type: account.type as AdapterAccount["type"],
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token ?? undefined,
        access_token: account.access_token ?? undefined,
        expires_at: account.expires_at ?? undefined,
        token_type: account.token_type ?? undefined,
        scope: account.scope ?? undefined,
        id_token: account.id_token ?? undefined,
        session_state: account.session_state ?? undefined
      } as AdapterAccount;
    }
  };
}

function fromVerification(token: VerificationToken) {
  return {
    identifier: normalizeEmail(token.identifier),
    token: token.token,
    expires: token.expires.toISOString()
  };
}

function toVerification(token: { identifier: string; token: string; expires: string }): VerificationToken {
  return {
    identifier: token.identifier,
    token: token.token,
    expires: new Date(token.expires)
  };
}
