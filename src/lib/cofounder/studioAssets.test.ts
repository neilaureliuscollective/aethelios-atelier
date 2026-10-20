import { describe, expect, it, vi } from "vitest";
import { studioAssetKind, isStudioBackgroundAsset } from "./studioAssets";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { CompanionStudio } from "./studio";
import { CompanionWorkspace } from "./workspace";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { encodeSolidPng } from "./png";
import type { User, AuthContext } from "@/lib/types";

describe("Studio imagery and completed artwork separation", () => {
  it("identifies current and legacy exports without schema changes", () => {
    expect(studioAssetKind({ prompt: "anything", compositionRevisionId: "revision" })).toBe("composition_export");
    expect(studioAssetKind({ prompt: "composition_export" })).toBe("composition_export");
    expect(studioAssetKind({ prompt: "old export", model: "atelier-owner-canvas-1" })).toBe("composition_export");
    expect(studioAssetKind({ prompt: "A material study", model: "fixture" })).toBe("image");
  });
  it("keeps exports downloadable but rejects reuse beneath exact editable text and logos", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, []);
    const owner = await store.getUserByEmail("owner.local@atelier.invalid") as User;
    const context = await new CompanionWorkspace(store).ensureForUser(owner);
    const generate = vi.fn();
    const edit = vi.fn();
    const studio = new CompanionStudio(store).withImageProvider({ generate, edit });
    const { draft } = await studio.createFromCopy(context.business.id, owner, { headline: "Readable exact title" });
    const exported = await studio.exportDraft(context.business.id, owner, draft.id, "square_announcement", {
      composedPngBase64: Buffer.from(encodeSolidPng(1080, 1080)).toString("base64"), expectedSaveRevision: draft.saveRevision
    });
    expect(isStudioBackgroundAsset(exported.asset)).toBe(false);
    expect((await studio.getAssetBytes(context.business.id, owner, exported.asset.id)).blob.bytes.length).toBeGreaterThan(0);
    await expect(studio.applyAsset(context.business.id, owner, draft.id, exported.asset.id, { expectedSaveRevision: draft.saveRevision })).rejects.toThrow("finished composition export");
    await expect(studio.updateDraft(context.business.id, owner, draft.id, { selectedAssetId: exported.asset.id, expectedSaveRevision: draft.saveRevision })).rejects.toThrow("Finished composition exports");
    await expect(studio.updateDraft(context.business.id, owner, draft.id, { layers: [{id: "image", kind: "image", assetId: exported.asset.id, x: 0, y: 0, width: 100, height: 100}], expectedSaveRevision: draft.saveRevision })).rejects.toThrow("finished composition export");
    await expect(studio.generate(context.business.id, owner, {user: owner} as AuthContext, { draftId: draft.id, prompt: "change the image", idempotencyKey: "reject-export", sourceAssetId: exported.asset.id })).rejects.toThrow("Finished composition exports");
    expect(generate).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
    expect(await store.companion.getJobByIdempotency(context.business.id, "reject-export")).toBeNull();
    expect((await studio.getDraft(context.business.id, owner, draft.id)).saveRevision).toBe(draft.saveRevision);
    expect((await studio.listDraftAssets(context.business.id, owner, draft.id)).some((asset) => asset.id === exported.asset.id)).toBe(true);
  });
});
