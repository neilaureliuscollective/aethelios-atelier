import { describe, expect, it } from "vitest";
import { OwnerFence } from "@/lib/client/ownerFence";

describe("account fence", () => {
  it("hides the previous owner immediately and ignores delayed generations", () => {
    const fence = new OwnerFence();
    const first = fence.switchTo("owner-a");
    expect(fence.isCurrent(first, "owner-a")).toBe(true);
    const second = fence.switchTo("owner-b");
    expect(fence.isCurrent(first, "owner-a")).toBe(false);
    expect(fence.isCurrent(second, "owner-b")).toBe(true);
    fence.switchTo(null);
    expect(fence.isCurrent(second, "owner-b")).toBe(false);
  });

  it("treats explicit sign-out as a storage invalidation boundary", () => {
    const fence = new OwnerFence();
    fence.switchTo("owner-a");
    const captured = fence.capture();
    expect(captured.ownerId).toBe("owner-a");
    fence.markSignOut("owner-a");
    expect(fence.allowsStorageWrite({ ownerId: "owner-a", signOutEpoch: captured.signOutEpoch })).toBe(false);
    expect(fence.ownerId).toBeNull();
  });
});
