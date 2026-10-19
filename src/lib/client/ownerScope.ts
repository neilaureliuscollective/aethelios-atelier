const ACCOUNT_PREFIX = "atelier.account.";
const GUEST_KEY = "atelier.guestDraft.v1";

export function accountStorageKey(ownerId: string, kind: string, projectId?: string) {
  return projectId
    ? `${ACCOUNT_PREFIX}${ownerId}.${kind}.${projectId}`
    : `${ACCOUNT_PREFIX}${ownerId}.${kind}`;
}

export function writeOwnerJson(ownerId: string, kind: string, value: unknown, projectId?: string) {
  if (typeof window === "undefined") return { ok: false, reason: "no-window" as const };
  try {
    window.sessionStorage.setItem(accountStorageKey(ownerId, kind, projectId), JSON.stringify(value));
    return { ok: true as const };
  } catch {
    try {
      window.localStorage.setItem(accountStorageKey(ownerId, kind, projectId), JSON.stringify(value));
      return { ok: true as const, fallback: "localStorage" as const };
    } catch {
      return { ok: false as const, reason: "storage-unavailable" as const };
    }
  }
}

export function readOwnerJson<T>(ownerId: string, kind: string, projectId?: string): T | null {
  if (typeof window === "undefined") return null;
  const key = accountStorageKey(ownerId, kind, projectId);
  const raw = window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Removes only this account's Atelier recovery keys. Does not touch guest drafts or unrelated site data. */
export function clearOwnerScopedData(ownerId: string) {
  if (typeof window === "undefined") return;
  const prefix = `${ACCOUNT_PREFIX}${ownerId}.`;
  for (const storage of [window.sessionStorage, window.localStorage]) {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  }
}

export function hideForeignAccountState() {
  if (typeof window === "undefined") return;
  // Guest drafts are device-local and unowned; leave GUEST_KEY intact.
  void GUEST_KEY;
}
