import { safeCallbackUrl } from "@/lib/auth/callbackUrl";

export const GUEST_INTENT_KEY = "aethelios.atelier.guestIntent.v1";

export type GuestIntent = {
  version: 1;
  kind: "guest_intent";
  guestWorkId: string;
  destination: string;
  selectionId?: string;
  localRevision?: number;
  updatedAt: string;
};

export function parseGuestIntent(raw: unknown): GuestIntent | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<GuestIntent>;
  if (value.kind !== "guest_intent" || value.version !== 1) return null;
  if (typeof value.guestWorkId !== "string" || !value.guestWorkId.trim()) return null;
  return {
    version: 1,
    kind: "guest_intent",
    guestWorkId: value.guestWorkId.slice(0, 80),
    destination: safeCallbackUrl(value.destination, "/companion/confirm"),
    selectionId: typeof value.selectionId === "string" ? value.selectionId.slice(0, 80) : undefined,
    localRevision: typeof value.localRevision === "number" ? value.localRevision : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString()
  };
}

export function readGuestIntent(): GuestIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(GUEST_INTENT_KEY);
    return raw ? parseGuestIntent(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeGuestIntent(intent: Omit<GuestIntent, "version" | "kind" | "updatedAt">) {
  if (typeof window === "undefined") return;
  const next: GuestIntent = {
    version: 1,
    kind: "guest_intent",
    guestWorkId: intent.guestWorkId,
    destination: safeCallbackUrl(intent.destination, "/companion/confirm"),
    selectionId: intent.selectionId,
    localRevision: intent.localRevision,
    updatedAt: new Date().toISOString()
  };
  window.sessionStorage.setItem(GUEST_INTENT_KEY, JSON.stringify(next));
}

export function clearGuestIntent() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(GUEST_INTENT_KEY);
}
