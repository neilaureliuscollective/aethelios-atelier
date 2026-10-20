import { describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ConflictError, ForbiddenError } from "@/lib/domain/errors";
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
});
