import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import { applyProposals, existingBriefUntouchedProof, mapSelectionToBriefProposals } from "./adapter";
import { currentGuideView, validateGuidanceRequest } from "./aethelios";
import { buildConceptContent, recommendDirection } from "./personalize";
import {
  clearDiscovery,
  createEnvelope,
  parseEnvelope,
  readDiscovery,
  writeDiscovery,
  type MemoryStorage
} from "./persistence";
import { LIMITS, displayName, sanitizePlainText } from "./sanitize";
import {
  confirmSelection,
  createDraft,
  draftFingerprint,
  hasUnpublishedChanges,
  parseDraft,
  parseSelection,
  patchDraft,
  resetField,
  selectionFingerprint,
  toggleFavorite,
  toggleQuality
} from "./selection";
import { DISCOVERY_CATALOG_VERSION } from "./types";

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

function sampleDraft() {
  return createDraft({
    businessName: "Meridian Sitting Room",
    businessType: "appointment",
    intent: "easier_booking",
    audience: "Adults who want an unhurried appointment.",
    customerFeeling: "calm",
    qualities: ["refined", "contemporary"],
    headline: "Time, held still.",
    paletteId: "ivory_hall",
    visualDirectionId: "glass",
    activeDirectionId: "lumen",
    serviceInterest: "booking_connected_website",
    likesNote: "The quiet opening.",
    changeNote: "Less gold on buttons.",
    exclusions: "Do not invent a membership program."
  });
}

describe("discovery selection", () => {
  it("personalizes three directions stably from the same answers", () => {
    const draft = sampleDraft();
    const lumenA = buildConceptContent(draft, "lumen");
    const lumenB = buildConceptContent(draft, "lumen");
    const hearth = buildConceptContent(draft, "hearth");
    const signal = buildConceptContent(draft, "signal");
    expect(lumenA).toEqual(lumenB);
    expect(lumenA.headline).toBe("Time, held still.");
    expect(lumenA.businessName).toBe("Meridian Sitting Room");
    expect(hearth.opening).not.toBe(lumenA.opening);
    expect(signal.actionLabel).toBe("Reserve");
    expect(hearth.actionLabel).toBe("Save a time");
    expect(lumenA.actionLabel).toBe("Request a sitting");
    expect(new Set([lumenA.opening, hearth.opening, signal.opening]).size).toBe(3);
  });

  it("recommends a direction from qualities without calling it AI", () => {
    expect(recommendDirection(["bold"])).toBe("signal");
    expect(recommendDirection(["welcoming", "grounded"])).toBe("hearth");
    expect(recommendDirection(["refined"])).toBe("lumen");
  });

  it("confirms a snapshot that later draft edits do not mutate", () => {
    const draft = sampleDraft();
    const confirmed = confirmSelection(draft, null, new Date("2026-10-19T17:00:00.000Z"));
    expect(confirmed.localRevision).toBe(1);
    expect(confirmed.selectedDirectionId).toBe("lumen");
    const edited = patchDraft(draft, { businessName: "Edited later", activeDirectionId: "signal" });
    expect(confirmed.businessName).toBe("Meridian Sitting Room");
    expect(confirmed.selectedDirectionId).toBe("lumen");
    expect(hasUnpublishedChanges(edited, confirmed)).toBe(true);
    expect(hasUnpublishedChanges(draft, confirmed)).toBe(false);
    const again = confirmSelection(edited, confirmed, new Date("2026-10-19T18:00:00.000Z"));
    expect(again.selectionId).toBe(confirmed.selectionId);
    expect(again.localRevision).toBe(2);
    expect(again.createdAt).toBe(confirmed.createdAt);
    expect(again.businessName).toBe("Edited later");
  });

  it("resets one field without clearing unrelated choices", () => {
    const draft = sampleDraft();
    const resetName = resetField(draft, "businessName");
    expect(resetName.businessName).toBe("");
    expect(resetName.qualities).toEqual(["refined", "contemporary"]);
    expect(resetName.paletteId).toBe("ivory_hall");
    const resetPalette = resetField(draft, "paletteId");
    expect(resetPalette.businessName).toBe("Meridian Sitting Room");
    expect(resetPalette.paletteId).toBe("ivory_hall");
  });

  it("toggles favorites and qualities independently", () => {
    let draft = sampleDraft();
    draft = toggleFavorite(draft, "hearth");
    draft = toggleFavorite(draft, "hearth");
    draft = toggleQuality(draft, "bold");
    expect(draft.favorites).toEqual([]);
    expect(draft.qualities).toContain("bold");
  });

  it("rejects unknown catalog versions and malformed selections", () => {
    expect(parseDraft({ catalogVersion: 99, templateVersion: 1 })).toBeNull();
    expect(parseSelection({ ...confirmSelection(sampleDraft(), null), catalogVersion: 9 })).toBeNull();
    expect(parseSelection({ catalogVersion: 1, templateVersion: 1, selectionId: "x" })).toBeNull();
    expect(parseEnvelope({ kind: "discovery_session", version: 9, draft: sampleDraft() })).toBeNull();
  });
});

