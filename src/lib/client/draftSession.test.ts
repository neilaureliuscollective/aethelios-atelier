import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { briefsEqual } from "@/lib/client/briefDiff";
import { DraftSession, acknowledgeStoredRecovery, loadDraftRecovery } from "@/lib/client/draftSession";
import type { OperationIdentity } from "@/lib/client/operationIdentity";
import { OwnerFence, ownerFence } from "@/lib/client/ownerFence";
import { clearOwnerScopedData } from "@/lib/client/ownerScope";

function brief(vision: string) {
  const next = createEmptyBrief();
  next.vision.value = vision;
  next.vision.provenance = vision ? "client_statement" : "empty";
  return next;
}

function identity(overrides: Partial<OperationIdentity> = {}): OperationIdentity {
  return { ownerId: "owner-a", projectId: "prj-1", generation: 1, signOutEpoch: 0, ...overrides };
}

function installMemoryStorage() {
  const store: Record<string, string> = {};
  const sessionStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear() {
      for (const key of Object.keys(store)) delete store[key];
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    }
  };
  (globalThis as { window: unknown }).window = { sessionStorage, localStorage: sessionStorage };
  return store;
}

/** Documents the defect: an older snapshot was applied whenever local matched acknowledged. */
function legacySyncRemote(
  local: ReturnType<typeof brief>,
  acknowledged: ReturnType<typeof brief>,
  _acknowledgedVersion: number,
  server: ReturnType<typeof brief>,
  serverVersion: number
) {
  if (briefsEqual(local, acknowledged)) {
    return { applied: true, brief: server, version: serverVersion };
  }
  return { applied: false };
}

describe("draft session recovery", () => {
  it("does not present recovered unconfirmed text as saved", () => {
    const server = brief("server copy");
    const session = new DraftSession(identity(), server, 4, {
      localBrief: brief("local typing"),
      acknowledgedBrief: server,
      acknowledgedVersion: 3,
      unconfirmed: true,
      updatedAt: new Date().toISOString()
    });
    expect(session.status).toBe("unsaved");
    expect(session.recoveryOpen).toBe(true);
    expect(session.reviewRequired).toBe(true);
    expect(session.localBrief.vision.value).toBe("local typing");
    expect(session.snapshot().status).not.toBe("saved");
    expect(session.consent).toBe(false);
  });

  it("keeps newer local edits when an earlier save is acknowledged", () => {
    const session = new DraftSession(identity(), brief("start"), 1);
    session.applyLocalEdit(brief("first"));
    session.applyLocalEdit(brief("latest typing"));
    const result = session.acknowledge(brief("first"), 2, identity());
    expect(result).toBe("applied");
    expect(session.acknowledgedVersion).toBe(2);
    expect(session.localBrief.vision.value).toBe("latest typing");
    expect(session.status).toBe("unsaved");
    expect(session.acknowledgedBrief.vision.value).toBe("first");
  });

  it("ignores an acknowledgment captured for another project or generation", () => {
    const session = new DraftSession(identity(), brief("start"), 1);
    session.applyLocalEdit(brief("kept"));
    expect(session.acknowledge(brief("other"), 9, identity({ projectId: "prj-2" }))).toBe("ignored");
    expect(session.acknowledge(brief("other"), 9, identity({ generation: 2 }))).toBe("ignored");
    expect(session.acknowledge(brief("other"), 9, identity({ signOutEpoch: 1 }))).toBe("ignored");
    expect(session.localBrief.vision.value).toBe("kept");
    expect(session.acknowledgedVersion).toBe(1);
  });

  it("invalidates consent after typing, restoration, and accepted suggestions", () => {
    const session = new DraftSession(identity(), brief("ready"), 2);
    expect(session.grantConsent()).toBe(true);
    session.applyLocalEdit(brief("typed"));
    expect(session.consent).toBe(false);
    session.acknowledge(brief("typed"), 3, identity());
    expect(session.grantConsent()).toBe(true);
    session.applyAcceptedBrief(brief("from suggestion"), 4, identity());
    expect(session.consent).toBe(false);
  });

  it("asks for review when a suggestion lands after newer typing", () => {
    const session = new DraftSession(identity(), brief("base"), 1);
    session.applyLocalEdit(brief("newer typing"));
    const result = session.applyAcceptedBrief(brief("suggestion applied"), 2, identity());
    expect(result).toBe("needs_review");
    expect(session.localBrief.vision.value).toBe("newer typing");
    expect(session.recoveryOpen).toBe(true);
    expect(session.reviewRequired).toBe(true);
    expect(session.consent).toBe(false);
  });

  it("refuses consent until the visible brief matches the acknowledged snapshot", () => {
    const session = new DraftSession(identity(), brief("ready"), 2);
    session.applyLocalEdit(brief("unconfirmed"));
    expect(session.grantConsent()).toBe(false);
    session.acknowledge(brief("unconfirmed"), 3, identity());
    expect(session.grantConsent()).toBe(true);
  });
});

