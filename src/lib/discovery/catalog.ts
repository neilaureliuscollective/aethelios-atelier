import {
  DISCOVERY_CATALOG_VERSION,
  DISCOVERY_TEMPLATE_VERSION,
  type BusinessTypeId,
  type DirectionId,
  type FeelingId,
  type IntentId,
  type PaletteId,
  type QualityId,
  type VisualDirectionId
} from "./types";

export const discoveryCatalogMeta = {
  catalogVersion: DISCOVERY_CATALOG_VERSION,
  templateVersion: DISCOVERY_TEMPLATE_VERSION,
  labeled: "curated_directions" as const
};

export const BUSINESS_TYPE_COPY: Record<
  BusinessTypeId,
  { label: string; summary: string }
> = {
  appointment: {
    label: "Appointment-based",
    summary: "People book time with you — a studio, practice, salon, or similar."
  },
  local_service: {
    label: "Local service",
    summary: "You serve a place and a community, often by visit or appointment."
  },
  independent: {
    label: "Independent professional",
    summary: "Your name and craft are the business."
  },
  not_sure: {
    label: "Not sure yet",
    summary: "You can still explore. Unknowns stay unknown."
  }
};

export const INTENT_COPY: Record<IntentId, { label: string; summary: string }> = {
  clearer_presence: {
    label: "Present the work more clearly",
    summary: "Help people understand what you offer before they reach out."
  },
  easier_booking: {
    label: "Make it easier to book",
    summary: "A calm path from first look to the booking tool you already use."
  },
  truer_feeling: {
    label: "Feel more like the real experience",
    summary: "The site should carry the same mood as walking in."
  },
  connect_booking: {
    label: "Connect an existing booking tool",
    summary: "Keep your current provider for appointments and payments."
  },
  not_sure: {
    label: "Still deciding",
    summary: "Explore directions first. You do not have to name a goal yet."
  }
};

export const FEELING_COPY: Record<FeelingId, { label: string; summary: string }> = {
  calm: { label: "Calm", summary: "Unhurried, quiet, given room to decide." },
  welcomed: { label: "Welcomed", summary: "Warm, human, easy to approach." },
  confident: { label: "Confident", summary: "Clear, decisive, sure of the next step." },
  grounded: { label: "Grounded", summary: "Steady, tactile, trustworthy." },
  contemporary: { label: "Contemporary", summary: "Current, precise, uncluttered." }
};

export const QUALITY_COPY: Record<
  QualityId,
  { label: string; summary: string; example: string }
> = {
  refined: {
    label: "Refined",
    summary: "Editorial spacing, restrained type, quiet luxury without shouting.",
    example: "A wide opening, a single image, and room around every sentence."
  },
  welcoming: {
    label: "Welcoming",
    summary: "Soft structure, human language, an obvious place to begin.",
    example: "A host-like introduction and services that read like a conversation."
  },
  bold: {
    label: "Bold",
    summary: "Strong contrast, graphic type, a decisive call to act.",
    example: "Large name, tight grid, a reserve panel that cannot be missed."
  },
  grounded: {
    label: "Grounded",
    summary: "Material texture, honest hierarchy, no theatrical claims.",
    example: "Cloth, stone, and clear hours instead of spectacle."
  },
  contemporary: {
    label: "Contemporary",
    summary: "Current rhythm, precise alignment, less ornament.",
    example: "Asymmetric crop, sharp rules, and type that does the decorating."
  }
};

export type PaletteTokens = {
  id: PaletteId;
  label: string;
  summary: string;
  preview: [string, string, string];
  vars: {
    bg: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    border: string;
    cta: string;
    ctaText: string;
    rule: string;
  };
};

