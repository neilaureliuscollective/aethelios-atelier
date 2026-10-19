import { describe, expect, it } from "vitest";
import { createDraft, confirmSelection } from "@/lib/discovery";
import { specFromDiscovery, specFromModelOutput, trustedSpecFromDiscovery } from "./fromDiscovery";
import { DESIGN_SPEC_VERSION, LAYOUT_FOR_DIRECTION } from "./types";
import { validateDesignSpec } from "./validate";

const draft = createDraft({
  businessName: "Northwind Practice",
  businessType: "appointment",
  intent: "clearer_presence",
  audience: "Adults seeking a calm first visit.",
  qualities: ["refined"],
  paletteId: "nocturne",
  visualDirectionId: "glass",
  activeDirectionId: "lumen"
});

describe("design specification adapter", () => {
  it("builds a validated spec from discovery answers without calling a model", () => {
    const spec = trustedSpecFromDiscovery(draft, "lumen");
    expect(spec.version).toBe(DESIGN_SPEC_VERSION);
    expect(spec.source).toBe("curated_local");
    expect(spec.layoutId).toBe(LAYOUT_FOR_DIRECTION.lumen);
    expect(spec.copy.headline).toBeTruthy();
    expect(spec.assets[0]?.href.startsWith("/discovery/")).toBe(true);
    expect(validateDesignSpec(spec).ok).toBe(true);
  });

  it("keeps each direction on its trusted layout", () => {
    expect(specFromDiscovery(draft, "hearth").layoutId).toBe("hearth_hospitality");
    expect(specFromDiscovery(draft, "signal").layoutId).toBe("signal_precision");
  });

  it("refuses executable model output and preserves the fallback spec", () => {
    const fallback = specFromDiscovery(draft, "lumen");
    const refused = specFromModelOutput({ jsx: "<script/>" }, fallback);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.spec).toEqual(fallback);
      expect(refused.code).toBe("invalid");
    }
    const timeout = specFromModelOutput(null, fallback, "timeout");
    expect(timeout.ok).toBe(false);
    if (!timeout.ok) expect(timeout.code).toBe("timeout");
  });

  it("accepts a valid model-shaped spec only after independent validation", () => {
    const curated = specFromDiscovery(draft, "lumen");
    const result = specFromModelOutput({ ...curated, source: "model_proposed" }, curated);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spec.source).toBe("model_proposed");
  });

  it("does not reinterpret a confirmed ivory snapshot when building a later spec", () => {
    const ivory = createDraft({ ...draft, paletteId: "ivory_hall" });
    const confirmed = confirmSelection(ivory, null);
    const later = createDraft({ ...ivory, paletteId: "nocturne", headline: "Changed later" });
    expect(confirmed.visualPreferences.paletteId).toBe("ivory_hall");
    expect(later.paletteId).toBe("nocturne");
    expect(specFromDiscovery(ivory, "lumen").paletteId).toBe("ivory_hall");
  });
});