describe("monotonic remote revisions", () => {
  it("legacy sync replaced revision 3 with a delayed revision 2 when local matched acknowledged", () => {
    const defect = legacySyncRemote(brief("revision 3 saved"), brief("revision 3 saved"), 3, brief("revision 2 chat"), 2);
    expect(defect.applied).toBe(true);
    expect(defect.version).toBe(2);
  });

  it("does not let a delayed revision-2 chat snapshot replace a saved revision 3", () => {
    const session = new DraftSession(identity(), brief("revision 2 chat"), 2);
    session.applyLocalEdit(brief("revision 3 saved"));
    expect(session.acknowledge(brief("revision 3 saved"), 3, identity())).toBe("applied");
    expect(session.acknowledgedVersion).toBe(3);
    expect(session.status).toBe("saved");
    const result = session.syncRemoteProject(brief("revision 2 chat"), 2, identity());
    expect(result).toBe("stale");
    expect(session.localBrief.vision.value).toBe("revision 3 saved");
    expect(session.acknowledgedVersion).toBe(3);
    expect(session.acknowledgedBrief.vision.value).toBe("revision 3 saved");
    expect(session.status).toBe("saved");
  });

  it("does not let a delayed accepted suggestion rewind a newer acknowledged revision", () => {
    const session = new DraftSession(identity(), brief("saved three"), 3);
    const result = session.applyAcceptedBrief(brief("old suggestion"), 2, identity());
    expect(result).toBe("stale");
    expect(session.localBrief.vision.value).toBe("saved three");
    expect(session.acknowledgedVersion).toBe(3);
    expect(session.status).toBe("saved");
  });

  it("treats equal-version different content as review, not a silent replace", () => {
    const session = new DraftSession(identity(), brief("acknowledged wording"), 3);
    const result = session.syncRemoteProject(brief("other wording at v3"), 3, identity());
    expect(result).toBe("needs_review");
    expect(session.localBrief.vision.value).toBe("acknowledged wording");
    expect(session.acknowledgedBrief.vision.value).toBe("acknowledged wording");
    expect(session.acknowledgedVersion).toBe(3);
    expect(session.reviewRequired).toBe(true);
    expect(session.serverBrief?.vision.value).toBe("other wording at v3");
  });

  it("still applies a newer remote snapshot when local matches the acknowledged copy", () => {
    const session = new DraftSession(identity(), brief("saved two"), 2);
    const result = session.applyAcceptedBrief(brief("suggestion at three"), 3, identity());
    expect(result).toBe("applied");
    expect(session.localBrief.vision.value).toBe("suggestion at three");
    expect(session.acknowledgedVersion).toBe(3);
  });

  it("preserves typing during unresolved comparison without clearing the review gate", () => {
    const session = new DraftSession(identity(), brief("server"), 4, {
      localBrief: brief("device copy"),
      acknowledgedBrief: brief("older ack"),
      acknowledgedVersion: 3,
      unconfirmed: true,
      updatedAt: new Date().toISOString()
    });
    expect(session.reviewRequired).toBe(true);
    session.applyLocalEdit(brief("typed during comparison"));
    expect(session.localBrief.vision.value).toBe("typed during comparison");
    expect(session.reviewRequired).toBe(true);
    expect(session.consent).toBe(false);
    expect(session.acknowledgedVersion).toBe(4);
  });
});

describe("stored recovery acknowledgments", () => {
  it("does not let an older payload replace newer durable edits in storage", () => {
    const store = installMemoryStorage();
    const id = identity();
    const session = new DraftSession(id, brief("start"), 1);
    session.applyLocalEdit(brief("latest typing"));
    acknowledgeStoredRecovery(id, brief("first"), 2);
    const loaded = loadDraftRecovery(id.ownerId, id.projectId);
    expect(loaded?.localBrief.vision.value).toBe("latest typing");
    expect(loaded?.acknowledgedBrief.vision.value).toBe("first");
    expect(loaded?.unconfirmed).toBe(true);
    expect(store).toBeTruthy();
    delete (globalThis as { window?: unknown }).window;
  });

  it("does not recreate recovery after an explicit sign-out invalidation", () => {
    installMemoryStorage();
    const fence = ownerFence;
    const previousOwner = fence.ownerId;
    const previousGeneration = fence.generation;
    const previousEpoch = fence.signOutEpoch;
    fence.switchTo("owner-signout-test");
    const id = identity({
      ownerId: "owner-signout-test",
      generation: fence.generation,
      signOutEpoch: fence.signOutEpoch
    });
    const session = new DraftSession(id, brief("private vision"), 1);
    session.applyLocalEdit(brief("private vision"));
    expect(loadDraftRecovery("owner-signout-test", "prj-1")?.localBrief.vision.value).toBe("private vision");
    fence.markSignOut("owner-signout-test");
    clearOwnerScopedData("owner-signout-test");
    expect(loadDraftRecovery("owner-signout-test", "prj-1")).toBeNull();
    const result = acknowledgeStoredRecovery(id, brief("private vision"), 2);
    expect(result.ok).toBe(false);
    expect(loadDraftRecovery("owner-signout-test", "prj-1")).toBeNull();
    fence.ownerId = previousOwner;
    fence.generation = previousGeneration;
    fence.signOutEpoch = previousEpoch;
    delete (globalThis as { window?: unknown }).window;
  });
});

describe("account fence sign-out", () => {
  it("invalidates delayed storage writes after explicit sign-out but not after switching accounts", () => {
    const fence = new OwnerFence();
    fence.switchTo("owner-a");
    const capturedA = { ownerId: "owner-a" as const, signOutEpoch: fence.signOutEpoch };
    fence.switchTo("owner-b");
    expect(fence.allowsStorageWrite(capturedA)).toBe(true);
    fence.markSignOut("owner-b");
    expect(fence.allowsStorageWrite({ ownerId: "owner-b", signOutEpoch: capturedA.signOutEpoch })).toBe(false);
    expect(fence.allowsStorageWrite(capturedA)).toBe(true);
  });
});
