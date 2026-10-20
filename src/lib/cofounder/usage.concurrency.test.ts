import { describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionUsage, withProcessLock } from "@/lib/cofounder/usage";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";

describe("usage reservation helpers", () => {
  it("is idempotent for the same operation id and recovers expired holds", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const usage = new CompanionUsage(store);
    const first = await usage.reserve(ctx.business.id, owner, "image", 1, {}, "same-op");
    const again = await usage.reserve(ctx.business.id, owner, "image", 1, {}, "same-op");
    expect(again.reused).toBe(true);
    expect(again.event.id).toBe(first.event.id);
    await usage.release(first);
    const expired = await usage.reserve(ctx.business.id, owner, "talk", 1, {}, "expire-me");
    await store.companion.updateUsageEvent({
      ...expired.event,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "held"
    });
    expect(await usage.recoverExpiredHolds()).toBeGreaterThan(0);
    expect((await store.companion.getUsageEvent(expired.event.id))?.status).toBe("released");
    const held = await usage.reserve(ctx.business.id, owner, "talk", 1, {}, "settle-me");
    const settled = await usage.settle(held);
    const replay = await usage.settle({ event: settled });
    expect(replay.status).toBe("settled");
    expect(replay.id).toBe(settled.id);
    await expect(usage.release({ event: settled })).resolves.toMatchObject({ status: "settled" });
  });

  it("clears the process-local lock after the last waiter finishes", async () => {
    const order: number[] = [];
    await Promise.all([
      withProcessLock("k", async () => {
        order.push(1);
      }),
      withProcessLock("k", async () => {
        order.push(2);
      })
    ]);
    expect(order).toEqual([1, 2]);
    await withProcessLock("k", async () => {
      order.push(3);
    });
    expect(order).toEqual([1, 2, 3]);
  });
});
