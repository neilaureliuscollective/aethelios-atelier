import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { atelierSurfaceForPath } from "@/lib/atelierSurface";
import {
  confirmDirection,
  createDraft,
  createSampleExplorationDraft,
  draftFromSelection,
  hasUnpublishedChanges,
  hasVisitorAnswers,
  mapSelectionToBriefProposals,
  parseSelection,
  previewInstanceId,
  readDiscoveryHandoff,
  writeDiscoveryHandoff,
  type MemoryStorage
} from "@/lib/discovery";
import { resolveSampleVisit, SAMPLE_PRESERVED_STATUS } from "./sampleVisit";

const root = process.cwd();

function readOwned(relative: string) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function memory(): MemoryStorage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    }
  };
}

describe("discovery experience elevation contracts", () => {
  it("reuses the luminous site surface for /discover", () => {
    expect(atelierSurfaceForPath("/discover")).toBe("luminous");
    expect(atelierSurfaceForPath("/")).toBe("luminous");
    expect(atelierSurfaceForPath("/services")).toBe("luminous");
    expect(atelierSurfaceForPath("/project")).toBe("workroom");
  });

  it("renders the entrance sample through ConceptStage instead of a hard-coded miniature", () => {
    const entrance = readOwned("src/components/discovery/Entrance.tsx");
    expect(entrance).toContain("ConceptStage");
    expect(entrance).toContain("createSampleExplorationDraft");
    expect(entrance).toContain("data-entrance-sample");
    expect(entrance).not.toContain("A quieter way to be found.");
    expect(entrance).not.toContain("intelligence");
    expect(entrance).not.toContain("adapter");
    expect(entrance).toContain("I already know what I need");
    expect(entrance).toContain("See a sample direction");
  });

  it("keeps visitor answers when a sample is opened later", () => {
    const empty = createDraft();
    const applied = resolveSampleVisit(empty, null);
    expect(applied.applied).toBe(true);
    expect(applied.draft.businessName).toBe("Northridge");
    expect(hasVisitorAnswers(applied.draft)).toBe(true);

    const visitor = createDraft({ businessName: "Meridian Sitting Room" });
    const preserved = resolveSampleVisit(visitor, null);
    expect(preserved.applied).toBe(false);
    expect(preserved.draft.businessName).toBe("Meridian Sitting Room");
    expect(preserved.status).toBe(SAMPLE_PRESERVED_STATUS);

    const confirmed = confirmDirection(visitor, "lumen", null).selection;
    const afterConfirm = resolveSampleVisit(createDraft(), confirmed);
    expect(afterConfirm.applied).toBe(false);
    expect(afterConfirm.draft.businessName).toBe("");
  });

  it("confirms the clicked direction even when another concept is active", () => {
    const draft = createDraft({
      businessName: "Meridian Sitting Room",
      activeDirectionId: "lumen"
    });
    const result = confirmDirection(draft, "hearth", null);
    expect(draft.activeDirectionId).toBe("lumen");
    expect(result.draft.activeDirectionId).toBe("hearth");
    expect(result.selection.selectedDirectionId).toBe("hearth");
    expect(result.selection.businessName).toBe("Meridian Sitting Room");
  });

  it("keeps a confirmed recap immutable after later exploration edits", () => {
    const draft = createDraft({
      businessName: "Meridian Sitting Room",
      headline: "Time, held still.",
      activeDirectionId: "hearth"
    });
    const confirmed = confirmDirection(draft, "hearth", null).selection;
    const edited = createDraft({
      ...draft,
      businessName: "Willow Atelier",
      activeDirectionId: "lumen"
    });
    expect(hasUnpublishedChanges(edited, confirmed)).toBe(true);
    expect(confirmed.businessName).toBe("Meridian Sitting Room");
    expect(confirmed.selectedDirectionId).toBe("hearth");
    const recap = draftFromSelection(confirmed);
    expect(recap.businessName).toBe("Meridian Sitting Room");
    expect(recap.activeDirectionId).toBe("hearth");
    expect(recap.headline).toBe("Time, held still.");
  });

  it("keeps comparison preview instances independent", () => {
    const left = previewInstanceId("compare", "lumen", 0);
    const right = previewInstanceId("compare", "hearth", 1);
    expect(left).not.toBe(right);
    expect(left).toContain("lumen");
    expect(right).toContain("hearth");
    const studio = readOwned("src/components/discovery/DiscoveryStudio.tsx");
    expect(studio).toContain('previewInstanceId("compare", id, slot)');
    expect(studio).toContain("data-preview-device");
    expect(studio).toContain("data-confirm-direction");
  });

  it("writes the confirmed selection through the existing brief handoff", () => {
    const studio = readOwned("src/components/discovery/DiscoveryStudio.tsx");
    expect(studio).toContain("writeDiscoveryHandoff(result.selection)");
    expect(studio).toContain('href="/project"');
    expect(studio).toContain("Add to your brief");

    const store = memory();
    const confirmed = confirmDirection(
      createDraft({ businessName: "Meridian Sitting Room", activeDirectionId: "signal" }),
      "signal",
      null
    ).selection;
    expect(writeDiscoveryHandoff(confirmed, store).ok).toBe(true);
    const handoff = readDiscoveryHandoff(store);
    expect(handoff?.selectionId).toBe(confirmed.selectionId);
    expect(handoff?.selectedDirectionId).toBe("signal");
    expect(parseSelection(handoff)?.businessName).toBe("Meridian Sitting Room");
    const mapping = mapSelectionToBriefProposals(handoff!);
    expect(mapping.summary).toContain("prepared on this device");
    expect(mapping.summary).not.toMatch(/Added to your account/i);
  });

  it("does not treat the labeled sample as a live generated client project", () => {
    const sample = createSampleExplorationDraft();
    expect(sample.businessName).toBe("Northridge");
    expect(sample.businessName.toLowerCase()).not.toContain("lifestyle");
    expect(sample.businessName.toLowerCase()).not.toContain("aethelios");
    const entrance = readOwned("src/components/discovery/Entrance.tsx");
    expect(entrance).toMatch(/illustrative/i);
    expect(entrance).toMatch(/not a client project/i);
  });
});
