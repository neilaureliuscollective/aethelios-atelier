import { describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/domain/errors";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { encodeSolidPng } from "@/lib/cofounder/png";
import { bindSavedExport } from "@/lib/cofounder/exportDelivery";
import type { User } from "@/lib/types";

function png(width: number, height: number) {
  return Buffer.from(encodeSolidPng(width, height)).toString("base64");
}

async function ownerStudio() {
  const store = new MemoryPersistence();
  await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
  const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
  const other = (await store.getUserByEmail("owner-two.local@atelier.invalid")) as User;
  const studio = new CompanionStudio(store);
  const workspace = new CompanionWorkspace(store);
  const ctx = await workspace.ensureForUser(owner);
  const otherCtx = await workspace.ensureForUser(other);
  return { store, studio, workspace, owner, other, ctx, otherCtx };
}

describe("export recovery without duplication", () => {
  it("retries an existing artifact after a failed download without creating another export", async () => {
    const { studio, owner, ctx } = await ownerStudio();
    const created = await studio.createFromCopy(ctx.business.id, owner, {
      headline: "Glass evening",
      layout: "direction_board"
    });
    const exported = await studio.exportDraft(ctx.business.id, owner, created.draft.id, "direction_board", {
      composedPngBase64: png(1600, 1200),
      expectedUpdatedAt: created.draft.updatedAt
    });
    const before = (await studio.listDraftAssets(ctx.business.id, owner, created.draft.id)).filter(
      (item) => item.prompt === "composition_export"
    );
    expect(before).toHaveLength(1);
    const first = await studio.getAssetBytes(ctx.business.id, owner, exported.asset.id);
    const retry = await studio.getAssetBytes(ctx.business.id, owner, exported.asset.id);
    expect(Buffer.from(retry.blob.bytes)).toEqual(Buffer.from(first.blob.bytes));
    const after = (await studio.listDraftAssets(ctx.business.id, owner, created.draft.id)).filter(
      (item) => item.prompt === "composition_export"
    );
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(exported.asset.id);
    expect(bindSavedExport(after, created.draft, ctx.business.id)?.assetId).toBe(exported.asset.id);
  });

  it("keeps the saved export row when artifact bytes are missing", async () => {
    const { store, studio, owner, ctx } = await ownerStudio();
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Kept export" });
    const exported = await studio.exportDraft(ctx.business.id, owner, created.draft.id, created.draft.layout, {
      composedPngBase64: png(1080, 1080),
      expectedUpdatedAt: created.draft.updatedAt
    });
    await store.companion.deleteBlob(exported.asset.blobId!);
    await expect(studio.getAssetBytes(ctx.business.id, owner, exported.asset.id)).rejects.toBeInstanceOf(NotFoundError);
    const asset = await store.companion.getStudioAsset(exported.asset.id);
    expect(asset?.id).toBe(exported.asset.id);
    expect(asset?.compositionRevisionId).toBe(exported.revision.id);
    expect((await store.companion.getCompositionRevision(exported.revision.id))?.outputHash).toBe(exported.asset.outputHash);
  });

  it("rejects a stale revision export without adding a duplicate artifact", async () => {
    const { store, studio, owner, ctx } = await ownerStudio();
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "First wording" });
    const exported = await studio.exportDraft(ctx.business.id, owner, created.draft.id, created.draft.layout, {
      composedPngBase64: png(1080, 1080),
      expectedUpdatedAt: created.draft.updatedAt
    });
    const latest = await studio.updateDraft(ctx.business.id, owner, created.draft.id, {
      layers: created.draft.layers.map((layer) =>
        layer.kind === "headline" ? { ...layer, text: "Later wording" } : layer
      ),
      expectedUpdatedAt: exported.draft.updatedAt
    });
    await expect(
      studio.exportDraft(ctx.business.id, owner, created.draft.id, created.draft.layout, {
        composedPngBase64: png(1080, 1080),
        expectedUpdatedAt: created.draft.updatedAt
      })
    ).rejects.toBeInstanceOf(ConflictError);
    const exports = (await store.companion.listStudioAssets(ctx.business.id)).filter(
      (item) => item.draftId === created.draft.id && item.prompt === "composition_export"
    );
    expect(exports).toHaveLength(1);
    expect(latest.layers.find((layer) => layer.kind === "headline")?.text).toBe("Later wording");
    expect((await studio.getAssetBytes(ctx.business.id, owner, exported.asset.id)).blob.bytes.byteLength).toBeGreaterThan(0);
  });

  it("rejects a non-image logo upload and leaves the composition unexported", async () => {
    const { store, studio, owner, ctx } = await ownerStudio();
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Logo stays" });
    await expect(
      studio.uploadLogo(ctx.business.id, owner, {
        title: "notes.txt",
        mime: "text/plain",
        bytes: new TextEncoder().encode("not an image")
      })
    ).rejects.toBeInstanceOf(ForbiddenError);
    expect((await studio.getDraft(ctx.business.id, owner, created.draft.id)).layers.some((layer) => layer.documentId)).toBe(
      false
    );
    expect((await store.companion.getWorkItem(created.workItem.id))?.status).not.toBe("exported");
  });

  it("forbids a second account from reading the first account export bytes", async () => {
    const { studio, owner, other, ctx, otherCtx } = await ownerStudio();
    const created = await studio.createFromCopy(ctx.business.id, owner, { headline: "Private export" });
    const exported = await studio.exportDraft(ctx.business.id, owner, created.draft.id, created.draft.layout, {
      composedPngBase64: png(1080, 1080),
      expectedUpdatedAt: created.draft.updatedAt
    });
    await expect(studio.getAssetBytes(ctx.business.id, other, exported.asset.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(studio.getAssetBytes(otherCtx.business.id, other, exported.asset.id)).rejects.toBeInstanceOf(NotFoundError);
    expect((await studio.getAssetBytes(ctx.business.id, owner, exported.asset.id)).asset.id).toBe(exported.asset.id);
  });
});
