import { describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { brandKitFromSelection } from "@/lib/cofounder/brandKit";
import { confirmSelection, createDraft } from "@/lib/discovery/selection";
import { paletteForDesignSpec, paletteForProfile } from "@/lib/cofounder/composition";
import type { User } from "@/lib/types";

describe("saved Studio identity", () => {
  it("snapshots a structured direction and palette, preserving revisions across profile changes", async () => {
    const store = new MemoryPersistence();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = await store.getUserByEmail("owner.local@atelier.invalid") as User;
    const workspace = new CompanionWorkspace(store);
    const ctx = await workspace.ensureForUser(owner);
    const kit = brandKitFromSelection(confirmSelection(createDraft({businessName: "Cedar", activeDirectionId: "signal", paletteId: "signal_ink"}), null), {mode: "new_brand", locked: true, retainedAssets: []})!;
    await workspace.updateProfile(ctx.business.id, owner, {brandKit: kit});
    const studio = new CompanionStudio(store);
    const {draft} = await studio.createFromCopy(ctx.business.id, owner, {headline: "Cedar opening", direction: "Retain the cedar texture"});
    expect(draft.brandKit).toEqual(kit);
    expect(draft.palette).toEqual(paletteForDesignSpec(kit.designSpec));
    const updated = await studio.updateDraft(ctx.business.id, owner, draft.id, {direction: "Soft morning light", expectedSaveRevision: 1});
    expect(updated.direction).toBe("Soft morning light");
    await expect(studio.updateDraft(ctx.business.id, owner, draft.id, {direction: "stale", expectedSaveRevision: 1})).rejects.toThrow();
    await workspace.updateProfile(ctx.business.id, owner, {brandKit: {...kit, revision: 2, designSpec: {...kit.designSpec, paletteId: "ivory_hall"}}});
    const reopened = await studio.getDraft(ctx.business.id, owner, draft.id);
    expect(reopened.brandKit?.revision).toBe(1);
    expect(reopened.brandKit?.designSpec.paletteId).toBe("signal_ink");
    expect(reopened.palette).toEqual(draft.palette);
    expect(reopened.direction).toBe("Soft morning light");
    const existingProfile = await workspace.updateProfile(ctx.business.id, owner, {
      brandKit: {...kit, revision: 3, mode: "existing_brand"},
      brandAssets: [{id: "fixture-logo", kind: "logo", title: "Retained identity", documentId: "existing-logo-document"}]
    });
    const continued = await studio.createFromCopy(ctx.business.id, owner, {headline: "Continue our identity"});
    expect(continued.draft.palette).toEqual(paletteForProfile(existingProfile));
    expect(continued.draft.layers.find(layer => layer.kind === "logo")?.documentId).toBe("existing-logo-document");
    expect(continued.draft.brandKit?.mode).toBe("existing_brand");
  });
});
