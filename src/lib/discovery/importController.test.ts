import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { confirmSelection, createDraft } from "./selection";
import {
  applyDiscoveryImport,
  captureDiscoveryImportReview,
  prepareDiscoveryImport
} from "./importController";
import { readDiscoveryHandoff, writeDiscoveryHandoff, type MemoryStorage } from "./persistence";
import type { DiscoverySelection } from "./types";

function selection(overrides: Partial<Parameters<typeof createDraft>[0]> = {}) {
  return confirmSelection(
    createDraft({
      businessName: "Meridian Sitting Room",
      businessType: "appointment",
      intent: "easier_booking",
      audience: "Adults who want an unhurried appointment.",
      serviceInterest: "booking_connected_website",
      exclusions: "Do not invent a membership program.",
      ...overrides
    }),
    null
  );
}

function replaceVision(confirmed: DiscoverySelection, existing = createEmptyBrief()) {
  const reviewed = captureDiscoveryImportReview({
    rawSelection: confirmed,
    currentBrief: existing
  });
  if (!reviewed.ok) throw new Error("expected capture");
  return {
    ...reviewed,
    decisions: Object.fromEntries(
      reviewed.capture.mapping.proposals.map((item) => [item.field, item.field === "vision" ? "replace" : "skip"])
    )
  };
}

