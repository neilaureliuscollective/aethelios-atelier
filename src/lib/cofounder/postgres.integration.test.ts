import { afterEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { encodeSolidPng } from "@/lib/cofounder/png";
import { ConflictError, ForbiddenError, LimitError } from "@/lib/domain/errors";
import { PostgresPersistence } from "@/lib/persistence/postgres";
import type { AuthContext, User } from "@/lib/types";

const url = process.env.ATELIER_LOCAL_POSTGRES_URL || "";
const isolated = Boolean(url) && !/neon|vercel|supabase|amazonaws|railway|render/i.test(url);

function authFor(user: User): AuthContext {
  return {
    user,
    session: {
      id: `sess_${user.id}_${crypto.randomUUID()}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    },
    adapter: "simulated"
  };
}

async function openStores() {
  const storeA = new PostgresPersistence(url);
  const storeB = new PostgresPersistence(url);
  await storeA.initialize();
  await storeB.initialize();
  await storeA.resetForTests();
  await seedSimulatedUsers(storeA, ["neil.local@atelier.invalid"]);
  const owner = (await storeA.getUserByEmail("owner.local@atelier.invalid")) as User;
  const authA = authFor(owner);
  const authB = authFor(owner);
  await storeA.createSession(authA.session);
  await storeB.createSession(authB.session);
  const ctx = await new CompanionWorkspace(storeA).ensureForUser(owner);
  return { storeA, storeB, owner, authA, authB, ctx };
}

describe.skipIf(!isolated)("PostgreSQL companion integration", () => {
  afterEach(() => {
    delete process.env.ATELIER_PLAN_IMAGE_LIMIT;
    delete process.env.ATELIER_MAX_CONCURRENT_GENERATIONS;
  });

  it("lets only one of two connections take the last pending slot", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "1";
    const { storeA, storeB, owner, authA, authB, ctx } = await openStores();
    let calls = 0;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let continueGenerate!: () => void;
    const hold = new Promise<void>((resolve) => {
      continueGenerate = resolve;
    });
    const provider = {
      async generate() {
        calls += 1;
        release();
        await hold;
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-latch" };
      },
      async edit() {
        return this.generate();
      }
    };
    const studioA = new CompanionStudio(storeA).withImageProvider(provider);
    const studioB = new CompanionStudio(storeB).withImageProvider(provider);
    const first = await studioA.createFromCopy(ctx.business.id, owner, { headline: "Slot A" });
    const second = await studioB.createFromCopy(ctx.business.id, owner, { headline: "Slot B" });
    const pendingA = studioA.generate(ctx.business.id, owner, authA, {
      draftId: first.draft.id,
      prompt: "a",
      idempotencyKey: "pg-slot-a"
    });
    await started;
    await expect(
      studioB.generate(ctx.business.id, owner, authB, {
        draftId: second.draft.id,
        prompt: "b",
        idempotencyKey: "pg-slot-b"
      })
    ).rejects.toBeInstanceOf(LimitError);
    expect(calls).toBe(1);
    continueGenerate();
    expect((await pendingA).asset.status).toBe("ready");
  }, 60_000);

  it("lets only one of two connections consume the last allowance", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "1";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "2";
    const { storeA, storeB, owner, ctx } = await openStores();
    const usageA = new CompanionUsage(storeA);
    const usageB = new CompanionUsage(storeB);
    const [one, two] = await Promise.allSettled([
      usageA.reserve(ctx.business.id, owner, "image", 1, {}, "pg-last-a"),
      usageB.reserve(ctx.business.id, owner, "image", 1, {}, "pg-last-b")
    ]);
    expect([one, two].filter((item) => item.status === "fulfilled")).toHaveLength(1);
    const rejected = [one, two].find((item) => item.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(LimitError);
    const sameA = await usageA.reserve(ctx.business.id, owner, "talk", 1, {}, "dup-op");
    const sameB = await usageB.reserve(ctx.business.id, owner, "talk", 1, {}, "dup-op");
    expect(sameB.event.id).toBe(sameA.event.id);
    const settled = await usageA.settle(sameA);
    expect((await usageB.release({ event: { ...sameA.event, status: "held" } })).status).toBe("settled");
    expect(settled.status).toBe("settled");
  }, 60_000);

  it("keeps a late generation off a draft edited on the other connection", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "1";
    const { storeA, storeB, owner, authA, ctx } = await openStores();
    const studioA = new CompanionStudio(storeA);
    const studioB = new CompanionStudio(storeB);
    const created = await studioA.createFromCopy(ctx.business.id, owner, { headline: "Before generate" });
    let genRelease!: () => void;
    const genStarted = new Promise<void>((resolve) => {
      genRelease = resolve;
    });
    let genContinue!: () => void;
    const genHold = new Promise<void>((resolve) => {
      genContinue = resolve;
    });
    const lateStudio = new CompanionStudio(storeA).withImageProvider({
      async generate() {
        genRelease();
        await genHold;
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-late" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const latePending = lateStudio.generate(ctx.business.id, owner, authA, {
      draftId: created.draft.id,
      prompt: "late",
      idempotencyKey: "pg-late-gen"
    });
    await genStarted;
    await studioB.updateDraft(ctx.business.id, owner, created.draft.id, {
      layers: created.draft.layers.map((layer) =>
        layer.kind === "headline" ? { ...layer, text: "Edited on the other connection" } : layer
      ),
      expectedSaveRevision: created.draft.saveRevision
    });
    genContinue();
    const late = await latePending;
    expect(late.applied).toBe(false);
    const latest = await storeA.companion.getStudioDraft(created.draft.id);
    expect(latest?.layers.find((layer) => layer.kind === "headline")?.text).toBe("Edited on the other connection");
    await expect(
      studioB.updateDraft(ctx.business.id, owner, created.draft.id, {
        layers: created.draft.layers,
        expectedSaveRevision: created.draft.saveRevision
      })
    ).rejects.toBeInstanceOf(ConflictError);
  }, 60_000);

  it("keeps settle, release, and expiry race-safe across two connections", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    const { storeA, storeB, owner, ctx } = await openStores();
    const usageA = new CompanionUsage(storeA);
    const usageB = new CompanionUsage(storeB);
    const held = await usageA.reserve(ctx.business.id, owner, "image", 1, {}, "pg-life");
    await storeA.companion.updateUsageEvent({
      ...held.event,
      expiresAt: new Date(Date.now() - 50).toISOString(),
      status: "held"
    });
    const [settled, expired] = await Promise.allSettled([
      usageA.settle(held),
      usageB.recoverExpiredHolds()
    ]);
    const current = await storeA.companion.getUsageEvent(held.event.id);
    expect(current?.status === "settled" || current?.status === "released").toBe(true);
    if (current?.status === "settled") {
      expect(settled.status).toBe("fulfilled");
      expect((await usageB.release({ event: { ...held.event, status: "held" } })).status).toBe("settled");
    } else {
      expect(expired.status).toBe("fulfilled");
      await expect(usageA.settle(held)).rejects.toBeInstanceOf(LimitError);
    }
    const failed = await usageA.reserve(ctx.business.id, owner, "image", 1, {}, "pg-fail");
    await usageA.release(failed);
    await expect(usageB.settle(failed)).rejects.toBeInstanceOf(LimitError);
    expect((await storeB.companion.getUsageEvent(failed.event.id))?.status).toBe("released");
    const again = await usageA.reserve(ctx.business.id, owner, "image", 1, {}, "pg-fail");
    expect(again.event.id).toBe(failed.event.id);
    expect(again.event.status).toBe("held");
  }, 60_000);

  it("does not start a second provider call for a duplicate operation id", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "2";
    const { storeA, storeB, owner, authA, authB, ctx } = await openStores();
    let calls = 0;
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let continueGenerate!: () => void;
    const hold = new Promise<void>((resolve) => {
      continueGenerate = resolve;
    });
    const provider = {
      async generate() {
        calls += 1;
        release();
        await hold;
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-dup" };
      },
      async edit() {
        return this.generate();
      }
    };
    const studioA = new CompanionStudio(storeA).withImageProvider(provider);
    const studioB = new CompanionStudio(storeB).withImageProvider(provider);
    const created = await studioA.createFromCopy(ctx.business.id, owner, { headline: "Dup" });
    const pending = studioA.generate(ctx.business.id, owner, authA, {
      draftId: created.draft.id,
      prompt: "dup",
      idempotencyKey: "pg-dup-op"
    });
    await started;
    await expect(
      studioB.generate(ctx.business.id, owner, authB, {
        draftId: created.draft.id,
        prompt: "dup",
        idempotencyKey: "pg-dup-op"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect(calls).toBe(1);
    continueGenerate();
    expect((await pending).applied).toBe(true);
  }, 60_000);
});
