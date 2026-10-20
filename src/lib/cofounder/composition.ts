import type { DesignSpec, TypefaceId } from "@/lib/design-spec/types";
import { PALETTES } from "@/lib/discovery/catalog";
import type { BusinessProfile, StudioLayer, StudioLayoutId } from "@/lib/cofounder/types";

export type StudioLayoutSpec = {
  width: number;
  height: number;
  label: string;
  aspect: string;
  purpose: string;
  safe: { top: number; right: number; bottom: number; left: number };
};

export const STUDIO_LAYOUTS: Record<StudioLayoutId, StudioLayoutSpec> = {
  direction_board: {
    width: 1600, height: 1200, label: "Direction board", aspect: "4 / 3", purpose: "Editable identity direction",
    safe: { top: 8, right: 8, bottom: 8, left: 8 }
  },
  square_announcement: {
    width: 1080,
    height: 1080,
    label: "Square social",
    aspect: "1 / 1",
    purpose: "Feed post",
    safe: { top: 8, right: 8, bottom: 8, left: 8 }
  },
  portrait_social: {
    width: 1080,
    height: 1350,
    label: "Portrait social",
    aspect: "4 / 5",
    purpose: "Portrait feed",
    safe: { top: 8, right: 8, bottom: 10, left: 8 }
  },
  story_portrait: {
    width: 1080,
    height: 1920,
    label: "Story",
    aspect: "9 / 16",
    purpose: "Full-height story",
    safe: { top: 14, right: 8, bottom: 14, left: 8 }
  },
  website_banner: {
    width: 1600,
    height: 900,
    label: "Website banner",
    aspect: "16 / 9",
    purpose: "Site hero",
    safe: { top: 10, right: 8, bottom: 10, left: 8 }
  }
};

export function studioLayouts() {
  return (Object.entries(STUDIO_LAYOUTS) as Array<[StudioLayoutId, StudioLayoutSpec]>).map(([id, value]) => ({
    id,
    ...value
  }));
}

export type BrandPalette = {
  canvas: string;
  ink: string;
  muted: string;
  accent: string;
};

/** Neutral paper is a fallback only; an explicit identity always takes precedence. */
export const CLIENT_ARTWORK_PALETTE: BrandPalette = {
  canvas: "#f4f0e6",
  ink: "#161410",
  muted: "#5a5348",
  accent: "#8a6a32"
};

export const LIFESTYLE_PALETTE: BrandPalette = {
  canvas: "#1c1914",
  ink: "#f6f1e6",
  muted: "#d4c4aa",
  accent: "#c4a36a"
};

export const COMPOSITION_FONTS = {
  headline: {
    family: "Cormorant Garamond",
    fallback: "serif",
    weight: 600,
    lineHeight: 1.12
  },
  body: {
    family: "Figtree",
    fallback: "sans-serif",
    weight: 400,
    lineHeight: 1.38
  }
} as const;

export function paletteForProfile(profile?: Pick<BusinessProfile, "fields"> | null, layoutVersion: 1 | 2 = 2): BrandPalette {
  const fallback = layoutVersion === 1
    ? { canvas: "#2a2218", ink: "#f4efe4", muted: "#c9bba8", accent: "#b5834a" }
    : CLIENT_ARTWORK_PALETTE;
  const notes = profile?.fields.brandNotes.value.toLowerCase() ?? "";
  const name = profile?.fields.name.value.toLowerCase() ?? "";
  if (name.includes("lifestyle") || notes.includes("lifestyle")) {
    return LIFESTYLE_PALETTE;
  }
  if (!notes.trim()) return fallback;
  if (notes.includes("slate") || notes.includes("steel")) {
    return { canvas: "#1b2024", ink: "#eef3f6", muted: "#a8b4bc", accent: "#7f93a3" };
  }
  if (notes.includes("forest") || notes.includes("cedar")) {
    return { canvas: "#1c241c", ink: "#eef4ea", muted: "#b4c3aa", accent: "#7d8f55" };
  }
  if (notes.includes("warm stone")) {
    return LIFESTYLE_PALETTE;
  }
  if (notes.includes("champagne") || notes.includes("gold")) {
    if (layoutVersion === 1) return LIFESTYLE_PALETTE;
    return { canvas: "#f4f0e6", ink: "#161410", muted: "#5a5348", accent: "#8a6a32" };
  }
  return fallback;
}

