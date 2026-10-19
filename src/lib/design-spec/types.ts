import type { DirectionId, PaletteId, VisualDirectionId } from "@/lib/discovery/types";

export const DESIGN_SPEC_VERSION = 1;
export const DESIGN_SPEC_KIND = "atelier_concept_spec" as const;

export const LAYOUT_IDS = ["lumen_editorial", "hearth_hospitality", "signal_precision"] as const;
export type LayoutId = (typeof LAYOUT_IDS)[number];

export const COMPONENT_IDS = [
  "nav_editorial",
  "nav_hospitality",
  "nav_precision",
  "hero_cinematic",
  "hero_welcome",
  "hero_mark",
  "atmosphere_plate",
  "services_list",
  "services_conversation",
  "services_grid",
  "journey_editorial",
  "journey_hosted",
  "journey_timeline",
  "cta_sitting",
  "cta_time",
  "cta_reserve"
] as const;
export type ComponentId = (typeof COMPONENT_IDS)[number];

export const TYPEFACE_IDS = ["fraunces", "outfit", "syne", "figtree"] as const;
export type TypefaceId = (typeof TYPEFACE_IDS)[number];

export const ASSET_KINDS = ["svg_plate", "local_fallback"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const SPEC_SOURCES = ["curated_local", "model_proposed"] as const;
export type SpecSource = (typeof SPEC_SOURCES)[number];

export const SECTION_IDS = ["opening", "image", "services", "action"] as const;
export type SpecSectionId = (typeof SECTION_IDS)[number];

export type DesignCopy = {
  kicker: string;
  headline: string;
  opening: string;
  atmosphere: string;
  imageCaption: string;
  actionLabel: string;
  actionHint: string;
  closing: string;
  comparisonFeeling: string;
  comparisonEmphasis: string;
  comparisonAction: string;
};

export type DesignService = {
  id: string;
  title: string;
  detail: string;
};

export type DesignJourneyStep = {
  id: string;
  title: string;
  detail: string;
};

export type DesignAsset = {
  id: string;
  href: string;
  fallbackHref: string;
  kind: AssetKind;
  alt: string;
  width: number;
  height: number;
};

export type DesignSection = {
  id: SpecSectionId;
  componentId: ComponentId;
};

export type DesignSpec = {
  version: typeof DESIGN_SPEC_VERSION;
  kind: typeof DESIGN_SPEC_KIND;
  directionId: DirectionId;
  layoutId: LayoutId;
  componentIds: ComponentId[];
  paletteId: PaletteId;
  visualDirectionId: VisualDirectionId;
  typography: {
    display: TypefaceId;
    body: TypefaceId;
  };
  sections: DesignSection[];
  copy: DesignCopy;
  services: DesignService[];
  journey: DesignJourneyStep[];
  goal: string;
  audience: string;
  assets: DesignAsset[];
  source: SpecSource;
  themeVersion: number;
};

export const COPY_LIMITS = {
  kicker: 80,
  headline: 120,
  opening: 400,
  atmosphere: 280,
  imageCaption: 220,
  actionLabel: 48,
  actionHint: 280,
  closing: 320,
  comparison: 320,
  serviceTitle: 48,
  serviceDetail: 240,
  journeyTitle: 32,
  journeyDetail: 200,
  goal: 200,
  audience: 280,
  alt: 160
} as const;

export const LAYOUT_FOR_DIRECTION: Record<DirectionId, LayoutId> = {
  lumen: "lumen_editorial",
  hearth: "hearth_hospitality",
  signal: "signal_precision"
};

export const COMPONENTS_FOR_LAYOUT: Record<LayoutId, ComponentId[]> = {
  lumen_editorial: [
    "nav_editorial",
    "hero_cinematic",
    "atmosphere_plate",
    "services_list",
    "journey_editorial",
    "cta_sitting"
  ],
  hearth_hospitality: [
    "nav_hospitality",
    "hero_welcome",
    "atmosphere_plate",
    "services_conversation",
    "journey_hosted",
    "cta_time"
  ],
  signal_precision: [
    "nav_precision",
    "hero_mark",
    "atmosphere_plate",
    "services_grid",
    "journey_timeline",
    "cta_reserve"
  ]
};

export const TYPEFACES_FOR_LAYOUT: Record<LayoutId, DesignSpec["typography"]> = {
  lumen_editorial: { display: "fraunces", body: "figtree" },
  hearth_hospitality: { display: "outfit", body: "outfit" },
  signal_precision: { display: "syne", body: "figtree" }
};

export const SECTION_COMPONENT: Record<LayoutId, Record<SpecSectionId, ComponentId>> = {
  lumen_editorial: {
    opening: "hero_cinematic",
    image: "atmosphere_plate",
    services: "services_list",
    action: "cta_sitting"
  },
  hearth_hospitality: {
    opening: "hero_welcome",
    image: "atmosphere_plate",
    services: "services_conversation",
    action: "cta_time"
  },
  signal_precision: {
    opening: "hero_mark",
    image: "atmosphere_plate",
    services: "services_grid",
    action: "cta_reserve"
  }
};
