import {
  DISCOVERY_HANDOFF_KEY,
  DISCOVERY_STORAGE_KEY,
  DISCOVERY_STORAGE_VERSION,
  INTAKE_STEP_MAX,
  INTAKE_STEP_MIN,
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
  | { ok: true; state: Extract<PersistenceState, "opted_in">; envelope: StoredDiscoveryEnvelope; notice?: string }
  | { ok: false; state: Exclude<PersistenceState, "opted_in" | "memory">; reason: string };

export function sanitizeIntakeStep(value: unknown): { step: number; recovered: boolean } {
  if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { step: INTAKE_STEP_MIN, recovered: true };
  }
  if (value < INTAKE_STEP_MIN || value > INTAKE_STEP_MAX) {
    return { step: INTAKE_STEP_MIN, recovered: true };
  }
  return { step: value, recovered: false };
}

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
    intakeStep: sanitizeIntakeStep(intakeStep).step
  };
}

export function parseEnvelope(input: unknown): StoredDiscoveryEnvelope | null {
  return parseEnvelopeWithRecovery(input)?.envelope ?? null;
}

export function parseEnvelopeWithRecovery(
  input: unknown
): { envelope: StoredDiscoveryEnvelope; notice: string | null } | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<StoredDiscoveryEnvelope>;
  if (raw.kind !== "discovery_session") return null;
  if (typeof raw.version !== "number" || !(SUPPORTED_STORAGE_VERSIONS as readonly number[]).includes(raw.version)) {
    return null;
  }
  const draft = parseDraft(raw.draft);
  if (!draft) return null;

  const notices: string[] = [];
  let confirmed: DiscoverySelection | null = null;
  if (raw.confirmed != null) {
    confirmed = parseSelection(raw.confirmed);
    if (!confirmed) {
      notices.push("The saved confirmation could not be read. Your answers are still here.");
    }
  }

  const step = sanitizeIntakeStep(raw.intakeStep);
  if (step.recovered) {
    notices.push("The saved question number was not valid. Your answers are still here.");
  }

  let phase: DiscoveryPhase = isDiscoveryPhase(raw.phase) ? raw.phase : "intake";
  if (!isDiscoveryPhase(raw.phase)) {
    notices.push("The saved stage was not valid. Your answers are still here.");
  }
  if (phase === "review" && !confirmed) {
    phase = "studio";
    notices.push("There was no confirmed direction to review, so the studio was opened instead.");
  }
  if (phase === "intake") {
    // Step is already clamped to 0–3 so a question always renders.
  }

  return {
    envelope: {
      version: DISCOVERY_STORAGE_VERSION,
      kind: "discovery_session",
      savedAt: typeof raw.savedAt === "string" ? raw.savedAt : "",
      draft,
      confirmed,
      phase,
      intakeStep: step.step
    },
    notice: notices[0] ?? null
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
    const recovered = parseEnvelopeWithRecovery(parsed);
    if (!recovered) {
      return {
        ok: false,
        state: "malformed",
        reason: "Stored discovery is from an unknown catalog, template, or schema version."
      };
    }
    return {
      ok: true,
      state: "opted_in",
      envelope: recovered.envelope,
      notice: recovered.notice ?? undefined
    };
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

export function writeDiscoveryHandoff(selection: DiscoverySelection, storage: MemoryStorage | null = sessionMemory()) {
  if (!storage) return { ok: false as const };
  try {
    storage.setItem(DISCOVERY_HANDOFF_KEY, JSON.stringify({ kind: "discovery_handoff", selection }));
    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export function readDiscoveryHandoff(storage: MemoryStorage | null = sessionMemory()): DiscoverySelection | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(DISCOVERY_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { kind?: string; selection?: unknown };
    if (parsed.kind !== "discovery_handoff") return null;
    return parseSelection(parsed.selection);
  } catch {
    return null;
  }
}

export function sessionMemory(): MemoryStorage | null {
  try {
    if (typeof window === "undefined" || !window.sessionStorage) return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
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
