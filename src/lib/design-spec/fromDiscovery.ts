import { DIRECTIONS, PALETTES, VISUAL_DIRECTION_COPY } from "@/lib/discovery/catalog";
import { buildConceptContent } from "@/lib/discovery/personalize";
import type { DirectionId, DiscoveryDraft } from "@/lib/discovery/types";
import {
  COMPONENTS_FOR_LAYOUT,
  DESIGN_SPEC_KIND,
  DESIGN_SPEC_VERSION,
  LAYOUT_FOR_DIRECTION,
  SECTION_COMPONENT,
  SECTION_IDS,
  TYPEFACES_FOR_LAYOUT,
  type DesignAsset,
  type DesignSpec
} from "./types";
import { validateDesignSpec, type SpecValidation } from "./validate";

export const CONCEPT_THEME_VERSION = 2;

const SCENE_FOR: Record<DirectionId, Record<DiscoveryDraft["visualDirectionId"], { primary: string; secondary: string; fallback: string; alt: string }>> = {
  lumen: {
    glass: {
      primary: "/discovery/scenes/lumen-nocturne.svg",
      secondary: "/discovery/scenes/lumen-glass.svg",
      fallback: "/discovery/materials/arch.svg",
      alt: "Cinematic architectural study — composed night light, not a completed project photograph"
    },
    material: {
      primary: "/discovery/scenes/lumen-material.svg",
      secondary: "/discovery/materials/marble.svg",
      fallback: "/discovery/materials/linen.svg",
      alt: "Tactile dusk study for an editorial interior"
    },
    mark: {
      primary: "/discovery/scenes/lumen-mark.svg",
      secondary: "/discovery/materials/orb.svg",
      fallback: "/discovery/materials/grid.svg",
      alt: "Editorial geometry study"
    }
  },
  hearth: {
    glass: {
      primary: "/discovery/scenes/hearth-light.svg",
      secondary: "/discovery/materials/arch.svg",
      fallback: "/discovery/materials/orb.svg",
      alt: "Warm interior light study"
    },
    material: {
      primary: "/discovery/scenes/hearth-hearth.svg",
      secondary: "/discovery/scenes/hearth-linen.svg",
      fallback: "/discovery/materials/linen.svg",
      alt: "Hospitality material study — cloth, timber, and quiet firelight"
    },
    mark: {
      primary: "/discovery/scenes/hearth-mark.svg",
      secondary: "/discovery/materials/filament.svg",
      fallback: "/discovery/materials/grid.svg",
      alt: "Welcoming graphic study"
    }
  },
  signal: {
    glass: {
      primary: "/discovery/scenes/signal-depth.svg",
      secondary: "/discovery/materials/arch.svg",
      fallback: "/discovery/materials/grid.svg",
      alt: "Precision architecture study"
    },
    material: {
      primary: "/discovery/scenes/signal-material.svg",
      secondary: "/discovery/materials/marble.svg",
      fallback: "/discovery/materials/filament.svg",
      alt: "Structured material study"
    },
    mark: {
      primary: "/discovery/scenes/signal-precision.svg",
      secondary: "/discovery/scenes/signal-grid.svg",
      fallback: "/discovery/materials/grid.svg",
      alt: "Graphic rhythm study for a contemporary practice"
    }
  }
};

export function sceneAssets(directionId: DirectionId, visual: DiscoveryDraft["visualDirectionId"]): DesignAsset[] {
  const scene = SCENE_FOR[directionId][visual];
  return [
    {
      id: "primary",
      href: scene.primary,
      fallbackHref: scene.fallback,
      kind: "svg_plate",
      alt: scene.alt,
      width: 1600,
      height: 1000
    },
    {
      id: "secondary",
      href: scene.secondary,
      fallbackHref: scene.fallback,
      kind: "svg_plate",
      alt: scene.alt,
      width: 1200,
      height: 900
    }
  ];
}

export function specFromDiscovery(draft: DiscoveryDraft, directionId: DirectionId): DesignSpec {
  const content = buildConceptContent(draft, directionId);
  const layoutId = LAYOUT_FOR_DIRECTION[directionId];
  const direction = DIRECTIONS[directionId];
  const palette = PALETTES[draft.paletteId] ?? PALETTES[direction.defaultPalette];
  return {
    version: DESIGN_SPEC_VERSION,
    kind: DESIGN_SPEC_KIND,
    directionId,
    layoutId,
    componentIds: COMPONENTS_FOR_LAYOUT[layoutId],
    paletteId: palette.id,
    visualDirectionId: draft.visualDirectionId,
    typography: TYPEFACES_FOR_LAYOUT[layoutId],
    sections: SECTION_IDS.map((id) => ({ id, componentId: SECTION_COMPONENT[layoutId][id] })),
    copy: {
      kicker: content.kicker,
      headline: content.headline,
      opening: content.opening,
      atmosphere: content.atmosphere,
      imageCaption: content.imageCaption,
      actionLabel: content.actionLabel,
      actionHint: content.actionHint,
      closing: content.closing,
      comparisonFeeling: content.comparisonFeeling,
      comparisonEmphasis: content.comparisonEmphasis,
      comparisonAction: content.comparisonAction
    },
    services: content.services,
    journey: content.journey,
    goal: draft.intentNote.trim() || VISUAL_DIRECTION_COPY[draft.visualDirectionId].summary,
    audience: draft.audience.trim(),
    assets: sceneAssets(directionId, draft.visualDirectionId),
    source: "curated_local",
    themeVersion: CONCEPT_THEME_VERSION
  };
}

export function trustedSpecFromDiscovery(draft: DiscoveryDraft, directionId: DirectionId): DesignSpec {
  const validated = validateDesignSpec(specFromDiscovery(draft, directionId));
  if (validated.ok) return validated.spec;
  return specFromDiscovery(draft, directionId);
}

export type ModelSpecResult =
  | { ok: true; spec: DesignSpec; source: "model_validated" }
  | {
      ok: false;
      code: "invalid" | "incomplete" | "refused" | "timeout" | "cancelled";
      reason: string;
      spec: DesignSpec;
    };

export function specFromModelOutput(
  input: unknown,
  fallback: DesignSpec,
  status: "ok" | "refused" | "timeout" | "cancelled" | "error" = "ok"
): ModelSpecResult {
  if (status === "refused") {
    return { ok: false, code: "refused", reason: "The model refused to produce a specification. Your current direction is unchanged.", spec: fallback };
  }
  if (status === "timeout") {
    return { ok: false, code: "timeout", reason: "The model timed out. Your current direction is unchanged.", spec: fallback };
  }
  if (status === "cancelled") {
    return { ok: false, code: "cancelled", reason: "The request was cancelled. Your current direction is unchanged.", spec: fallback };
  }
  if (input == null) {
    return { ok: false, code: "incomplete", reason: "The model returned no specification. Your current direction is unchanged.", spec: fallback };
  }
  const validated: SpecValidation = validateDesignSpec(input);
  if (!validated.ok) {
    return { ok: false, code: validated.code, reason: validated.reason, spec: fallback };
  }
  return { ok: true, spec: { ...validated.spec, source: "model_proposed" }, source: "model_validated" };
}
