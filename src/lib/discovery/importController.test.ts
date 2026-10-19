import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { confirmSelection, createDraft } from "./selection";
import { applyDiscoveryImport, prepareDiscoveryImport } from "./importController";
import { readDiscoveryHandoff, writeDiscoveryHandoff, type MemoryStorage } from "./persistence";

function selection() {
  return confirmSelection(
    createDraft({
      businessName: "Meridian Sitting Room",
      businessType: "appointment",
      intent: "easier_booking",
      audience: "Adults who want an unhurried appointment.",
      serviceInterest: "booking_connected_website",
      exclusions: "Do not invent a membership program."
    }),
    null
  );
}

describe("discovery import controller", () => {
  it("applies explicit replace against the current brief revision", () => {
    const existing = createEmptyBrief();
    existing.vision = { key: "vision", value: "Keep this sentence.", provenance: "client_statement" };
    const prepared = prepareDiscoveryImport({ rawSelection: selection(), currentBrief: existing });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    const replaced = applyDiscoveryImport({
      rawSelection: selection(),
      currentBrief: existing,
      decisions: Object.fromEntries(prepared.mapping.proposals.map((item) => [item.field, item.field === "vision" ? "replace" : "skip"])),
      expectedRevision: 4,
      currentRevision: 4
    });
    expect(replaced.ok).toBe(true);
    if (replaced.ok) {
      expect(replaced.brief.vision.value).toContain("Meridian Sitting Room");
      expect(existing.vision.value).toBe("Keep this sentence.");
    }
  });

  it("appends without deleting existing copy", () => {
    const existing = createEmptyBrief();
    existing.vision = { key: "vision", value: "Keep this sentence.", provenance: "client_statement" };
    const prepared = prepareDiscoveryImport({ rawSelection: selection(), currentBrief: existing });
    if (!prepared.ok) throw new Error("expected mapping");
    const appended = applyDiscoveryImport({
      rawSelection: selection(),
      currentBrief: existing,
      decisions: Object.fromEntries(prepared.mapping.proposals.map((item) => [item.field, item.field === "vision" ? "append" : "skip"]))
    });
    expect(appended.ok).toBe(true);
    if (appended.ok) {
      expect(appended.brief.vision.value).toContain("Keep this sentence.");
      expect(appended.brief.vision.value).toContain("Meridian Sitting Room");
    }
  });

  it("fails closed on a stale brief revision", () => {
    const existing = createEmptyBrief();
    const prepared = prepareDiscoveryImport({ rawSelection: selection(), currentBrief: existing });
    if (!prepared.ok) throw new Error("expected mapping");
    const stale = applyDiscoveryImport({
      rawSelection: selection(),
      currentBrief: existing,
      decisions: Object.fromEntries(prepared.mapping.proposals.map((item) => [item.field, "skip"])),
      expectedRevision: 2,
      currentRevision: 3
    });
    expect(stale.ok).toBe(false);
    if (!stale.ok) expect(stale.code).toBe("stale_revision");
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

  it("rejects unknown catalog selections", () => {
    const result = applyDiscoveryImport({
      rawSelection: { catalogVersion: 99, templateVersion: 1 },
      currentBrief: createEmptyBrief(),
      decisions: {}
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_selection");
  });
});
