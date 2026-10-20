import type { BusinessProfile, StudioLayer, StudioLayoutId } from "@/lib/cofounder/types";

export type StudioLayoutSpec = {
  width: number;
  height: number;
  label: string;
  aspect: string;
  purpose: string;
};

export const STUDIO_LAYOUTS: Record<StudioLayoutId, StudioLayoutSpec> = {
  square_announcement: {
    width: 1080,
    height: 1080,
    label: "Square social",
    aspect: "1 / 1",
    purpose: "Feed post"
  },
  portrait_social: {
    width: 1080,
    height: 1350,
    label: "Portrait social",
    aspect: "4 / 5",
    purpose: "Portrait feed"
  },
  story_portrait: {
    width: 1080,
    height: 1920,
    label: "Story",
    aspect: "9 / 16",
    purpose: "Full-height story"
  },
  website_banner: {
    width: 1600,
    height: 900,
    label: "Website banner",
    aspect: "16 / 9",
    purpose: "Site hero"
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

export function paletteForProfile(profile?: Pick<BusinessProfile, "fields"> | null): BrandPalette {
  const notes = profile?.fields.brandNotes.value.toLowerCase() ?? "";
  if (!notes.trim()) return CLIENT_ARTWORK_PALETTE;
  if (notes.includes("slate") || notes.includes("steel")) {
    return { canvas: "#1b2024", ink: "#eef3f6", muted: "#a8b4bc", accent: "#7f93a3" };
  }
  if (notes.includes("forest") || notes.includes("cedar")) {
    return { canvas: "#1c241c", ink: "#eef4ea", muted: "#b4c3aa", accent: "#7d8f55" };
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

function layerOf(layers: StudioLayer[], kind: StudioLayer["kind"]) {
  return layers.find((layer) => layer.kind === kind);
}

function fontSizeFor(layout: StudioLayoutSpec, kind: "headline" | "body") {
  const scale = kind === "headline" ? 0.062 : 0.028;
  return Math.max(18, Math.round(layout.width * scale));
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
  backgroundImageUrl?: string | null;
  logoUrl?: string | null;
}): CompositionSpec {
  const layout = STUDIO_LAYOUTS[input.layout];
  const palette = input.palette ?? CLIENT_ARTWORK_PALETTE;
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
            x: logo?.x ?? 8,
            y: logo?.y ?? 78,
            width: logo?.width ?? 18,
            height: logo?.height ?? 14
          }
        : undefined,
    headline: {
      text: headline?.text ?? "",
      x: headline?.x ?? 8,
      y: headline?.y ?? (input.layout === "website_banner" ? 18 : 12),
      width: headline?.width ?? 84,
      height: headline?.height ?? 18,
      fontSize: fontSizeFor(layout, "headline"),
      color: palette.ink
    },
    body: {
      text: body?.text ?? "",
      x: body?.x ?? 8,
      y: body?.y ?? (input.layout === "website_banner" ? 48 : 34),
      width: body?.width ?? 84,
      height: body?.height ?? 28,
      fontSize: fontSizeFor(layout, "body"),
      color: palette.muted
    }
  };
}

export function defaultLayers(input: {
  headline: string;
  body: string;
  layout?: StudioLayoutId;
  logoDocumentId?: string;
  logoAssetId?: string;
}): StudioLayer[] {
  const layout = input.layout ?? "square_announcement";
  const layers: StudioLayer[] = [
    {
      id: "headline",
      kind: "headline",
      text: input.headline,
      x: 8,
      y: layout === "website_banner" ? 18 : 12,
      width: 84,
      height: 18
    },
    {
      id: "body",
      kind: "body",
      text: input.body,
      x: 8,
      y: layout === "story_portrait" ? 42 : layout === "website_banner" ? 48 : 34,
      width: 84,
      height: 28
    }
  ];
  if (input.logoDocumentId || input.logoAssetId) {
    layers.push({
      id: "logo",
      kind: "logo",
      documentId: input.logoDocumentId,
      assetId: input.logoAssetId,
      x: 8,
      y: layout === "website_banner" ? 8 : 78,
      width: 18,
      height: 14
    });
  }
  return layers;
}
