import { describe, expect, it } from "vitest";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { createDraft, confirmSelection, parseSelection } from "@/lib/discovery/selection";
import { brandKitFromSelection, parseBrandKit } from "./brandKit";
import { normalizeProfile, emptyProfile } from "./profile";
import { clientSafeProfile } from "./isolation";

describe("versioned brand direction handoff", () => {
  it("preserves the selected palette, layout, typography, imagery and revisions through serialization", () => {
    const selection = confirmSelection(createDraft({businessName: "Cedar", activeDirectionId: "signal", paletteId: "verdant", visualDirectionId: "mark"}), null);
    const kit = brandKitFromSelection(selection, { mode: "new_brand", locked: true, retainedAssets: [] })!;
    const restored = parseBrandKit(JSON.parse(JSON.stringify(kit)))!;
    expect(restored.designSpec.directionId).toBe("signal");
    expect(restored.designSpec.layoutId).toBe("signal_precision");
    expect(restored.designSpec.typography.display).toBe("syne");
    expect(restored.designSpec.paletteId).toBe("verdant");
    expect(restored.designSpec.assets.length).toBeGreaterThan(0);
    expect(restored.sourceRevision).toBe(selection.localRevision);
    const profile = normalizeProfile({ ...emptyProfile("biz", "now"), brandKit: restored });
    expect(clientSafeProfile(profile).brandKit).toEqual(restored);
  });
  it("continues existing identity without deleting retained assets or mutating older versions", () => {
    const assets = [{id: "logo", kind: "logo" as const, title: "Real logo", documentId: "doc"}];
    const selection = confirmSelection(createDraft({businessName: "Cedar"}), null);
    const first = brandKitFromSelection(selection, { mode: "existing_brand", locked: true, retainedAssets: assets })!;
    const second = brandKitFromSelection(selection, { previous: first, mode: "existing_brand", locked: true, retainedAssets: assets })!;
    expect(second.revision).toBe(2);
    expect(first.revision).toBe(1);
    expect(second.retainedAssets).toEqual(assets);
    assets[0]!.title = "Changed";
    expect(second.retainedAssets[0]!.title).toBe("Real logo");
  });
  it("freezes the confirmed spec and rejects mismatched snapshots", () => {
    const selection = confirmSelection(createDraft({ businessName: "Frozen" }), null);
    selection.designSpec!.copy.headline = "Previously reviewed exact headline";
    const restored = parseSelection(JSON.parse(JSON.stringify(selection)))!;
    const kit = brandKitFromSelection(restored, { mode: "new_brand", locked: true, retainedAssets: [] })!;
    expect(kit.designSpec.copy.headline).toBe("Previously reviewed exact headline");
    expect(parseSelection({ ...selection, designSpec: { ...selection.designSpec, directionId: "signal" } })).toBeNull();
  });
  it("rejects a stale profile save without overwriting a newer identity", async () => {
    const store = new MemoryPersistence();
    const initial = emptyProfile("biz", "2026-01-01T00:00:00.000Z");
    await store.companion.upsertProfile(initial);
    const first = { ...initial, updatedAt: "2026-01-01T00:00:01.000Z" };
    expect(await store.companion.compareAndSwapProfile(first, initial.updatedAt)).toEqual(first);
    expect(await store.companion.compareAndSwapProfile({ ...initial, updatedAt: "2026-01-01T00:00:02.000Z" }, initial.updatedAt)).toBeNull();
    expect((await store.companion.getProfile("biz")).updatedAt).toBe(first.updatedAt);
  });
  it("rejects unknown versions and untrusted specs", () => {
    expect(parseBrandKit({version: 99})).toBeNull();
    expect(brandKitFromSelection({}, { mode: "new_brand", locked: true, retainedAssets: [] })).toBeNull();
  });
});
