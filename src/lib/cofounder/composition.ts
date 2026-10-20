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

/** Client artwork defaults to warm stone — not Atelier emerald and gold. */
export const CLIENT_ARTWORK_PALETTE: BrandPalette = {
  canvas: "#2a2218",
  ink: "#f4efe4",
  muted: "#c9bba8",
  accent: "#b5834a"
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

export function paletteForProfile(profile?: Pick<BusinessProfile, "fields"> | null): BrandPalette {
  const notes = profile?.fields.brandNotes.value.toLowerCase() ?? "";
  const name = profile?.fields.name.value.toLowerCase() ?? "";
  if (name.includes("lifestyle") || notes.includes("lifestyle")) {
    return LIFESTYLE_PALETTE;
  }
  if (!notes.trim()) return CLIENT_ARTWORK_PALETTE;
  if (notes.includes("slate") || notes.includes("steel")) {
    return { canvas: "#1b2024", ink: "#eef3f6", muted: "#a8b4bc", accent: "#7f93a3" };
  }
  if (notes.includes("forest") || notes.includes("cedar")) {
    return { canvas: "#1c241c", ink: "#eef4ea", muted: "#b4c3aa", accent: "#7d8f55" };
  }
  if (notes.includes("warm stone") || notes.includes("champagne") || notes.includes("gold")) {
    return LIFESTYLE_PALETTE;
  }
  return CLIENT_ARTWORK_PALETTE;
}

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
  layout: StudioLayoutId;
  width: number;
  height: number;
  aspect: string;
  palette: BrandPalette;
  crop: { x: number; y: number; zoom: number };
  backgroundImageUrl?: string | null;
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

export function layoutTemplate(layoutId: StudioLayoutId) {
  const layout = STUDIO_LAYOUTS[layoutId];
  const { safe } = layout;
  const contentWidth = 100 - safe.left - safe.right;
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
  profile?: Pick<BusinessProfile, "fields"> | null;
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
}): CompositionSpec {
  const layout = STUDIO_LAYOUTS[input.layout];
  const palette = input.palette ?? paletteForProfile(input.profile) ?? CLIENT_ARTWORK_PALETTE;
  const template = layoutTemplate(input.layout);
  const headline = layerOf(input.layers, "headline");
  const body = layerOf(input.layers, "body");
  const logo = layerOf(input.layers, "logo");
  const image = layerOf(input.layers, "image");
  const logoSrc =
    input.logoUrl ??
    (logo?.documentId ? documentUrl(input.businessId, logo.documentId) : undefined);
  return {
    layout: input.layout,
    width: layout.width,
    height: layout.height,
    aspect: layout.aspect,
    palette,
    crop: {
      x: image?.cropX ?? 50,
      y: image?.cropY ?? 50,
      zoom: image?.cropZoom ?? 1
    },
    backgroundImageUrl: input.backgroundImageUrl ?? null,
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
      fontSize: fontSizeFor(layout, "headline"),
      lineHeight: COMPOSITION_FONTS.headline.lineHeight,
      fontFamily: COMPOSITION_FONTS.headline.family,
      fontWeight: COMPOSITION_FONTS.headline.weight,
      color: palette.ink
    },
    body: {
      text: body?.text ?? "",
      x: body?.x ?? template.body.x,
      y: body?.y ?? template.body.y,
      width: body?.width ?? template.body.width,
      height: body?.height ?? template.body.height,
      fontSize: fontSizeFor(layout, "body"),
      lineHeight: COMPOSITION_FONTS.body.lineHeight,
      fontFamily: COMPOSITION_FONTS.body.family,
      fontWeight: COMPOSITION_FONTS.body.weight,
      color: palette.muted
    }
  };
}

export function layersFromControls(input: {
  headline: string;
  body: string;
  layout: StudioLayoutId;
  logoDocumentId?: string;
  logoX?: number;
  logoY?: number;
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
}): StudioLayer[] {
  const template = layoutTemplate(input.layout);
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
  if (input.logoDocumentId) {
    layers.push({
      id: "logo",
      kind: "logo",
      documentId: input.logoDocumentId,
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
  logoDocumentId?: string;
  logoAssetId?: string;
}): StudioLayer[] {
  const layout = input.layout ?? "square_announcement";
  const layers = layersFromControls({
    headline: input.headline,
    body: input.body,
    layout,
    logoDocumentId: input.logoDocumentId
  });
  if (input.logoAssetId) {
    const logo = layers.find((layer) => layer.kind === "logo");
    if (logo) logo.assetId = input.logoAssetId;
  }
  return layers;
}

export function compositionCssFont(box: CompositionBox) {
  return `${box.fontWeight} ${box.fontSize}px "${box.fontFamily}", ${
    box.fontFamily === COMPOSITION_FONTS.headline.family ? COMPOSITION_FONTS.headline.fallback : COMPOSITION_FONTS.body.fallback
  }`;
}
