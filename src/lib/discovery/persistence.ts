import {
  DISCOVERY_STORAGE_KEY,
  DISCOVERY_STORAGE_VERSION,
  SUPPORTED_STORAGE_VERSIONS,
  isDiscoveryPhase,
  type DiscoveryDraft,
  type DiscoveryPhase,
  type DiscoverySelection,
  type PersistenceState,
  type StoredDiscoveryEnvelope
} from "./types";
import { parseDraft, parseSelection, sanitizeDraft } from "./selection";

export type MemoryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type PersistenceResult =
  | { ok: true; state: Extract<PersistenceState, "opted_in">; envelope: StoredDiscoveryEnvelope }
  | { ok: false; state: Exclude<PersistenceState, "opted_in" | "memory">; reason: string };

export function createEnvelope(
  draft: DiscoveryDraft,
  confirmed: DiscoverySelection | null,
  phase: DiscoveryPhase,
  intakeStep: number,
  savedAt = new Date().toISOString()
): StoredDiscoveryEnvelope {
  return {
    version: DISCOVERY_STORAGE_VERSION,
    kind: "discovery_session",
    savedAt,
    draft: sanitizeDraft(draft),
    confirmed,
    phase,
    intakeStep: Number.isFinite(intakeStep) ? Math.max(0, Math.min(4, Math.floor(intakeStep))) : 0
  };
}

export function parseEnvelope(input: unknown): StoredDiscoveryEnvelope | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<StoredDiscoveryEnvelope>;
  if (raw.kind !== "discovery_session") return null;
  if (typeof raw.version !== "number" || !(SUPPORTED_STORAGE_VERSIONS as readonly number[]).includes(raw.version)) {
    return null;
  }
  const draft = parseDraft(raw.draft);
  if (!draft) return null;
  const confirmed = raw.confirmed == null ? null : parseSelection(raw.confirmed);
  if (raw.confirmed != null && !confirmed) return null;
  if (!isDiscoveryPhase(raw.phase)) return null;
  return {
    version: DISCOVERY_STORAGE_VERSION,
    kind: "discovery_session",
    savedAt: typeof raw.savedAt === "string" ? raw.savedAt : "",
    draft,
    confirmed,
    phase: raw.phase,
    intakeStep: typeof raw.intakeStep === "number" ? raw.intakeStep : 0
  };
}

export function readDiscovery(
  storage: MemoryStorage | null,
  key = DISCOVERY_STORAGE_KEY
): PersistenceResult | { ok: true; state: "memory"; envelope: null } {
  if (!storage) return { ok: false, state: "unavailable", reason: "No storage adapter." };
  try {
    const raw = storage.getItem(key);
    if (!raw) return { ok: true, state: "memory", envelope: null };
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, state: "malformed", reason: "Stored discovery JSON could not be parsed." };
    }
    const envelope = parseEnvelope(parsed);
    if (!envelope) {
      return {
        ok: false,
        state: "malformed",
        reason: "Stored discovery is from an unknown catalog, template, or schema version."
      };
    }
    return { ok: true, state: "opted_in", envelope };
  } catch {
    return { ok: false, state: "unavailable", reason: "Storage is blocked or unavailable." };
  }
}

export function writeDiscovery(
  storage: MemoryStorage | null,
  envelope: StoredDiscoveryEnvelope,
  key = DISCOVERY_STORAGE_KEY
): PersistenceResult {
  if (!storage) return { ok: false, state: "unavailable", reason: "No storage adapter." };
  try {
    storage.setItem(key, JSON.stringify(envelope));
    return { ok: true, state: "opted_in", envelope };
  } catch (error) {
    const quota =
      (error instanceof Error && error.name === "QuotaExceededError") ||
      (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "QuotaExceededError");
    if (quota) return { ok: false, state: "quota", reason: "This device is out of storage space for discovery notes." };
    return { ok: false, state: "unavailable", reason: "Storage refused the write." };
  }
}

export function clearDiscovery(storage: MemoryStorage | null, key = DISCOVERY_STORAGE_KEY): PersistenceResult | { ok: true; state: "memory"; envelope: null } {
  if (!storage) return { ok: false, state: "unavailable", reason: "No storage adapter." };
  try {
    storage.removeItem(key);
  } catch {
    return { ok: false, state: "unavailable", reason: "Storage could not be cleared." };
  }
  try {
    if (storage.getItem(key) != null) {
      return {
        ok: false,
        state: "unavailable",
        reason: "The saved sketch is still on this device after the clear attempt."
      };
    }
  } catch {
    return { ok: false, state: "unavailable", reason: "Storage could not confirm that the saved sketch was removed." };
  }
  return { ok: true, state: "memory", envelope: null };
}

export function browserStorage(): MemoryStorage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = "__aethelios_discovery_probe";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}