export function paletteForDesignSpec(spec: DesignSpec): BrandPalette {
  const tokens = PALETTES[spec.paletteId].vars;
  return { canvas: tokens.bg, ink: tokens.text, muted: tokens.muted, accent: tokens.accent };
}

// Portable fallbacks remain explicit in exported composition metadata.
const TYPEFACE_FAMILIES: Record<TypefaceId, string> = {
  fraunces: "Georgia", outfit: "Arial", syne: "Verdana", figtree: "Arial"
};
export type CompositionFrame = { x: number; y: number; width: number; height: number };

export type CompositionBox = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
};

export type CompositionSpec = {
  layoutVersion?: 1 | 2;
  layout: StudioLayoutId;
  width: number;
  height: number;
  aspect: string;
  palette: BrandPalette;
  crop: { x: number; y: number; zoom: number };
  backgroundImageUrl?: string | null;
  imageFrame?: CompositionFrame;
  accentRule?: CompositionFrame;
  designSpec?: DesignSpec;
  board?: { swatches: string[]; typeLabel: string; provenance: string };
  logo?: { src: string; x: number; y: number; width: number; height: number };
  headline: CompositionBox;
  body: CompositionBox;
};

export type CoverCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * CSS-cover equivalent: scale image to cover dest, then honor focal point + zoom.
 * Used by both preview positioning and canvas export.
 */
export function coverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  destWidth: number,
  destHeight: number,
  cropX = 50,
  cropY = 50,
  zoom = 1
): CoverCropRect {
  const safeZoom = Math.max(1, zoom);
  const cover = Math.max(destWidth / sourceWidth, destHeight / sourceHeight) * safeZoom;
  const width = sourceWidth * cover;
  const height = sourceHeight * cover;
  const focusX = Math.min(100, Math.max(0, cropX)) / 100;
  const focusY = Math.min(100, Math.max(0, cropY)) / 100;
  const x = (destWidth - width) * focusX;
  const y = (destHeight - height) * focusY;
  return {
    x: x === 0 ? 0 : x,
    y: y === 0 ? 0 : y,
    width,
    height
  };
}

