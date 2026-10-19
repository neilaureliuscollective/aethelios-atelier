import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { DraftSession, acknowledgeStoredRecovery, loadDraftRecovery } from "@/lib/client/draftSession";
import type { OperationIdentity } from "@/lib/client/operationIdentity";

function brief(vision: string) {
  const next = createEmptyBrief();
  next.vision.value = vision;
  next.vision.provenance = vision ? "client_statement" : "empty";
  return next;
}

function identity(overrides: Partial<OperationIdentity> = {}): OperationIdentity {
  return { ownerId: "owner-a", projectId: "prj-1", generation: 1, ...overrides };
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

describe("stored recovery acknowledgments", () => {
  it("does not let an older payload replace newer durable edits in storage", () => {
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
    const id = identity();
    writeInitial();
    function writeInitial() {
      const session = new DraftSession(id, brief("start"), 1);
      session.applyLocalEdit(brief("latest typing"));
    }
    acknowledgeStoredRecovery(id, brief("first"), 2);
    const loaded = loadDraftRecovery(id.ownerId, id.projectId);
    expect(loaded?.localBrief.vision.value).toBe("latest typing");
    expect(loaded?.acknowledgedBrief.vision.value).toBe("first");
    expect(loaded?.unconfirmed).toBe(true);
    delete (globalThis as { window?: unknown }).window;
  });
});
