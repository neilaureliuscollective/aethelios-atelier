import { briefsEqual } from "@/lib/client/briefDiff";
import { identitiesMatch, type OperationIdentity } from "@/lib/client/operationIdentity";
import { ownerFence } from "@/lib/client/ownerFence";
import { readOwnerJson, writeOwnerJson } from "@/lib/client/ownerScope";
import type { SaveStatus } from "@/lib/client/saveQueue";
import type { Brief } from "@/lib/types";

export type DraftRecovery = {
  localBrief: Brief;
  acknowledgedBrief: Brief;
  acknowledgedVersion: number;
  unconfirmed: boolean;
  updatedAt: string;
};

export type DraftSessionState = {
  brief: Brief;
  acknowledgedBrief: Brief;
  acknowledgedVersion: number;
  status: SaveStatus;
  consent: boolean;
  consentVersion: number | null;
  recoveryOpen: boolean;
  conflictOpen: boolean;
  serverBrief: Brief | null;
  conflictServerVersion: number | null;
  lastError: string | null;
};

export type RemoteApplyResult = "applied" | "ignored" | "stale" | "needs_review" | "kept_local";

function nowIso() {
  return new Date().toISOString();
}

function storageAllowed(identity: OperationIdentity) {
  return ownerFence.allowsStorageWrite(identity);
}

export class DraftSession {
  identity: OperationIdentity;
  localBrief: Brief;
  acknowledgedBrief: Brief;
  acknowledgedVersion: number;
  status: SaveStatus;
  consent = false;
  consentVersion: number | null = null;
  recoveryOpen = false;
  conflictOpen = false;
  serverBrief: Brief | null = null;
  conflictServerVersion: number | null = null;
  lastError: string | null = null;
  private listeners = new Set<() => void>();
  disposed = false;

  constructor(identity: OperationIdentity, serverBrief: Brief, serverVersion: number, recovery?: DraftRecovery | null) {
    this.identity = identity;
    this.acknowledgedBrief = serverBrief;
    this.acknowledgedVersion = serverVersion;
    const recovered = recovery?.localBrief;
    const hasLocal =
      Boolean(recovery?.unconfirmed) && recovered && !briefsEqual(recovered, serverBrief);
    if (hasLocal && recovered) {
      this.localBrief = recovered;
      this.status = "unsaved";
      this.recoveryOpen = true;
      this.serverBrief = serverBrief;
    } else {
      this.localBrief = serverBrief;
      this.status = "saved";
    }
  }

  get isUnconfirmed() {
    return !briefsEqual(this.localBrief, this.acknowledgedBrief) || this.status !== "saved";
  }

  get reviewRequired() {
    return this.recoveryOpen || this.conflictOpen;
  }

  get canConsent() {
    return !this.isUnconfirmed && this.status === "saved" && !this.reviewRequired;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): DraftSessionState {
    return {
      brief: this.localBrief,
      acknowledgedBrief: this.acknowledgedBrief,
      acknowledgedVersion: this.acknowledgedVersion,
      status: this.status,
      consent: this.consent,
      consentVersion: this.consentVersion,
      recoveryOpen: this.recoveryOpen,
      conflictOpen: this.conflictOpen,
      serverBrief: this.serverBrief,
      conflictServerVersion: this.conflictServerVersion,
      lastError: this.lastError
    };
  }

  dispose() {
    this.disposed = true;
    this.listeners.clear();
  }

  applyLocalEdit(next: Brief) {
    if (this.disposed) return { ok: false as const, reason: "disposed" as const };
    this.localBrief = next;
    this.invalidateConsent();
    if (!this.reviewRequired && this.status !== "saving") {
      this.status = "unsaved";
    }
    const stored = this.persist();
    this.emit();
    return stored;
  }

