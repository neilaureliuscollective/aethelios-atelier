import { describe, expect, it } from "vitest";
import {
  buildComposition,
  coverCropRect,
  defaultLayers,
  LIFESTYLE_PALETTE,
  layersFromControls,
  paletteForProfile,
  wrapLines
} from "@/lib/cofounder/composition";
import { assertExportMatchesRevision, encodeSolidPng, inspectPng } from "@/lib/cofounder/png";
import { lifestyleProfileFields } from "@/lib/cofounder/lifestyle";

describe("canonical studio composition", () => {
  it("uses the same cover crop for preview and export geometry", () => {
    const wide = coverCropRect(2000, 1000, 1080, 1080, 50, 50, 1);
    expect(wide.width).toBe(2160);
    expect(wide.height).toBe(1080);
    expect(wide.x).toBe(-540);
    expect(wide.y).toBe(0);
    const zoomed = coverCropRect(1000, 1000, 1080, 1080, 0, 100, 2);
    expect(zoomed.width).toBe(2160);
    expect(zoomed.x).toBe(0);
    expect(zoomed.y).toBe(1080 - 2160);
  });

  it("wraps long headlines instead of shrinking them", () => {
    const lines = wrapLines("Aethelios Lifestyle evening gathering under cedar light", 120, (value) => value.length * 10);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.length * 10 <= 120 || line.split(" ").length === 1)).toBe(true);
  });

  it("designs each layout instead of stretching one composition", () => {
    const square = buildComposition({
      layout: "square_announcement",
      layers: defaultLayers({ headline: "Evening", body: "Gathering" }),
      businessId: "biz_1"
    });
    const story = buildComposition({
      layout: "story_portrait",
      layers: defaultLayers({ headline: "Evening", body: "Gathering", layout: "story_portrait" }),
      businessId: "biz_1"
    });
    const banner = buildComposition({
      layout: "website_banner",
      layers: defaultLayers({ headline: "Evening", body: "Gathering", layout: "website_banner" }),
      businessId: "biz_1"
    });
    expect(square.width).toBe(1080);
    expect(story.height).toBe(1920);
    expect(banner.width).toBe(1600);
    expect(story.headline.y).not.toBe(square.headline.y);
    expect(banner.headline.width).toBeLessThan(square.headline.width);
    expect(square.headline.fontFamily).toBe("Cormorant Garamond");
    expect(square.body.fontFamily).toBe("Figtree");
  });

  it("applies the Lifestyle palette from confirmed brand notes, not Atelier emerald", () => {
    const profile = { fields: lifestyleProfileFields(new Date().toISOString()) };
    const palette = paletteForProfile(profile);
    expect(palette).toEqual(LIFESTYLE_PALETTE);
    expect(palette.accent).not.toBe("#0b3d2e");
    const spec = buildComposition({
      layout: "portrait_social",
      layers: layersFromControls({
        headline: "AETHELIOS LIFESTYLE",
        body: "The founder’s own product rebrand.",
        layout: "portrait_social"
      }),
      businessId: "biz_1",
      profile
    });
    expect(spec.palette.canvas).toBe(LIFESTYLE_PALETTE.canvas);
    expect(spec.headline.color).toBe(LIFESTYLE_PALETTE.ink);
  });

  it("rejects a 1×1 PNG as a portrait export", () => {
    const tiny = encodeSolidPng(1, 1);
    expect(inspectPng(tiny).width).toBe(1);
    expect(() => assertExportMatchesRevision(tiny, { width: 1080, height: 1350 })).toThrow(/do not match/);
    const portrait = encodeSolidPng(1080, 1350);
    expect(assertExportMatchesRevision(portrait, { width: 1080, height: 1350 }).height).toBe(1350);
  });
});
