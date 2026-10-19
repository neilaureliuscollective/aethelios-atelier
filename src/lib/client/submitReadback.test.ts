import { describe, expect, it } from "vitest";
import { identityFor } from "@/lib/client/operationIdentity";
import { OwnerFence } from "@/lib/client/ownerFence";
import { classifySubmitFailure } from "@/lib/client/submitCommand";
import { canCommitSubmitReadback, classifyVerificationFailure } from "@/lib/client/submitReadback";

describe("submit readback fencing", () => {
  it("allows archive only for the captured account, project, and operation", () => {
    const fence = new OwnerFence();
    fence.switchTo("usr_1");
    const captured = identityFor("usr_1", "prj_1", fence);
    expect(
      canCommitSubmitReadback({
        captured,
        current: captured,
        fence,
        submitToken: 1,
        currentToken: 1
      })
    ).toBe(true);
  });

  it("blocks archive after a held readback and explicit sign-out", () => {
    const fence = new OwnerFence();
    fence.switchTo("usr_1");
    const captured = identityFor("usr_1", "prj_1", fence);
    fence.markSignOut("usr_1");
    expect(
      canCommitSubmitReadback({
        captured,
        current: captured,
        fence,
        submitToken: 1,
        currentToken: 1
      })
    ).toBe(false);
  });

  it("blocks a late readback for a superseded submit token", () => {
    const fence = new OwnerFence();
    fence.switchTo("usr_1");
    const captured = identityFor("usr_1", "prj_1", fence);
    expect(
      canCommitSubmitReadback({
        captured,
        current: captured,
        fence,
        submitToken: 1,
        currentToken: 2
      })
    ).toBe(false);
  });
});

describe("POST rejection vs verification failure", () => {
  it("still treats a POST 409 consent conflict as rejected", () => {
    expect(
      classifySubmitFailure({ status: 409, code: "conflict", message: "This consent applies to a different saved revision." }, "post")
    ).toBe("rejected");
    expect(classifySubmitFailure({ status: 403, message: "forbidden" }, "post")).toBe("rejected");
  });

  it("keeps GET 403, 409, and network failures unverified with the original command pending", () => {
    expect(classifyVerificationFailure({ status: 403, message: "forbidden" })).toBe("uncertain");
    expect(classifyVerificationFailure({ status: 409, code: "conflict", message: "conflict" })).toBe("uncertain");
    expect(classifyVerificationFailure({ message: "Failed to fetch" })).toBe("uncertain");
    expect(classifySubmitFailure({ status: 403, message: "forbidden" }, "verify")).toBe("uncertain");
    expect(classifySubmitFailure({ status: 409, message: "conflict" }, "verify")).toBe("uncertain");
    expect(classifySubmitFailure({ message: "network down" }, "verify")).toBe("uncertain");
  });
});
