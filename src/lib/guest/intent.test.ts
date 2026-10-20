import { describe, expect, it } from "vitest";
import { parseGuestIntent } from "@/lib/guest/intent";

describe("guest intent", () => {
  it("keeps destination on the approved allowlist and omits private payloads", () => {
    const parsed = parseGuestIntent({
      version: 1,
      kind: "guest_intent",
      guestWorkId: "dsel_abc",
      destination: "/companion/confirm",
      selectionId: "dsel_abc",
      localRevision: 2,
      businessName: "should never be required"
    });
    expect(parsed?.destination).toBe("/companion/confirm");
    expect(parsed?.guestWorkId).toBe("dsel_abc");
    expect(JSON.stringify(parsed)).not.toContain("should never be required");
    expect(parseGuestIntent({ version: 1, kind: "guest_intent", guestWorkId: "x", destination: "https://evil" })?.destination).toBe(
      "/companion/confirm"
    );
  });
});
