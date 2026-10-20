import { describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ConflictError, ForbiddenError, LimitError } from "@/lib/domain/errors";
import { MemoryPersistence } from "@/lib/persistence/memory";
import type { User } from "@/lib/types";

describe("studio draft compare-and-swap", () => {
  it("lets only one save from the same revision succeed", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const workspace = new CompanionWorkspace(store);
    const studio = new CompanionStudio(store);
    const ctx = await workspace.ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, {
      headline: "First wording",
      body: "Keep this."
    });
    const expected = created.draft.updatedAt;
    const first = await studio.updateDraft(ctx.business.id, owner, created.draft.id, {
      layers: created.draft.layers.map((layer) =>
        layer.kind === "headline" ? { ...layer, text: "Newer wording" } : layer
      ),
      expectedUpdatedAt: expected
    });
    expect(first.layers.find((layer) => layer.kind === "headline")?.text).toBe("Newer wording");
    await expect(
      studio.updateDraft(ctx.business.id, owner, created.draft.id, {
        layers: created.draft.layers.map((layer) =>
          layer.kind === "headline" ? { ...layer, text: "Stale overwrite" } : layer
        ),
        expectedUpdatedAt: expected
      })
    ).rejects.toBeInstanceOf(ConflictError);
    const latest = await store.companion.getStudioDraft(created.draft.id);
    expect(latest?.layers.find((layer) => layer.kind === "headline")?.text).toBe("Newer wording");
    expect(latest?.layers.find((layer) => layer.kind === "headline")?.text).not.toBe("Stale overwrite");
  });

  it("stores and reads back the composition revision link on the exported asset", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const studio = new CompanionStudio(store);
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, {
      headline: "House announcement",
      body: "Confirmed facts only.",
      layout: "portrait_social"
    });
    const { encodeSolidPng } = await import("@/lib/cofounder/png");
    const exported = await studio.exportDraft(ctx.business.id, owner, created.draft.id, "portrait_social", {
      composedPngBase64: Buffer.from(encodeSolidPng(1080, 1350)).toString("base64"),
      expectedUpdatedAt: created.draft.updatedAt
    });
    const asset = await store.companion.getStudioAsset(exported.asset!.id);
    const revision = await store.companion.getCompositionRevision(asset!.compositionRevisionId!);
    expect(asset?.compositionRevisionId).toBe(exported.revision?.id);
    expect(revision?.id).toBe(asset?.compositionRevisionId);
    expect(revision?.outputHash).toBe(asset?.outputHash);
    expect(revision?.draftId).toBe(created.draft.id);
    expect(revision?.businessId).toBe(ctx.business.id);
    await studio.updateDraft(ctx.business.id, owner, created.draft.id, {
      layers: created.draft.layers.map((layer) =>
        layer.kind === "headline" ? { ...layer, text: "Later edit" } : layer
      ),
      expectedUpdatedAt: exported.draft.updatedAt
    });
    const frozen = await store.companion.getCompositionRevision(revision!.id);
    expect(frozen?.layers.find((layer) => layer.kind === "headline")?.text).toBe("House announcement");
    const bytes = await studio.getAssetBytes(ctx.business.id, owner, asset!.id);
    expect(bytes.blob.bytes.byteLength).toBeGreaterThan(0);
  });

  it("rejects unauthorized layer references and leaves the draft unexported", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const studio = new CompanionStudio(store);
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, {
      headline: "House announcement",
      body: "Confirmed facts only."
    });
    const { encodeSolidPng } = await import("@/lib/cofounder/png");
    await expect(
      studio.exportDraft(ctx.business.id, owner, created.draft.id, created.draft.layout, {
        layers: [
          ...created.draft.layers,
          { id: "logo_foreign", kind: "logo", documentId: "doc_foreign", x: 8, y: 8, width: 18, height: 12 }
        ],
        composedPngBase64: Buffer.from(encodeSolidPng(1080, 1080)).toString("base64"),
        expectedUpdatedAt: created.draft.updatedAt
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    const latest = await store.companion.getStudioDraft(created.draft.id);
    expect(latest?.layers.find((layer) => layer.documentId === "doc_foreign")).toBeUndefined();
    const work = await store.companion.getWorkItem(created.workItem.id);
    expect(work?.status).not.toBe("exported");
  });

  it("rejects a PATCH that omits the concurrency token", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const studio = new CompanionStudio(store);
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Token required" });
    await expect(
      studio.updateDraft(ctx.business.id, owner, created.draft.id, {
        layers: created.draft.layers
      })
    ).rejects.toBeInstanceOf(ConflictError);
    expect((await store.companion.getStudioDraft(created.draft.id))?.saveRevision).toBe(1);
  });

  it("keeps a late generation from overwriting newer draft text", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const session = {
      user: owner,
      session: {
        id: `sess_${owner.id}`,
        userId: owner.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      },
      adapter: "simulated" as const
    };
    await store.createSession(session.session);
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gate!: () => void;
    const wait = new Promise<void>((resolve) => {
      gate = resolve;
    });
    let calls = 0;
    const studio = new CompanionStudio(store).withImageProvider({
      async generate() {
        calls += 1;
        release();
        await wait;
        const { encodeSolidPng } = await import("@/lib/cofounder/png");
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "latch" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Original headline" });
    const pending = studio.generate(ctx.business.id, owner, session, {
      draftId: created.draft.id,
      prompt: "late",
      idempotencyKey: "late-gen-1"
    });
    await started;
    const saved = await studio.updateDraft(ctx.business.id, owner, created.draft.id, {
      layers: created.draft.layers.map((layer) =>
        layer.kind === "headline" ? { ...layer, text: "Owner saved during generation" } : layer
      ),
      expectedSaveRevision: created.draft.saveRevision
    });
    expect(saved.layers.find((layer) => layer.kind === "headline")?.text).toBe("Owner saved during generation");
    gate();
    const result = await pending;
    expect(calls).toBe(1);
    expect(result.asset.status).toBe("ready");
    expect(result.applied).toBe(false);
    expect(result.conflict).toBe(true);
    const latest = await store.companion.getStudioDraft(created.draft.id);
    expect(latest?.layers.find((layer) => layer.kind === "headline")?.text).toBe("Owner saved during generation");
    expect(latest?.selectedAssetId).not.toBe(result.asset.id);
    expect(latest?.saveRevision).toBe(2);
  });

  it("keeps a composition change and rejects a second in-flight generation", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
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
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "1";
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gate!: () => void;
    const wait = new Promise<void>((resolve) => {
      gate = resolve;
    });
    let calls = 0;
    const studio = new CompanionStudio(store).withImageProvider({
      async generate() {
        calls += 1;
        release();
        await wait;
        const { encodeSolidPng } = await import("@/lib/cofounder/png");
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "latch" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Original layout" });
    const pending = studio.generate(ctx.business.id, owner, session, {
      draftId: created.draft.id,
      prompt: "late-layout",
      idempotencyKey: "late-layout-1"
    });
    await started;
    const composed = await studio.updateDraft(ctx.business.id, owner, created.draft.id, {
      layout: "story_portrait",
      expectedSaveRevision: created.draft.saveRevision
    });
    expect(composed.layout).toBe("story_portrait");
    await expect(
      studio.generate(ctx.business.id, owner, session, {
        draftId: created.draft.id,
        prompt: "second",
        idempotencyKey: "late-layout-2"
      })
    ).rejects.toBeInstanceOf(LimitError);
    await expect(
      studio.generate(ctx.business.id, owner, session, {
        draftId: created.draft.id,
        prompt: "retry",
        idempotencyKey: "late-layout-1"
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    gate();
    const result = await pending;
    expect(calls).toBe(1);
    expect(result.applied).toBe(false);
    expect(result.conflict).toBe(true);
    expect((await store.companion.getStudioDraft(created.draft.id))?.layout).toBe("story_portrait");
    delete process.env.ATELIER_MAX_CONCURRENT_GENERATIONS;
  });

  it("does not apply a late result after the session job is invalidated", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const session = {
      user: owner,
      session: {
        id: `sess_${owner.id}_cancel`,
        userId: owner.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      },
      adapter: "simulated" as const
    };
    await store.createSession(session.session);
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gate!: () => void;
    const wait = new Promise<void>((resolve) => {
      gate = resolve;
    });
    const studio = new CompanionStudio(store).withImageProvider({
      async generate() {
        release();
        await wait;
        const { encodeSolidPng } = await import("@/lib/cofounder/png");
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "cancel" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Keep this headline" });
    const pending = studio.generate(ctx.business.id, owner, session, {
      draftId: created.draft.id,
      prompt: "cancel-me",
      idempotencyKey: "cancel-gen-1"
    });
    await started;
    expect(await store.companion.invalidateJobsForSession(session.session.id)).toBeGreaterThan(0);
    gate();
    const result = await pending;
    expect(result.applied).toBe(false);
    expect(result.asset.status).toBe("invalidated");
    expect((await store.companion.getStudioDraft(created.draft.id))?.layers.find((layer) => layer.kind === "headline")?.text).toBe(
      "Keep this headline"
    );
    expect((await store.companion.getStudioDraft(created.draft.id))?.selectedAssetId).toBeUndefined();
    await expect(
      studio.applyAsset(ctx.business.id, owner, created.draft.id, result.asset.id, {
        expectedSaveRevision: created.draft.saveRevision
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets the owner apply a retained ready image without overwriting newer copy", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
    const session = {
      user: owner,
      session: {
        id: `sess_${owner.id}_apply`,
        userId: owner.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      },
      adapter: "simulated" as const
    };
    await store.createSession(session.session);
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gate!: () => void;
    const wait = new Promise<void>((resolve) => {
      gate = resolve;
    });
    const studio = new CompanionStudio(store).withImageProvider({
      async generate() {
        release();
        await wait;
        const { encodeSolidPng } = await import("@/lib/cofounder/png");
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "retain" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, {
      headline: "Original headline",
      layout: "square_announcement"
    });
    const pending = studio.generate(ctx.business.id, owner, session, {
      draftId: created.draft.id,
      prompt: "retain-me",
      idempotencyKey: "retain-1"
    });
    await started;
    const edited = await studio.updateDraft(ctx.business.id, owner, created.draft.id, {
      layout: "portrait_social",
      layers: created.draft.layers.map((layer) =>
        layer.kind === "headline" ? { ...layer, text: "Newer saved headline" } : layer
      ),
      expectedSaveRevision: created.draft.saveRevision
    });
    gate();
    const late = await pending;
    expect(late.applied).toBe(false);
    expect(late.asset.status).toBe("ready");
    expect(late.asset.blobId).toBeTruthy();
    const reloaded = await studio.getDraft(ctx.business.id, owner, created.draft.id);
    expect(reloaded.layers.find((layer) => layer.kind === "headline")?.text).toBe("Newer saved headline");
    expect(reloaded.layout).toBe("portrait_social");
    const applied = await studio.applyAsset(ctx.business.id, owner, created.draft.id, late.asset.id, {
      expectedSaveRevision: reloaded.saveRevision
    });
    expect(applied.selectedAssetId).toBe(late.asset.id);
    expect(applied.layers.find((layer) => layer.kind === "headline")?.text).toBe("Newer saved headline");
    expect(applied.layout).toBe("portrait_social");
    await expect(
      studio.applyAsset(ctx.business.id, owner, created.draft.id, late.asset.id, {
        expectedSaveRevision: edited.saveRevision
      })
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(
      studio.applyAsset(ctx.business.id, other, created.draft.id, late.asset.id, {
        expectedSaveRevision: applied.saveRevision
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    const { encodeSolidPng } = await import("@/lib/cofounder/png");
    const exported = await studio.exportDraft(ctx.business.id, owner, created.draft.id, "portrait_social", {
      composedPngBase64: Buffer.from(encodeSolidPng(1080, 1350)).toString("base64"),
      expectedSaveRevision: applied.saveRevision
    });
    expect(exported.asset?.blobId).toBeTruthy();
  });

  it("does not let a late first attempt settle or select after retry", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const session = {
      user: owner,
      session: {
        id: `sess_${owner.id}_stale`,
        userId: owner.id,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      },
      adapter: "simulated" as const
    };
    await store.createSession(session.session);
    let release!: () => void;
    const started = new Promise<void>((resolve) => {
      release = resolve;
    });
    let gate!: () => void;
    const wait = new Promise<void>((resolve) => {
      gate = resolve;
    });
    const studio = new CompanionStudio(store).withImageProvider({
      async generate() {
        release();
        await wait;
        const { encodeSolidPng } = await import("@/lib/cofounder/png");
        return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "stale" };
      },
      async edit() {
        return this.generate({ prompt: "edit" });
      }
    });
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Fence me" });
    const pending = studio.generate(ctx.business.id, owner, session, {
      draftId: created.draft.id,
      prompt: "stale",
      idempotencyKey: "stale-1"
    });
    await started;
    const jobs = await store.companion.getJobByIdempotency(ctx.business.id, "stale-1");
    const usage = await store.companion.getUsageByOperation(ctx.business.id, "stale-1");
    await store.companion.updateJob({ ...jobs!, attempt: 2 });
    await store.companion.updateUsageEvent({ ...usage!, attempt: 2, status: "held" });
    gate();
    const late = await pending;
    expect(late.applied).toBe(false);
    expect(late.asset.status).toBe("ready");
    expect((await store.companion.getStudioDraft(created.draft.id))?.selectedAssetId).not.toBe(late.asset.id);
    expect((await store.companion.getUsageEvent(usage!.id))?.status).toBe("held");
    expect((await store.companion.getJobByIdempotency(ctx.business.id, "stale-1"))?.status).toBe("pending");
  });
});
