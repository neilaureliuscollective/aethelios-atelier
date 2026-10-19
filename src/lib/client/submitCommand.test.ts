import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { buildSubmitCommand } from "@/lib/client/submitCommand";
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
});
