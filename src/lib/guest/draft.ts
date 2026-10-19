import { createEmptyBrief, normalizeBrief } from "@/lib/brief";
import type { GuestDraft } from "@/lib/types";

export const GUEST_DRAFT_KEY = "atelier.guestDraft.v1";

export const GUEST_LIMITATIONS = [
  "Saved only on this device.",
  "Signing in does not send this brief.",
  "Signing in does not adopt this draft until you review and confirm.",
  "Offline work is not a delivered submission.",
  "Another person with this browser could see this draft."
];

export function createGuestDraft(): GuestDraft {
  return {
    version: 1,
    kind: "guest_draft",
    labeled: true,
    limitations: GUEST_LIMITATIONS,
    draftId: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `guest_${Date.now()}`,
    title: "Guest draft",
    brief: createEmptyBrief(),
    messages: [],
    updatedAt: new Date().toISOString()
  };
}

export function parseGuestDraft(raw: unknown): GuestDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<GuestDraft>;
  if (value.kind !== "guest_draft" || value.version !== 1) return null;
  return {
    version: 1,
    kind: "guest_draft",
    labeled: true,
    limitations: GUEST_LIMITATIONS,
    draftId: typeof value.draftId === "string" ? value.draftId : createGuestDraft().draftId,
    title: typeof value.title === "string" ? value.title : "Guest draft",
    brief: normalizeBrief(value.brief),
    messages: Array.isArray(value.messages) ? value.messages : [],
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    retainedAfterAdoption: value.retainedAfterAdoption
  };
}

export function readGuestDraft(): GuestDraft | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GUEST_DRAFT_KEY);
  if (!raw) return null;
  try {
    return parseGuestDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeGuestDraft(draft: GuestDraft) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    GUEST_DRAFT_KEY,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString(), labeled: true, limitations: GUEST_LIMITATIONS })
  );
}

export function markGuestRetained(draft: GuestDraft, serverProjectId: string) {
  const next: GuestDraft = {
    ...draft,
    retainedAfterAdoption: {
      serverProjectId,
      savedAt: new Date().toISOString()
    }
  };
  writeGuestDraft(next);
  return next;
}
