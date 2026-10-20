import { describe, expect, it } from "vitest";
import {
  buildComposition,
  coverCropRect,
  defaultLayers,
  LIFESTYLE_PALETTE,
  layersFromControls,
  paletteForProfile,
  previewFontCss,
  previewScale,
  scaleCompositionPx,
  wrapLines
} from "@/lib/cofounder/composition";
import {
  assertExportMatchesRevision,
  decodePng,
  encodeSolidPng,
  inspectPng,
  maxChannelDelta,
  RASTER_TOLERANCE
} from "@/lib/cofounder/png";
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

  it("scales preview fonts from the full output width, not a 100px box", () => {
    expect(previewScale(1080, 360)).toBe(1 / 3);
    expect(scaleCompositionPx(72, 1080, 360)).toBe(24);
    expect(scaleCompositionPx(72, 1080, 1080)).toBe(72);
    expect(previewFontCss(72, 1080)).toBe("calc(72 * 100cqw / 1080)");
    expect(scaleCompositionPx(72, 1080, 360)).not.toBe(72 * (100 / 1080));
    for (const layout of ["square_announcement", "portrait_social", "story_portrait", "website_banner"] as const) {
      const spec = buildComposition({
        layout,
        layers: defaultLayers({
          headline: "A long Lifestyle headline that must wrap instead of shrinking",
          body: "Confirmed facts only.",
          layout
        }),
        businessId: "biz_1"
      });
      expect(scaleCompositionPx(spec.headline.fontSize, spec.width, 390)).toBeGreaterThan(12);
      expect(scaleCompositionPx(spec.headline.fontSize, spec.width, 1440)).toBeGreaterThan(
        scaleCompositionPx(spec.headline.fontSize, spec.width, 390)
      );
    }
  });

  it("rejects a 1×1 PNG as a portrait export", () => {
    const tiny = encodeSolidPng(1, 1);
    expect(inspectPng(tiny).width).toBe(1);
    expect(() => assertExportMatchesRevision(tiny, { width: 1080, height: 1350 })).toThrow(/do not match/);
    const portrait = encodeSolidPng(1080, 1350);
    const inspected = assertExportMatchesRevision(portrait, { width: 1080, height: 1350 });
    expect(inspected.height).toBe(1350);
    expect(inspected.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(decodePng(portrait).width).toBe(1080);
    const headerOnly = inspectPng(portrait);
    const truncated = portrait.slice(0, 40);
    expect(() => decodePng(truncated)).toThrow(/could not be decoded/);
    expect(headerOnly.width).toBe(1080);
    const corruptBody = Uint8Array.from(portrait);
    const corruptAt = Math.min(80, corruptBody.length - 1);
    const current = corruptBody[corruptAt];
    if (current == null) throw new Error("expected a PNG body byte to corrupt");
    corruptBody[corruptAt] = current ^ 0xff;
    expect(inspectPng(corruptBody).width).toBe(1080);
    expect(() => decodePng(corruptBody)).toThrow(/could not be decoded/);
    expect(() => assertExportMatchesRevision(corruptBody, { width: 1080, height: 1350 })).toThrow(
      /could not be decoded/
    );
    const notPng = Uint8Array.from(Buffer.from("not-a-png-file-but-long-enough-to-pass-length"));
    expect(() => inspectPng(notPng)).toThrow(/not a PNG/);
  });

  it("compares decoded pixels with a documented rasterization tolerance", () => {
    const original = encodeSolidPng(64, 48, [42, 34, 24, 255]);
    const again = encodeSolidPng(64, 48, [42, 34, 24, 255]);
    const other = encodeSolidPng(64, 48, [200, 10, 10, 255]);
    expect(maxChannelDelta(decodePng(original).data, decodePng(again).data)).toBe(0);
    expect(maxChannelDelta(decodePng(original).data, decodePng(other).data)).toBeGreaterThan(RASTER_TOLERANCE);
    expect(RASTER_TOLERANCE).toBe(2);
  });

  it("keeps logo proportions and crop geometry inside every layout size", () => {
    const long =
      "Aethelios Lifestyle evening gathering under cedar light with a long confirmed announcement that must wrap rather than invent claims";
    for (const layout of ["square_announcement", "portrait_social", "story_portrait", "website_banner"] as const) {
      const layers = defaultLayers({
        headline: long,
        body: long,
        layout,
        logoDocumentId: "doc_logo"
      });
      layers.push({
        id: "image_crop",
        kind: "image",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        cropX: 20,
        cropY: 80,
        cropZoom: 1.4
      });
      const spec = buildComposition({
        layout,
        layers,
        businessId: "biz_1",
        backgroundImageUrl: "/logo.png"
      });
      expect(spec.width).toBeGreaterThan(0);
      expect(spec.height).toBeGreaterThan(0);
      expect(spec.headline.text.length).toBeGreaterThan(20);
      expect(spec.logo).toBeTruthy();
      const logoRatio = (spec.logo?.width ?? 0) / (spec.logo?.height || 1);
      expect(logoRatio).toBeGreaterThan(0.5);
      expect(logoRatio).toBeLessThan(3);
      const crop = coverCropRect(2000, 800, spec.width, spec.height, 20, 80, 1.4);
      expect(crop.width).toBeGreaterThanOrEqual(spec.width);
      expect(crop.height).toBeGreaterThanOrEqual(spec.height);
    }
  });
});