  /** An earlier acknowledgment must never replace newer local edits or rewind the accepted revision. */
  acknowledge(payload: Brief, version: number, captured: OperationIdentity) {
    if (this.disposed) return "ignored" as const;
    if (!identitiesMatch(captured, this.identity)) return "ignored" as const;
    if (!storageAllowed(captured)) return "ignored" as const;
    const classified = this.classifyRemote(payload, version);
    if (classified === "stale") return "stale" as const;
    if (classified === "inconsistent") {
      this.openReview(
        payload,
        version,
        "The saved copy for this revision does not match what this device already acknowledged. Your current text is still here. Review both before replacing either."
      );
      return "needs_review" as const;
    }
    this.acknowledgedBrief = payload;
    this.acknowledgedVersion = version;
    this.lastError = null;
    if (briefsEqual(this.localBrief, payload)) {
      this.status = "saved";
      this.recoveryOpen = false;
      this.conflictOpen = false;
      this.serverBrief = null;
      this.conflictServerVersion = null;
    } else if (!this.reviewRequired) {
      this.status = "unsaved";
    }
    this.persist();
    this.emit();
    return "applied" as const;
  }

  markSaving(captured?: OperationIdentity) {
    if (this.disposed) return;
    if (captured && !identitiesMatch(captured, this.identity)) return;
    if (this.reviewRequired) return;
    this.status = "saving";
    this.emit();
  }

  markUncertain(message: string, captured: OperationIdentity) {
    if (this.disposed || !identitiesMatch(captured, this.identity)) return;
    this.status = "uncertain";
    this.lastError = message;
    this.persist();
    this.emit();
  }

  enterConflict(serverBrief: Brief, serverVersion: number, captured: OperationIdentity) {
    if (this.disposed || !identitiesMatch(captured, this.identity)) return;
    this.openReview(
      serverBrief,
      serverVersion,
      "A newer saved copy exists. Your current text is still here. Review both before replacing either."
    );
  }

  keepLocalAfterCompare() {
    if (this.disposed) return this.conflictServerVersion ?? this.acknowledgedVersion;
    const serverVersion = this.conflictServerVersion ?? this.acknowledgedVersion;
    this.recoveryOpen = false;
    this.conflictOpen = false;
    this.status = "unsaved";
    this.invalidateConsent();
    this.persist();
    this.emit();
    return serverVersion;
  }

  takeServerCopy() {
    if (this.disposed || !this.serverBrief) return;
    this.localBrief = this.serverBrief;
    this.acknowledgedBrief = this.serverBrief;
    if (this.conflictServerVersion != null) {
      this.acknowledgedVersion = this.conflictServerVersion;
    }
    this.recoveryOpen = false;
    this.conflictOpen = false;
    this.status = "saved";
    this.serverBrief = null;
    this.conflictServerVersion = null;
    this.lastError = null;
    this.invalidateConsent();
    this.persist();
    this.emit();
  }

  applyAcceptedBrief(next: Brief, version: number, captured: OperationIdentity) {
    if (this.disposed) return "ignored" as const;
    if (!identitiesMatch(captured, this.identity)) return "ignored" as const;
    if (!storageAllowed(captured)) return "ignored" as const;
    const classified = this.classifyRemote(next, version);
    if (classified === "stale") return "stale" as const;
    if (classified === "inconsistent") {
      this.openReview(
        next,
        version,
        "The saved copy for this revision does not match what this device already acknowledged. Your current text is still here. Review both before replacing either."
      );
      return "needs_review" as const;
    }
    if (!briefsEqual(this.localBrief, this.acknowledgedBrief)) {
      this.openReview(
        next,
        version,
        "A suggestion was stored while you were still editing. Your current text is still here. Review both before replacing either."
      );
      return "needs_review" as const;
    }
    this.localBrief = next;
    this.acknowledgedBrief = next;
    this.acknowledgedVersion = version;
    this.status = "saved";
    this.invalidateConsent();
    this.persist();
    this.emit();
    return "applied" as const;
  }

  syncRemoteProject(serverBrief: Brief, serverVersion: number, captured: OperationIdentity) {
    if (this.disposed) return "ignored" as const;
    if (!identitiesMatch(captured, this.identity)) return "ignored" as const;
    if (!storageAllowed(captured)) return "ignored" as const;
    const classified = this.classifyRemote(serverBrief, serverVersion);
    if (classified === "stale") return "stale" as const;
    if (classified === "inconsistent") {
      this.openReview(
        serverBrief,
        serverVersion,
        "The saved copy for this revision does not match what this device already acknowledged. Your current text is still here. Review both before replacing either."
      );
      return "needs_review" as const;
    }
    if (
      briefsEqual(this.localBrief, this.acknowledgedBrief) &&
      briefsEqual(this.localBrief, serverBrief) &&
      this.acknowledgedVersion === serverVersion
    ) {
      return "applied" as const;
    }
    if (briefsEqual(this.localBrief, this.acknowledgedBrief)) {
      return this.applyAcceptedBrief(serverBrief, serverVersion, captured);
    }
    if (!briefsEqual(serverBrief, this.localBrief) && !briefsEqual(serverBrief, this.acknowledgedBrief)) {
      this.enterConflict(serverBrief, serverVersion, captured);
      return "needs_review" as const;
    }
    return "kept_local" as const;
  }

