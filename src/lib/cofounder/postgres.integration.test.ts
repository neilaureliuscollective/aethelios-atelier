import { afterEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { BusinessAdoption } from "@/lib/cofounder/confirmation";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { bypassProcessLockForTests, CompanionUsage } from "@/lib/cofounder/usage";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { GuestWorkService } from "@/lib/guest/claim";
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
  bypassProcessLockForTests();
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

  it("does not let a cancelled finalize select after the provider has returned", async () => {
    const { storeA, storeB, owner, authA, ctx } = await openStores();
    let enteredFinalize!: () => void;
    const sawFinalize = new Promise<void>((resolve) => {
      enteredFinalize = resolve;
    });
    let resumeFinalize!: () => void;
    const holdFinalize = new Promise<void>((resolve) => {
      resumeFinalize = resolve;
    });
    const studioA = new CompanionStudio(storeA)
      .withImageProvider({
        async generate() {
          return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-final" };
        },
        async edit() {
          return this.generate({ prompt: "edit" });
        }
      })
      .withFinalizeBarrier(async () => {
        enteredFinalize();
        await holdFinalize;
      });
    const created = await studioA.createFromCopy(ctx.business.id, owner, { headline: "PG finalize" });
    const pending = studioA.generate(ctx.business.id, owner, authA, {
      draftId: created.draft.id,
      prompt: "pg-final",
      idempotencyKey: "pg-finalize-1"
    });
    await sawFinalize;
    expect(await storeB.companion.invalidateJobsForSession(authA.session.id)).toBe(1);
    resumeFinalize();
    const result = await pending;
    expect(result.applied).toBe(false);
    expect(result.asset.status).toBe("invalidated");
    expect((await storeA.companion.getStudioDraft(created.draft.id))?.selectedAssetId).toBeUndefined();
    expect((await storeB.companion.getJobByIdempotency(ctx.business.id, "pg-finalize-1"))?.status).toBe(
      "invalidated"
    );
  }, 60_000);

  it("does not let the old attempt settle a newer hold after finalize starts", async () => {
    const { storeA, storeB, owner, authA, ctx } = await openStores();
    let enteredFinalize!: () => void;
    const sawFinalize = new Promise<void>((resolve) => {
      enteredFinalize = resolve;
    });
    let resumeFinalize!: () => void;
    const holdFinalize = new Promise<void>((resolve) => {
      resumeFinalize = resolve;
    });
    const studioA = new CompanionStudio(storeA)
      .withImageProvider({
        async generate() {
          return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-retry" };
        },
        async edit() {
          return this.generate({ prompt: "edit" });
        }
      })
      .withFinalizeBarrier(async () => {
        enteredFinalize();
        await holdFinalize;
      });
    const created = await studioA.createFromCopy(ctx.business.id, owner, { headline: "PG retry" });
    const pending = studioA.generate(ctx.business.id, owner, authA, {
      draftId: created.draft.id,
      prompt: "pg-retry",
      idempotencyKey: "pg-finalize-retry"
    });
    await sawFinalize;
    const usage = await storeB.companion.getUsageByOperation(ctx.business.id, "pg-finalize-retry");
    const job = await storeB.companion.getJobByIdempotency(ctx.business.id, "pg-finalize-retry");
    await storeB.companion.updateUsageEvent({
      ...usage!,
      status: "held",
      attempt: 2,
      metadata: { ...usage!.metadata, attempt: 2 }
    });
    await storeB.companion.updateJob({ ...job!, attempt: 2, status: "pending" });
    resumeFinalize();
    const late = await pending;
    expect(late.applied).toBe(false);
    expect((await storeA.companion.getUsageEvent(usage!.id))?.attempt).toBe(2);
    expect((await storeA.companion.getUsageEvent(usage!.id))?.status).toBe("held");
    expect((await storeA.companion.getJob(job!.id))?.status).toBe("pending");
    expect((await storeA.companion.getStudioDraft(created.draft.id))?.selectedAssetId).not.toBe(late.asset.id);
  }, 60_000);

  it("rolls back the PostgreSQL finalization transaction and cleans up only the matching attempt [PostgreSQL]", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "2";
    const { storeA, owner, authA, ctx } = await openStores();
    const okStudio = new CompanionStudio(storeA).withImageProvider({
      async generate() {
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-keep" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const kept = await okStudio.createFromCopy(ctx.business.id, owner, { headline: "Already complete" });
    const completed = await okStudio.generate(ctx.business.id, owner, authA, {
      draftId: kept.draft.id,
      prompt: "keep-me",
      idempotencyKey: "pg-finalize-keep"
    });
    const failing = new CompanionStudio(storeA)
      .withImageProvider({
        async generate() {
          return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-dbfail" };
        },
        async edit() {
          return this.generate({ prompt: "edit" });
        }
      })
      .withFinalizeFault(async () => {
        throw new Error("pg_finalize_down");
      });
    const next = await failing.createFromCopy(ctx.business.id, owner, { headline: "Should stay unsaved" });
    await expect(
      failing.generate(ctx.business.id, owner, authA, {
        draftId: next.draft.id,
        prompt: "dbfail",
        idempotencyKey: "pg-finalize-db"
      })
    ).rejects.toThrow(/pg_finalize_down/);
    const failedDraft = await storeA.companion.getStudioDraft(next.draft.id);
    expect(failedDraft?.selectedAssetId).toBeUndefined();
    expect(failedDraft?.layers.find((layer) => layer.kind === "headline")?.text).toBe("Should stay unsaved");
    expect((await storeA.companion.getJobByIdempotency(ctx.business.id, "pg-finalize-db"))?.status).toBe("failed");
    expect((await storeA.companion.getUsageByOperation(ctx.business.id, "pg-finalize-db"))?.status).toBe("released");
    expect((await storeA.companion.getStudioDraft(kept.draft.id))?.selectedAssetId).toBe(completed.asset.id);
    expect((await storeA.companion.getJobByIdempotency(ctx.business.id, "pg-finalize-keep"))?.status).toBe("completed");
    expect((await storeA.companion.getUsageByOperation(ctx.business.id, "pg-finalize-keep"))?.status).toBe("settled");
  }, 60_000);

  it("claims guest work and adopts one Studio draft under concurrent PostgreSQL transactions", async () => {
    const { storeA, storeB, owner, ctx } = await openStores();
    const other = (await storeA.getUserByEmail("owner-two.local@atelier.invalid")) as User;
    const guestsA = new GuestWorkService(storeA);
    const guestsB = new GuestWorkService(storeB);
    const [claimA, claimB] = await Promise.all([
      guestsA.claim(owner, {
        guestWorkId: "dsel_pg",
        kind: "discovery",
        payload: { selectionId: "dsel_pg", localRevision: 2, selectedDirectionId: "lumen", businessName: "Northridge" }
      }),
      guestsB.claim(owner, {
        guestWorkId: "dsel_pg",
        kind: "discovery",
        payload: { selectionId: "dsel_pg", localRevision: 2, selectedDirectionId: "lumen", businessName: "Northridge" }
      })
    ]);
    expect(claimA.createdAt).toBe(claimB.createdAt);
    await expect(
      guestsB.claim(other, {
        guestWorkId: "dsel_pg",
        kind: "discovery",
        payload: { selectionId: "dsel_pg", localRevision: 2, selectedDirectionId: "hearth" }
      })
    ).rejects.toBeInstanceOf(ForbiddenError);

    const adoptA = new BusinessAdoption(storeA);
    const adoptB = new BusinessAdoption(storeB);
    const [first, second] = await Promise.all([
      adoptA.confirm(ctx.business.id, owner, {
        businessName: "Northridge",
        businessContext: "A quiet sitting room.",
        sourceSelectionId: "dsel_pg",
        sourceRevision: 2,
        directionId: "lumen"
      }),
      adoptB.confirm(ctx.business.id, owner, {
        businessName: "Northridge",
        businessContext: "A quiet sitting room.",
        sourceSelectionId: "dsel_pg",
        sourceRevision: 2,
        directionId: "lumen"
      })
    ]);
    expect(first.draft?.id).toBe(second.draft?.id);
    expect(await storeA.companion.listStudioDrafts(ctx.business.id)).toHaveLength(1);
    await expect(
      adoptB.confirm(ctx.business.id, other, {
        businessName: "Stolen",
        businessContext: "no",
        sourceSelectionId: "dsel_pg",
        sourceRevision: 2,
        directionId: "lumen"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  }, 60_000);

  it("rolls back a failed PostgreSQL confirmation without leaving an adopted draft", async () => {
    const { storeA, owner, ctx } = await openStores();
    const guests = new GuestWorkService(storeA);
    await guests.claim(owner, {
      guestWorkId: "dsel_pg_fail",
      kind: "discovery",
      payload: { selectionId: "dsel_pg_fail", localRevision: 1, selectedDirectionId: "hearth" }
    });
    await expect(
      storeA.runInTransaction(async () => {
        await new BusinessAdoption(storeA).confirm(ctx.business.id, owner, {
          businessName: "Should roll back",
          businessContext: "no",
          sourceSelectionId: "dsel_pg_fail",
          sourceRevision: 1,
          directionId: "hearth"
        });
        throw new Error("injected pg confirmation failure");
      })
    ).rejects.toThrow("injected pg confirmation failure");
    expect(await storeA.companion.getBusinessConfirmation(ctx.business.id)).toBeNull();
    expect(await storeA.companion.listStudioDrafts(ctx.business.id)).toHaveLength(0);
    expect(await storeA.companion.getGuestWorkClaim("dsel_pg_fail")).toBeTruthy();
  }, 60_000);

  it("claims a newer Discovery revision without overwriting the first snapshot", async () => {
    const { storeA, storeB, owner, ctx } = await openStores();
    const guests = new GuestWorkService(storeA);
    await guests.claim(owner, {
      guestWorkId: "dsel_pg_rev",
      kind: "discovery",
      payload: {
        selectionId: "dsel_pg_rev",
        localRevision: 1,
        selectedDirectionId: "lumen",
        paletteId: "ivory_hall",
        visualDirectionId: "glass",
        businessName: "Lumen House",
        visualPreferences: { headline: "Glass evening", paletteId: "ivory_hall", visualDirectionId: "glass" }
      }
    });
    const newer = await guests.claim(owner, {
      guestWorkId: "dsel_pg_rev",
      kind: "discovery",
      payload: {
        selectionId: "dsel_pg_rev",
        localRevision: 2,
        selectedDirectionId: "hearth",
        paletteId: "hearth_linen",
        visualDirectionId: "material",
        businessName: "Hearth Room",
        visualPreferences: { headline: "Linen gathering", paletteId: "hearth_linen", visualDirectionId: "material" }
      }
    });
    expect(newer.sourceRevision).toBe(2);
    expect((await storeA.companion.getGuestWorkClaim("dsel_pg_rev", 1))?.payloadJson).toContain("ivory_hall");
    await expect(
      guests.claim(owner, {
        guestWorkId: "dsel_pg_rev",
        kind: "discovery",
        payload: { selectionId: "dsel_pg_rev", localRevision: 1, selectedDirectionId: "signal" }
      })
    ).rejects.toBeInstanceOf(ConflictError);

    const adoption = new BusinessAdoption(storeA);
    const first = await adoption.confirm(ctx.business.id, owner, {
      businessName: "Lumen House",
      businessContext: "Quiet glass.",
      sourceSelectionId: "dsel_pg_rev",
      sourceRevision: 1,
      directionId: "lumen"
    });
    const [retryA, retryB] = await Promise.all([
      new BusinessAdoption(storeB).confirm(ctx.business.id, owner, {
        businessName: "Hearth Room",
        businessContext: "Warm linen.",
        sourceSelectionId: "dsel_pg_rev",
        sourceRevision: 2,
        directionId: "hearth",
        replaceConfirmedDirection: true
      }),
      adoption.confirm(ctx.business.id, owner, {
        businessName: "Hearth Room",
        businessContext: "Warm linen.",
        sourceSelectionId: "dsel_pg_rev",
        sourceRevision: 2,
        directionId: "hearth",
        replaceConfirmedDirection: true
      })
    ]);
    expect(retryA.draft?.id).toBe(retryB.draft?.id);
    expect(retryA.draft?.id).not.toBe(first.draft?.id);
    expect((await storeA.companion.getStudioDraft(first.draft!.id))?.layers.find((layer) => layer.kind === "headline")?.text).toBe(
      "Glass evening"
    );
    expect(retryA.draft?.brandKit?.designSpec.paletteId).toBe("hearth_linen");
    expect(await storeA.companion.listStudioDrafts(ctx.business.id)).toHaveLength(2);
  }, 60_000);

  it("initializes two connections against an empty schema without a type-name race", async () => {
    const postgres = (await import("postgres")).default;
    const admin = postgres(url, { max: 1, prepare: false, connection: { application_name: "atelier-init-admin" } });
    const dbName = `atelier_init_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    try {
      await admin.unsafe(`CREATE DATABASE ${dbName}`);
      const isolatedUrl = url.replace(/\/[^/?]+(\?|$)/, `/${dbName}$1`);
      const storeA = new PostgresPersistence(isolatedUrl);
      const storeB = new PostgresPersistence(isolatedUrl);
      await Promise.all([storeA.initialize(), storeB.initialize()]);
      await seedSimulatedUsers(storeA, ["neil.local@atelier.invalid"]);
      const owner = (await storeA.getUserByEmail("owner.local@atelier.invalid")) as User;
      const claim = await new GuestWorkService(storeA).claim(owner, {
        guestWorkId: "dsel_pg_init",
        kind: "discovery",
        payload: { selectionId: "dsel_pg_init", localRevision: 1, selectedDirectionId: "lumen" }
      });
      expect(claim.sourceRevision).toBe(1);
      expect(await storeB.companion.getGuestWorkClaim("dsel_pg_init", 1)).toBeTruthy();
    } finally {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end({ timeout: 5 });
    }
  }, 60_000);
});