export function wrapLines(
  text: string,
  maxWidth: number,
  measure: (value: string) => number
): string[] {
  if (!text) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && measure(next) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Scale a canonical composition length onto the displayed preview width. */
export function previewScale(outputWidth: number, previewWidth: number) {
  if (outputWidth <= 0) return 0;
  return previewWidth / outputWidth;
}

export function scaleCompositionPx(canonicalPx: number, outputWidth: number, previewWidth: number) {
  return canonicalPx * previewScale(outputWidth, previewWidth);
}

/** CSS font-size that tracks the preview container, not a guessed 100px box. */
export function previewFontCss(fontSize: number, compositionWidth: number) {
  return `calc(${fontSize} * 100cqw / ${compositionWidth})`;
}

export function fontSizeFor(layout: StudioLayoutSpec, kind: "headline" | "body") {
  const scale = kind === "headline" ? headlineScale(layout) : bodyScale(layout);
  const min = kind === "headline" ? 36 : 20;
  const max = kind === "headline" ? 78 : 32;
  return Math.min(max, Math.max(min, Math.round(layout.width * scale)));
}

function headlineScale(layout: StudioLayoutSpec) {
  if (layout.width / layout.height > 1.4) return 0.048;
  if (layout.height / layout.width > 1.5) return 0.068;
  return 0.058;
}

function bodyScale(layout: StudioLayoutSpec) {
  if (layout.width / layout.height > 1.4) return 0.022;
  if (layout.height / layout.width > 1.5) return 0.03;
  return 0.026;
}

function layerOf(layers: StudioLayer[], kind: StudioLayer["kind"]) {
  return layers.find((layer) => layer.kind === kind);
}

export function layoutTemplate(layoutId: StudioLayoutId, designSpec?: DesignSpec | null, layoutVersion: 1 | 2 = 2) {
  if (layoutVersion === 1 && (designSpec || layoutId === "direction_board")) {
    return legacyDirectionTemplate(layoutId, designSpec)!;
  }
  const layout = STUDIO_LAYOUTS[layoutId];
  const { safe } = layout;
  const contentWidth = 100 - safe.left - safe.right;
  if (layoutId === "direction_board") return {
    headline: { x: 6, y: 6, width: 46, height: 28 },
    body: { x: 6, y: 38, width: 46, height: 24 },
    logo: { x: 76, y: 53, width: 18, height: 9 }
  };
  if (designSpec) {
    const wide = layoutId === "website_banner";
    const tall = layoutId === "story_portrait";
    if (wide) return {
      headline: { x: 6, y: 13, width: 44, height: 36 },
      body: { x: 6, y: 54, width: 43, height: 25 },
      logo: { x: 6, y: 84, width: 16, height: 10 }
    };
    if (designSpec.layoutId === "signal_precision") return {
      headline: { x: 6, y: 16, width: 50, height: 39 },
      body: { x: 6, y: 58, width: 49, height: 27 },
      logo: { x: 6, y: 89, width: 20, height: 7 }
    };
    if (designSpec.layoutId === "hearth_hospitality") return {
      headline: { x: 8, y: 51, width: 84, height: tall ? 19 : 24 },
      body: { x: 8, y: tall ? 74 : 79, width: 84, height: tall ? 18 : 16 },
      logo: { x: 72, y: 37, width: 20, height: 8 }
    };
    return {
      headline: { x: 6, y: 7, width: 88, height: tall ? 18 : 24 },
      body: { x: 6, y: tall ? 28 : 34, width: 84, height: tall ? 16 : 15 },
      logo: { x: 72, y: 88, width: 20, height: 8 }
    };
  }
  if (layoutId === "website_banner") {
    return {
      headline: { x: safe.left, y: 18, width: 54, height: 28 },
      body: { x: safe.left, y: 52, width: 48, height: 26 },
      logo: { x: safe.left, y: safe.top, width: 14, height: 12 }
    };
  }
  if (layoutId === "story_portrait") {
    return {
      headline: { x: safe.left, y: 18, width: contentWidth, height: 22 },
      body: { x: safe.left, y: 44, width: contentWidth, height: 24 },
      logo: { x: safe.left, y: 82, width: 22, height: 10 }
    };
  }
  if (layoutId === "portrait_social") {
    return {
      headline: { x: safe.left, y: 10, width: contentWidth, height: 20 },
      body: { x: safe.left, y: 36, width: contentWidth, height: 26 },
      logo: { x: safe.left, y: 84, width: 20, height: 10 }
    };
  }
  return {
    headline: { x: safe.left, y: 12, width: contentWidth, height: 20 },
    body: { x: safe.left, y: 36, width: contentWidth, height: 28 },
    logo: { x: safe.left, y: 80, width: 18, height: 12 }
  };
}

/** Frozen v1 defaults: existing snapshots must never acquire a new composition silently. */
function legacyDirectionTemplate(layoutId: StudioLayoutId, designSpec?: DesignSpec | null) {
  if (layoutId === "direction_board") return {
    headline: { x: 8, y: 12, width: 50, height: 22 },
    body: { x: 8, y: 37, width: 47, height: 24 },
    logo: { x: 70, y: 8, width: 18, height: 10 }
  };
  if (designSpec) {
    const wide = layoutId === "website_banner";
    if (designSpec.layoutId === "signal_precision") return {
      headline: { x: 8, y: 14, width: wide ? 50 : 84, height: 24 },
      body: { x: 8, y: wide ? 48 : 42, width: wide ? 44 : 84, height: 22 },
      logo: { x: 8, y: 78, width: 18, height: 10 }
    };
    if (designSpec.layoutId === "hearth_hospitality") return {
      headline: { x: 10, y: wide ? 18 : 48, width: wide ? 46 : 80, height: 20 },
      body: { x: 10, y: wide ? 50 : 70, width: wide ? 42 : 80, height: 18 },
      logo: { x: 10, y: 7, width: 18, height: 10 }
    };
    return {
      headline: { x: 8, y: wide ? 24 : 12, width: wide ? 48 : 84, height: 24 },
      body: { x: 8, y: wide ? 58 : 42, width: wide ? 44 : 70, height: 22 },
      logo: { x: 8, y: 82, width: 18, height: 10 }
    };
  }
}

/** Large, deliberate image fields keep imagery useful even in a mobile preview. */
export function directionImageFrame(layout: StudioLayoutId, spec: DesignSpec, layoutVersion: 1 | 2 = 2): CompositionFrame {
  if (layoutVersion === 1) {
    if (layout === "direction_board") return { x: 64, y: 24, width: 28, height: 40 };
    if (layout === "website_banner") return { x: 62, y: 8, width: 30, height: 84 };
    if (spec.layoutId === "hearth_hospitality") return { x: 34, y: 7, width: 56, height: 34 };
    return { x: 58, y: 70, width: 34, height: 22 };
  }
  if (layout === "direction_board") return { x: 58, y: 0, width: 42, height: 61 };
  if (layout === "website_banner") return { x: 55, y: 0, width: 45, height: 100 };
  if (spec.layoutId === "hearth_hospitality") return { x: 0, y: 0, width: 100, height: 46 };
  if (spec.layoutId === "signal_precision") return { x: 62, y: 0, width: 38, height: 100 };
  return { x: 0, y: 53, width: 100, height: 47 };
}

export function documentUrl(businessId: string, documentId: string) {
  return `/api/companion/documents/${encodeURIComponent(documentId)}?businessId=${encodeURIComponent(businessId)}`;
}

export function assetUrl(businessId: string, assetId: string) {
  return `/api/companion/assets/${encodeURIComponent(assetId)}?businessId=${encodeURIComponent(businessId)}`;
}

export function buildComposition(input: {
  layout: StudioLayoutId;
  layers: StudioLayer[];
  businessId: string;
  palette?: BrandPalette;
  designSpec?: DesignSpec | null;
  layoutVersion?: 1 | 2;
  profile?: Pick<BusinessProfile, "fields"> | null;
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
}): CompositionSpec {
  const layout = STUDIO_LAYOUTS[input.layout];
  const palette = input.palette ?? (input.designSpec ? paletteForDesignSpec(input.designSpec) : paletteForProfile(input.profile, input.layoutVersion));
  const template = layoutTemplate(input.layout, input.designSpec, input.layoutVersion);
  const headline = layerOf(input.layers, "headline");
  const body = layerOf(input.layers, "body");
  const logo = layerOf(input.layers, "logo");
  const image = layerOf(input.layers, "image");
  const logoSrc =
    input.logoUrl ??
    (logo?.assetId ? assetUrl(input.businessId, logo.assetId) :
      logo?.documentId ? documentUrl(input.businessId, logo.documentId) : undefined);
  return {
    layout: input.layout,
    layoutVersion: input.layoutVersion ?? 2,
    width: layout.width,
    height: layout.height,
    aspect: layout.aspect,
    palette,
    crop: {
      x: image?.cropX ?? 50,
      y: image?.cropY ?? 50,
      zoom: image?.cropZoom ?? 1
    },
    backgroundImageUrl: input.backgroundImageUrl ?? input.designSpec?.assets[0]?.href ?? null,
    ...(input.designSpec ? {
      designSpec: input.designSpec,
      imageFrame: directionImageFrame(input.layout, input.designSpec, input.layoutVersion),
      accentRule: input.layoutVersion === 1
        ? { x: 8, y: input.designSpec.layoutId === "signal_precision" ? 8 : 94, width: input.designSpec.layoutId === "signal_precision" ? 24 : 84, height: 0.5 }
        : input.layout === "direction_board" ? { x: 6, y: 63, width: 88, height: 0.5 }
        : input.designSpec.layoutId === "signal_precision" ? { x: 6, y: 7, width: 24, height: 1.2 }
        : input.designSpec.layoutId === "hearth_hospitality" ? { x: 8, y: 47, width: 16, height: 0.6 }
        : { x: 6, y: 3, width: 88, height: 0.4 }
    } : {}),
    ...(input.layout === "direction_board" ? {
      imageFrame: input.layoutVersion === 1 ? { x: 64, y: 24, width: 28, height: 40 } : { x: 58, y: 0, width: 42, height: 61 },
      board: {
        swatches: [palette.canvas, palette.ink, palette.muted, palette.accent],
        typeLabel: input.designSpec
          ? input.layoutVersion === 1 ? `${input.designSpec.typography.display} / ${input.designSpec.typography.body} · portable canvas fallback` : `${TYPEFACE_FAMILIES[input.designSpec.typography.display]} / ${TYPEFACE_FAMILIES[input.designSpec.typography.body]} · canvas type`
          : "Cormorant Garamond / Figtree",
        provenance: input.designSpec
          ? input.layoutVersion === 1 ? `${input.designSpec.directionId} · theme ${input.designSpec.themeVersion} · ${input.designSpec.source === "curated_local" ? "Curated concept — no live AI" : "Model-proposed specification"}` : `${input.designSpec.directionId.toUpperCase()} · v${input.designSpec.themeVersion} · ${input.designSpec.source === "curated_local" ? "Curated concept — no live AI" : "Model-proposed specification"}`
          : "Saved artwork palette and editable copy — no generation implied"
      }
    } : {}),
    logo:
      logoSrc
        ? {
            src: logoSrc,
            x: logo?.x ?? template.logo.x,
            y: logo?.y ?? template.logo.y,
            width: logo?.width ?? template.logo.width,
            height: logo?.height ?? template.logo.height
          }
        : undefined,
    headline: {
      text: headline?.text ?? "",
      x: headline?.x ?? template.headline.x,
      y: headline?.y ?? template.headline.y,
      width: headline?.width ?? template.headline.width,
      height: headline?.height ?? template.headline.height,
      fontSize: input.layoutVersion !== 1 && (input.designSpec || input.layout === "direction_board") ? Math.round(layout.width * 0.085) : fontSizeFor(layout, "headline"),
      lineHeight: COMPOSITION_FONTS.headline.lineHeight,
      fontFamily: input.designSpec ? TYPEFACE_FAMILIES[input.designSpec.typography.display] : COMPOSITION_FONTS.headline.family,
      fontWeight: COMPOSITION_FONTS.headline.weight,
      color: palette.ink
    },
    body: {
      text: body?.text ?? "",
      x: body?.x ?? template.body.x,
      y: body?.y ?? template.body.y,
      width: body?.width ?? template.body.width,
      height: body?.height ?? template.body.height,
      fontSize: input.layoutVersion !== 1 && (input.designSpec || input.layout === "direction_board") ? Math.round(layout.width * 0.036) : fontSizeFor(layout, "body"),
      lineHeight: COMPOSITION_FONTS.body.lineHeight,
      fontFamily: input.designSpec ? TYPEFACE_FAMILIES[input.designSpec.typography.body] : COMPOSITION_FONTS.body.family,
      fontWeight: COMPOSITION_FONTS.body.weight,
      color: palette.muted
    }
  };
}

export function layersFromControls(input: {
  headline: string;
  body: string;
  layout: StudioLayoutId;
  designSpec?: DesignSpec | null;
  layoutVersion?: 1 | 2;
  logoDocumentId?: string;
  logoAssetId?: string;
  logoX?: number;
  logoY?: number;
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
}): StudioLayer[] {
  const template = layoutTemplate(input.layout, input.designSpec, input.layoutVersion);
  const layers: StudioLayer[] = [
    {
      id: "headline",
      kind: "headline",
      text: input.headline,
      ...template.headline
    },
    {
      id: "body",
      kind: "body",
      text: input.body,
      ...template.body
    },
    {
      id: "image",
      kind: "image",
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      cropX: input.cropX ?? 50,
      cropY: input.cropY ?? 50,
      cropZoom: input.cropZoom ?? 1
    }
  ];
  if (input.logoDocumentId || input.logoAssetId) {
    layers.push({
      id: "logo",
      kind: "logo",
      documentId: input.logoDocumentId,
      assetId: input.logoAssetId,
      x: input.logoX ?? template.logo.x,
      y: input.logoY ?? template.logo.y,
      width: template.logo.width,
      height: template.logo.height
    });
  }
  return layers;
}

export function defaultLayers(input: {
  headline: string;
  body: string;
  layout?: StudioLayoutId;
  designSpec?: DesignSpec | null;
  layoutVersion?: 1 | 2;
  logoDocumentId?: string;
  logoAssetId?: string;
}): StudioLayer[] {
  const layout = input.layout ?? "square_announcement";
  const layers = layersFromControls({
    headline: input.headline,
    body: input.body,
    layout,
    designSpec: input.designSpec,
    layoutVersion: input.layoutVersion,
    logoDocumentId: input.logoDocumentId,
    logoAssetId: input.logoAssetId
  });
  if (input.logoAssetId) {
    const logo = layers.find((layer) => layer.kind === "logo");
    if (logo) logo.assetId = input.logoAssetId;
  }
  return layers;
}

export function compositionCssFont(box: CompositionBox) {
  return `${box.fontWeight} ${box.fontSize}px "${box.fontFamily}", ${
    (box.fontFamily === COMPOSITION_FONTS.headline.family || box.fontFamily === "Georgia") ? COMPOSITION_FONTS.headline.fallback : COMPOSITION_FONTS.body.fallback
  }`;
}
