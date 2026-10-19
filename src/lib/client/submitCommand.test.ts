import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import {
  archiveSubmitCommand,
  buildSubmitCommand,
  loadConfirmedSubmit,
  loadSubmitCommand,
  persistSubmitCommand
} from "@/lib/client/submitCommand";
import { submitFingerprint } from "@/lib/submitFingerprint";

describe("pending submit command", () => {
  it("fingerprints the reviewed revision so a different payload cannot reuse the key", () => {
    const brief = createEmptyBrief();
    brief.vision.value = "Reviewed";
    const command = buildSubmitCommand({
      idempotencyKey: "abc-def-ghi",
      projectId: "prj_1",
      ownerId: "usr_1",
      expectedVersion: 3,
      brief,
      consentText: "consent"
    });
    expect(command.payloadHash).toBe(
      submitFingerprint({
        projectId: "prj_1",
        ownerId: "usr_1",
        expectedVersion: 3,
        brief
      })
    );
    const other = { ...brief, vision: { ...brief.vision, value: "Changed" } };
    expect(
      submitFingerprint({
        projectId: "prj_1",
        ownerId: "usr_1",
        expectedVersion: 3,
        brief: other
      })
    ).not.toBe(command.payloadHash);
  });

  it("archives a pending command after independent receipt confirmation so a later revision gets a new key", () => {
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
    const brief = createEmptyBrief();
    const command = buildSubmitCommand({
      idempotencyKey: "first-key",
      projectId: "prj_1",
      ownerId: "usr_1",
      expectedVersion: 2,
      brief,
      consentText: "consent"
    });
    persistSubmitCommand(command);
    expect(loadSubmitCommand("usr_1", "prj_1")?.idempotencyKey).toBe("first-key");
    archiveSubmitCommand(command, { receiptId: "rcpt_1", submissionId: "sub_1" });
    expect(loadSubmitCommand("usr_1", "prj_1")).toBeNull();
    expect(loadConfirmedSubmit("usr_1", "prj_1")?.receiptId).toBe("rcpt_1");
    delete (globalThis as { window?: unknown }).window;
  });
});