export const PALETTES: Record<PaletteId, PaletteTokens> = {
  nocturne: {
    id: "nocturne",
    label: "Nocturne",
    summary: "Obsidian ground, ivory type, warm gold edges.",
    preview: ["#080C0B", "#C7A45A", "#F3F0E7"],
    vars: {
      bg: "#080C0B",
      surface: "#121A17",
      surfaceStrong: "#102E25",
      text: "#F3F0E7",
      muted: "#A7B6AC",
      accent: "#E2C988",
      accentText: "#1A1408",
      border: "rgba(199, 164, 90, 0.34)",
      cta: "#C7A45A",
      ctaText: "#1A1408",
      rule: "rgba(243, 240, 231, 0.14)"
    }
  },
  ivory_hall: {
    id: "ivory_hall",
    label: "Ivory hall",
    summary: "Warm paper, charcoal type, deep emerald signals.",
    preview: ["#F3F0E7", "#0B4635", "#121A17"],
    vars: {
      bg: "#F3F0E7",
      surface: "#E8E4D6",
      surfaceStrong: "#D9E3DC",
      text: "#121A17",
      muted: "#3F4C46",
      accent: "#0B4635",
      accentText: "#F3F0E7",
      border: "rgba(18, 26, 23, 0.16)",
      cta: "#0B4635",
      ctaText: "#F3F0E7",
      rule: "rgba(18, 26, 23, 0.12)"
    }
  },
  hearth_linen: {
    id: "hearth_linen",
    label: "Hearth linen",
    summary: "Charcoal walls, sage quiet, pale gold warmth.",
    preview: ["#121A17", "#A7B6AC", "#E2C988"],
    vars: {
      bg: "#161410",
      surface: "#1E241F",
      surfaceStrong: "#243028",
      text: "#F3F0E7",
      muted: "#A7B6AC",
      accent: "#E2C988",
      accentText: "#1A1408",
      border: "rgba(167, 182, 172, 0.28)",
      cta: "#E2C988",
      ctaText: "#1A1408",
      rule: "rgba(226, 201, 136, 0.2)"
    }
  },
  verdant: {
    id: "verdant",
    label: "Verdant chamber",
    summary: "Smoked emerald, ivory reading, gold as a thin edge.",
    preview: ["#102E25", "#F3F0E7", "#C7A45A"],
    vars: {
      bg: "#0C221C",
      surface: "#102E25",
      surfaceStrong: "#0B4635",
      text: "#F3F0E7",
      muted: "#A7B6AC",
      accent: "#C7A45A",
      accentText: "#1A1408",
      border: "rgba(36, 131, 104, 0.4)",
      cta: "#C7A45A",
      ctaText: "#1A1408",
      rule: "rgba(243, 240, 231, 0.14)"
    }
  },
  signal_ink: {
    id: "signal_ink",
    label: "Signal ink",
    summary: "Charcoal field, ivory type, emerald as the mark.",
    preview: ["#121A17", "#F3F0E7", "#248368"],
    vars: {
      bg: "#0B0F0D",
      surface: "#121A17",
      surfaceStrong: "#17241F",
      text: "#F3F0E7",
      muted: "#A7B6AC",
      accent: "#248368",
      accentText: "#F3F0E7",
      border: "rgba(36, 131, 104, 0.45)",
      cta: "#248368",
      ctaText: "#F3F0E7",
      rule: "rgba(243, 240, 231, 0.16)"
    }
  }
};

export const VISUAL_DIRECTION_COPY: Record<
  VisualDirectionId,
  { label: string; summary: string; plate: string }
> = {
  glass: {
    label: "Architectural glass",
    summary: "Arches, reflections, composed light in deep space.",
    plate: "/discovery/materials/arch.svg"
  },
  material: {
    label: "Tactile material",
    summary: "Cloth, stone, and quiet texture instead of spectacle.",
    plate: "/discovery/materials/linen.svg"
  },
  mark: {
    label: "Graphic mark",
    summary: "Geometry and type as the image.",
    plate: "/discovery/materials/grid.svg"
  }
};

export type DirectionDefinition = {
  id: DirectionId;
  name: string;
  epithet: string;
  defaultPalette: PaletteId;
  defaultVisual: VisualDirectionId;
  qualities: QualityId[];
  feeling: string;
  emphasis: string;
  customerAction: string;
  layout: string;
};

export const DIRECTIONS: Record<DirectionId, DirectionDefinition> = {
  lumen: {
    id: "lumen",
    name: "Lumen",
    epithet: "The quiet room",
    defaultPalette: "ivory_hall",
    defaultVisual: "glass",
    qualities: ["refined", "contemporary"],
    feeling: "Unhurried and considered — a visitor is given space before they are asked for anything.",
    emphasis:
      "Editorial opening, one composed image, and services as a measured list rather than a catalog.",
    customerAction: "Request a sitting — a demonstration of the path, not a live booking.",
    layout: "Stacked editorial column with monumental type and hairline rules."
  },
  hearth: {
    id: "hearth",
    name: "Hearth",
    epithet: "The welcome table",
    defaultPalette: "hearth_linen",
    defaultVisual: "material",
    qualities: ["welcoming", "grounded"],
    feeling: "Hosted and human — the site should feel like being received, not processed.",
    emphasis: "Story first, overlapping materials, and services that read as a conversation.",
    customerAction: "Save a time — still a demonstration; the eventual site links to their provider.",
    layout: "Asymmetric two-column hospitality composition."
  },
  signal: {
    id: "signal",
    name: "Signal",
    epithet: "The clear mark",
    defaultPalette: "signal_ink",
    defaultVisual: "mark",
    qualities: ["bold", "contemporary"],
    feeling: "Decisive and current — the next step is obvious without pressure copy.",
    emphasis: "Graphic name, tight grid, and a persistent reserve rail.",
    customerAction: "Reserve — labeled as a path preview, never a commitment.",
    layout: "Poster grid with a sticky action column."
  }
};

export const DIRECTION_ORDER: DirectionId[] = ["lumen", "hearth", "signal"];

export const QUALITY_ORDER: QualityId[] = [
  "refined",
  "welcoming",
  "bold",
  "grounded",
  "contemporary"
];

export function defaultPaletteFor(directionId: DirectionId): PaletteId {
  return DIRECTIONS[directionId].defaultPalette;
}

export function defaultVisualFor(directionId: DirectionId): VisualDirectionId {
  return DIRECTIONS[directionId].defaultVisual;
}