describe("discovery adapter", () => {
  it("proposes mapped fields and never writes the existing brief", () => {
    const selection = confirmSelection(sampleDraft(), null);
    const existing = createEmptyBrief();
    existing.vision = { key: "vision", value: "Keep my current vision sentence.", provenance: "client_statement" };
    const before = structuredClone(existing);
    const mapping = mapSelectionToBriefProposals(selection, existing);
    expect(existingBriefUntouchedProof(before, existing)).toBe(true);
    expect(mapping.proposals.find((item) => item.field === "vision")?.conflict).toBe(true);
    expect(mapping.proposals.find((item) => item.field === "projectType")?.proposedValue).toBe(
      "booking_connected_website"
    );
    expect(mapping.untouchedFields).toEqual(
      expect.arrayContaining(["timing", "budget", "bookingProvider", "existingWebsite", "goals"])
    );
    expect(mapping.summary).toContain("prepared on this device");
    expect(mapping.summary).not.toMatch(/\bSent to Neil\b/);
    expect(mapping.summary).not.toMatch(/Added to your account/i);
    const skipped = applyProposals(existing, mapping, { vision: "skip" });
    expect(skipped.vision.value).toBe("Keep my current vision sentence.");
    const replaced = applyProposals(existing, mapping, { vision: "replace" });
    expect(replaced.vision.value).toContain("Meridian Sitting Room");
    const appended = applyProposals(existing, mapping, { vision: "append" });
    expect(appended.vision.value).toContain("Keep my current vision sentence.");
    expect(appended.vision.value).toContain("Meridian Sitting Room");
    expect(existing.vision.value).toBe("Keep my current vision sentence.");
  });

  it("does not infer project type, price, or deadline from an aesthetic choice", () => {
    const draft = createDraft({
      activeDirectionId: "signal",
      paletteId: "signal_ink",
      serviceInterest: "unspecified",
      businessName: "Northwind"
    });
    const mapping = mapSelectionToBriefProposals(confirmSelection(draft, null));
    expect(mapping.proposals.find((item) => item.field === "projectType")).toBeUndefined();
    expect(mapping.unknowns).toContain("projectType");
    expect(mapping.proposals.find((item) => item.field === "budget")).toBeUndefined();
    expect(mapping.proposals.find((item) => item.field === "timing")).toBeUndefined();
  });
});

describe("discovery persistence and safety", () => {
  it("round-trips opted-in storage and handles missing, malformed, and quota states", () => {
    const store = memory();
    const envelope = createEnvelope(sampleDraft(), confirmSelection(sampleDraft(), null), "studio", 2);
    expect(writeDiscovery(store, envelope).ok).toBe(true);
    const read = readDiscovery(store);
    expect(read.ok).toBe(true);
    if (read.ok && read.state === "opted_in") {
      expect(read.envelope.draft.businessName).toBe("Meridian Sitting Room");
      expect(read.envelope.confirmed?.localRevision).toBe(1);
    }
    store.setItem("aethelios.atelier.discovery.v1", "{not json");
    const bad = readDiscovery(store);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.state).toBe("malformed");
    store.setItem("aethelios.atelier.discovery.v1", JSON.stringify({ kind: "discovery_session", version: 1, draft: { catalogVersion: 77 } }));
    const unknown = readDiscovery(store);
    expect(unknown.ok).toBe(false);
    const quotaStore: MemoryStorage = {
      getItem: () => null,
      setItem: () => {
        const error = new Error("full");
        error.name = "QuotaExceededError";
        throw error;
      },
      removeItem: () => undefined
    };
    const quota = writeDiscovery(quotaStore, envelope);
    expect(quota.ok).toBe(false);
    if (!quota.ok) expect(quota.state).toBe("quota");
    expect(clearDiscovery(store).ok).toBe(true);
    expect(readDiscovery(null).ok).toBe(false);
  });

  it("treats hostile and oversized strings as harmless plain text", () => {
    const hostile = "<img src=x onerror=alert(1)> javascript:alert(1) ` + Function('x')";
    const draft = createDraft({
      businessName: hostile,
      headline: hostile,
      likesNote: hostile,
      exclusions: hostile
    });
    expect(draft.businessName.includes("<img")).toBe(true);
    expect(draft.businessName).not.toMatch(/\u0000/);
    const content = buildConceptContent(draft, "lumen");
    expect(content.businessName.startsWith("<img")).toBe(true);
    const mapping = mapSelectionToBriefProposals(confirmSelection(draft, null));
    expect(mapping.summary).toContain("<img");
    const long = "名".repeat(400);
    expect(sanitizePlainText(long, LIMITS.businessName).length).toBe(LIMITS.businessName);
    expect(displayName("   ")).toBe("Your business");
    expect(draftFingerprint(draft)).toBe(selectionFingerprint(confirmSelection(draft, null)));
  });

  it("keeps Aethelios in a curated unavailable state and rejects executable guidance payloads", () => {
    const view = currentGuideView();
    expect(view.state).toBe("unavailable");
    expect(view.labeled).toBe("curated");
    expect(view.body.toLowerCase()).not.toContain("thinking");
    expect(validateGuidanceRequest({ version: 1, kind: "discovery_guidance", payload: { qualities: [] }, jsx: "<script/>" })).toBeNull();
    expect(
      validateGuidanceRequest({
        version: 1,
        kind: "discovery_guidance",
        payload: {
          businessType: "appointment",
          qualities: ["refined"],
          selectedDirectionId: "lumen",
          paletteId: "ivory_hall",
          visualDirectionId: "glass"
        }
      })?.kind
    ).toBe("discovery_guidance");
    expect(DISCOVERY_CATALOG_VERSION).toBe(1);
  });
});