  invalidateConsent() {
    this.consent = false;
    this.consentVersion = null;
  }

  grantConsent() {
    if (!this.canConsent) return false;
    this.consent = true;
    this.consentVersion = this.acknowledgedVersion;
    this.emit();
    return true;
  }

  setConsent(checked: boolean) {
    if (this.disposed) return false;
    if (!checked) {
      this.invalidateConsent();
      this.emit();
      return true;
    }
    return this.grantConsent();
  }

  persist() {
    return this.persistFor(this.identity);
  }

  persistFor(identity: OperationIdentity) {
    if (!storageAllowed(identity)) return { ok: false as const, reason: "signed-out" as const };
    return writeOwnerJson(
      identity.ownerId,
      "draft",
      {
        localBrief: this.localBrief,
        acknowledgedBrief: this.acknowledgedBrief,
        acknowledgedVersion: this.acknowledgedVersion,
        unconfirmed: !briefsEqual(this.localBrief, this.acknowledgedBrief) || this.status !== "saved",
        updatedAt: nowIso()
      } satisfies DraftRecovery,
      identity.projectId
    );
  }

  private classifyRemote(serverBrief: Brief, serverVersion: number) {
    if (serverVersion < this.acknowledgedVersion) return "stale" as const;
    if (serverVersion === this.acknowledgedVersion && !briefsEqual(serverBrief, this.acknowledgedBrief)) {
      return "inconsistent" as const;
    }
    return "usable" as const;
  }

  private openReview(serverBrief: Brief, serverVersion: number, message: string) {
    this.recoveryOpen = true;
    this.conflictOpen = true;
    this.status = "conflict";
    this.serverBrief = serverBrief;
    this.conflictServerVersion = serverVersion;
    this.lastError = message;
    this.invalidateConsent();
    this.persist();
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}

export function acknowledgeStoredRecovery(
  identity: OperationIdentity,
  payload: Brief,
  version: number
) {
  if (!storageAllowed(identity)) {
    return { ok: false as const, reason: "signed-out" as const };
  }
  const existing = loadDraftRecovery(identity.ownerId, identity.projectId);
  if (existing && version < existing.acknowledgedVersion) {
    return { ok: true as const, ignored: "stale" as const };
  }
  if (
    existing &&
    version === existing.acknowledgedVersion &&
    existing.acknowledgedBrief &&
    !briefsEqual(existing.acknowledgedBrief, payload)
  ) {
    return { ok: true as const, ignored: "inconsistent" as const };
  }
  const local =
    existing?.localBrief && !briefsEqual(existing.localBrief, payload) ? existing.localBrief : payload;
  return writeOwnerJson(
    identity.ownerId,
    "draft",
    {
      localBrief: local,
      acknowledgedBrief: payload,
      acknowledgedVersion: version,
      unconfirmed: !briefsEqual(local, payload),
      updatedAt: nowIso()
    } satisfies DraftRecovery,
    identity.projectId
  );
}

export function loadDraftRecovery(ownerId: string, projectId: string) {
  const modern = readOwnerJson<DraftRecovery>(ownerId, "draft", projectId);
  if (modern?.localBrief && modern.acknowledgedBrief) return modern;
  const legacy = readOwnerJson<{ brief: Brief; acknowledgedVersion: number; unconfirmed?: boolean; updatedAt: string }>(
    ownerId,
    "draft",
    projectId
  );
  if (!legacy?.brief) return null;
  return {
    localBrief: legacy.brief,
    acknowledgedBrief: legacy.brief,
    acknowledgedVersion: legacy.acknowledgedVersion,
    unconfirmed: Boolean(legacy.unconfirmed),
    updatedAt: legacy.updatedAt
  } satisfies DraftRecovery;
}
