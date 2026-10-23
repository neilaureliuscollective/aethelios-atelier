import {
  CONCIERGE_STORAGE_KEY,
  emptyConciergeFacts,
  type ConciergeFacts,
  type ConciergeMessage,
  type ConciergeStoredSession
} from "@/lib/concierge/types";

const MAX_STORED = 80;

export function createConciergeMessage(
  role: ConciergeMessage["role"],
  body: string,
  extra?: Partial<ConciergeMessage>
): ConciergeMessage {
  const id =
    extra?.id ??
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? `cmsg_${crypto.randomUUID()}`
      : `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  return {
    id,
    role,
    body,
    createdAt: extra?.createdAt ?? new Date().toISOString(),
    liveAi: extra?.liveAi
  };
}

export function emptyConciergeSession(): ConciergeStoredSession {
  return {
    version: 1,
    messages: [],
    facts: emptyConciergeFacts(),
    updatedAt: new Date().toISOString()
  };
}

export function parseConciergeSession(raw: unknown): ConciergeStoredSession {
  const empty = emptyConciergeSession();
  if (!raw || typeof raw !== "object") return empty;
  const record = raw as Partial<ConciergeStoredSession>;
  if (record.version !== 1) return empty;
  const messages = Array.isArray(record.messages)
    ? record.messages
        .filter((item): item is ConciergeMessage => {
          return Boolean(
            item &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.body === "string" &&
              (item.role === "user" || item.role === "assistant" || item.role === "system")
          );
        })
        .slice(-MAX_STORED)
    : [];
  return {
    version: 1,
    messages,
    facts: emptyConciergeFacts(record.facts),
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : empty.updatedAt
  };
}

export function readConciergeSession(
  storage?: Storage | null,
  key = CONCIERGE_STORAGE_KEY
): ConciergeStoredSession {
  if (!storage) return emptyConciergeSession();
  try {
    const raw = storage.getItem(key);
    if (!raw) return emptyConciergeSession();
    return parseConciergeSession(JSON.parse(raw));
  } catch {
    return emptyConciergeSession();
  }
}

export function writeConciergeSession(
  session: ConciergeStoredSession,
  storage?: Storage | null,
  key = CONCIERGE_STORAGE_KEY
) {
  if (!storage) return;
  try {
    storage.setItem(
      key,
      JSON.stringify({
        ...session,
        messages: session.messages.slice(-MAX_STORED),
        updatedAt: new Date().toISOString()
      })
    );
  } catch {
    /* private mode / quota — conversation still works in memory */
  }
}

export function clearConciergeSession(storage?: Storage | null, key = CONCIERGE_STORAGE_KEY) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function historyForRequest(messages: ConciergeMessage[]) {
  return messages
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({ role: item.role as "user" | "assistant", body: item.body }));
}

export function mergeFacts(current: ConciergeFacts, next: ConciergeFacts): ConciergeFacts {
  const asked = new Set([...(current.asked ?? []), ...(next.asked ?? [])]);
  return {
    ...current,
    ...next,
    asked: [...asked]
  };
}