describe("discovery import controller", () => {
  it("applies explicit replace against the captured brief baseline", () => {
    const existing = createEmptyBrief();
    existing.vision = { key: "vision", value: "Keep this sentence.", provenance: "client_statement" };
    const confirmed = selection();
    const reviewed = replaceVision(confirmed, existing);
    const replaced = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: existing,
      currentSelection: confirmed,
      decisions: reviewed.decisions
    });
    expect(replaced.ok).toBe(true);
    if (replaced.ok) {
      expect(replaced.brief.vision.value).toContain("Meridian Sitting Room");
      expect(existing.vision.value).toBe("Keep this sentence.");
      expect(replaced.mapping.briefFingerprint).toBe(reviewed.capture.briefFingerprint);
    }
  });

  it("appends without deleting existing copy", () => {
    const existing = createEmptyBrief();
    existing.vision = { key: "vision", value: "Keep this sentence.", provenance: "client_statement" };
    const confirmed = selection();
    const reviewed = captureDiscoveryImportReview({ rawSelection: confirmed, currentBrief: existing });
    if (!reviewed.ok) throw new Error("expected mapping");
    const appended = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: existing,
      currentSelection: confirmed,
      decisions: Object.fromEntries(
        reviewed.capture.mapping.proposals.map((item) => [item.field, item.field === "vision" ? "append" : "skip"])
      )
    });
    expect(appended.ok).toBe(true);
    if (appended.ok) {
      expect(appended.brief.vision.value).toContain("Keep this sentence.");
      expect(appended.brief.vision.value).toContain("Meridian Sitting Room");
    }
  });

  it("fails closed on a stale saved brief revision", () => {
    const existing = createEmptyBrief();
    const confirmed = selection();
    const reviewed = captureDiscoveryImportReview({
      rawSelection: confirmed,
      currentBrief: existing,
      briefRevision: 2
    });
    if (!reviewed.ok) throw new Error("expected mapping");
    const stale = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: existing,
      currentSelection: confirmed,
      decisions: Object.fromEntries(reviewed.capture.mapping.proposals.map((item) => [item.field, "skip"])),
      currentRevision: 3
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("stale_review");
  });

  it("does not overwrite guest typing made after the review opened", () => {
    const existing = createEmptyBrief();
    existing.vision = { key: "vision", value: "Original guest vision.", provenance: "client_statement" };
    const confirmed = selection();
    const reviewed = replaceVision(confirmed, existing);
    const typed = createEmptyBrief();
    typed.vision = {
      key: "vision",
      value: "Newer guest typing while import review is open.",
      provenance: "client_statement"
    };
    const applied = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: typed,
      currentSelection: confirmed,
      decisions: reviewed.decisions,
      currentOwnerId: null,
      currentProjectId: null
    });
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.code).toBe("stale_review");
    expect(typed.vision.value).toBe("Newer guest typing while import review is open.");
    expect(reviewed.capture.mapping.proposals.find((item) => item.field === "vision")?.existingValue).toBe(
      "Original guest vision."
    );
  });

  it("does not overwrite authenticated unsaved typing made after the review opened", () => {
    const existing = createEmptyBrief();
    existing.vision = { key: "vision", value: "Saved account vision.", provenance: "client_statement" };
    const confirmed = selection();
    const reviewed = captureDiscoveryImportReview({
      rawSelection: confirmed,
      currentBrief: existing,
      ownerId: "usr_1",
      projectId: "prj_1",
      briefRevision: 4
    });
    if (!reviewed.ok) throw new Error("expected capture");
    const typed = createEmptyBrief();
    typed.vision = {
      key: "vision",
      value: "Authenticated unsaved typing while import review is open.",
      provenance: "client_statement"
    };
    const applied = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: typed,
      currentSelection: confirmed,
      decisions: Object.fromEntries(
        reviewed.capture.mapping.proposals.map((item) => [item.field, item.field === "vision" ? "replace" : "skip"])
      ),
      currentOwnerId: "usr_1",
      currentProjectId: "prj_1",
      currentRevision: 4
    });
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.code).toBe("stale_review");
    expect(typed.vision.value).toBe("Authenticated unsaved typing while import review is open.");
  });

  it("requires a fresh review when the captured direction identity changes", () => {
    const existing = createEmptyBrief();
    const first = selection();
    const reviewed = captureDiscoveryImportReview({ rawSelection: first, currentBrief: existing });
    if (!reviewed.ok) throw new Error("expected capture");
    const later = { ...first, selectionId: "sel_changed", localRevision: first.localRevision + 1 };
    const applied = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: existing,
      currentSelection: later,
      decisions: Object.fromEntries(reviewed.capture.mapping.proposals.map((item) => [item.field, "skip"]))
    });
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.code).toBe("stale_review");
  });

  it("requires a fresh review when owner or project identity changes", () => {
    const existing = createEmptyBrief();
    const confirmed = selection();
    const reviewed = captureDiscoveryImportReview({
      rawSelection: confirmed,
      currentBrief: existing,
      ownerId: "usr_1",
      projectId: "prj_1"
    });
    if (!reviewed.ok) throw new Error("expected capture");
    const applied = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: existing,
      currentSelection: confirmed,
      decisions: Object.fromEntries(reviewed.capture.mapping.proposals.map((item) => [item.field, "skip"])),
      currentOwnerId: "usr_2",
      currentProjectId: "prj_1"
    });
    expect(applied.ok).toBe(false);
    if (!applied.ok) expect(applied.code).toBe("stale_review");
  });

  it("hands a confirmed selection across routes without calling project APIs", () => {
    const store: MemoryStorage & { map: Map<string, string> } = {
      map: new Map(),
      getItem: (key) => store.map.get(key) ?? null,
      setItem: (key, value) => {
        store.map.set(key, value);
      },
      removeItem: (key) => {
        store.map.delete(key);
      }
    };
    const confirmed = selection();
    expect(writeDiscoveryHandoff(confirmed, store).ok).toBe(true);
    expect(readDiscoveryHandoff(store)?.selectionId).toBe(confirmed.selectionId);
    expect(readDiscoveryHandoff(store)?.visualPreferences.paletteId).toBe(confirmed.visualPreferences.paletteId);
  });

  it("rejects unknown catalog selections at capture time", () => {
    const result = captureDiscoveryImportReview({
      rawSelection: { catalogVersion: 99, templateVersion: 1 },
      currentBrief: createEmptyBrief()
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_selection");
  });

  it("does not regenerate a mapping from later brief text at apply time", () => {
    const existing = createEmptyBrief();
    existing.audience = { key: "audience", value: "First audience.", provenance: "client_statement" };
    const confirmed = selection();
    const reviewed = captureDiscoveryImportReview({ rawSelection: confirmed, currentBrief: existing });
    if (!reviewed.ok) throw new Error("expected capture");
    const later = prepareDiscoveryImport({ rawSelection: confirmed, currentBrief: createEmptyBrief() });
    if (!later.ok) throw new Error("expected later mapping");
    expect(reviewed.capture.mapping.briefFingerprint).not.toBe(later.mapping.briefFingerprint);
    const applied = applyDiscoveryImport({
      capture: reviewed.capture,
      currentBrief: existing,
      currentSelection: confirmed,
      decisions: Object.fromEntries(reviewed.capture.mapping.proposals.map((item) => [item.field, "skip"]))
    });
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.mapping.proposals.find((item) => item.field === "audience")?.existingValue).toBe("First audience.");
    }
  });
});
