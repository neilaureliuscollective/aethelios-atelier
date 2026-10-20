import { describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionUsage, withProcessLock } from "@/lib/cofounder/usage";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { LimitError } from "@/lib/domain/errors";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";
import { encodeSolidPng } from "@/lib/cofounder/png";

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

  it("does not let a stale release overwrite a settled event", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const usage = new CompanionUsage(store);
    const held = await usage.reserve(ctx.business.id, owner, "talk", 1, {}, "race-me");
    const settled = await usage.settle(held);
    expect(settled.status).toBe("settled");
    const released = await usage.release({ event: { ...held.event, status: "held" } });
    expect(released.status).toBe("settled");
    expect((await store.companion.getUsageEvent(held.event.id))?.status).toBe("settled");
    expect(await usage.recoverExpiredHolds()).toBe(0);
    const duplicate = await usage.settle({ event: settled });
    expect(duplicate.status).toBe("settled");
  });

  it("does not let expiry revive or overwrite a settled event, and settlement cannot revive a release", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const usage = new CompanionUsage(store);
    const held = await usage.reserve(ctx.business.id, owner, "image", 1, {}, "expire-race");
    await store.companion.updateUsageEvent({
      ...held.event,
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      status: "held"
    });
    const [settled, expired] = await Promise.allSettled([usage.settle(held), usage.recoverExpiredHolds()]);
    const current = await store.companion.getUsageEvent(held.event.id);
    expect(current?.status === "settled" || current?.status === "released").toBe(true);
    if (current?.status === "settled") {
      expect(settled.status).toBe("fulfilled");
      expect(await usage.release({ event: { ...held.event, status: "held" } })).toMatchObject({ status: "settled" });
      expect(await usage.recoverExpiredHolds()).toBe(0);
    } else {
      expect(expired.status).toBe("fulfilled");
      await expect(usage.settle(held)).rejects.toBeInstanceOf(LimitError);
    }
    const released = await usage.reserve(ctx.business.id, owner, "talk", 1, {}, "already-released");
    await usage.release(released);
    await expect(usage.settle(released)).rejects.toBeInstanceOf(LimitError);
    expect((await store.companion.getUsageEvent(released.event.id))?.status).toBe("released");
  });

  it("lets only one generate take the last pending slot", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "1";
    const session = {
      user: owner,
      session: {
        id: `sess_${owner.id}_slot`,
        userId: owner.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      },
      adapter: "simulated" as const
    };
    await store.createSession(session.session);
    let calls = 0;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let continueGenerate!: () => void;
    const hold = new Promise<void>((resolve) => {
      continueGenerate = resolve;
    });
    const studio = new CompanionStudio(store).withImageProvider({
      async generate() {
        calls += 1;
        release();
        await hold;
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "slot" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const first = await studio.createFromCopy(ctx.business.id, owner, { headline: "Slot A" });
    const second = await studio.createFromCopy(ctx.business.id, owner, { headline: "Slot B" });
    const pending = studio.generate(ctx.business.id, owner, session, {
      draftId: first.draft.id,
      prompt: "a",
      idempotencyKey: "mem-slot-a"
    });
    await started;
    await expect(
      studio.generate(ctx.business.id, owner, session, {
        draftId: second.draft.id,
        prompt: "b",
        idempotencyKey: "mem-slot-b"
      })
    ).rejects.toBeInstanceOf(LimitError);
    expect(calls).toBe(1);
    continueGenerate();
    expect((await pending).asset.status).toBe("ready");
    delete process.env.ATELIER_PLAN_IMAGE_LIMIT;
    delete process.env.ATELIER_MAX_CONCURRENT_GENERATIONS;
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
