import { DIRECTION_IDS, isDirectionId, isPaletteId, isVisualDirectionId } from "@/lib/discovery/types";
import {
  ASSET_KINDS,
  COMPONENT_IDS,
  COMPONENTS_FOR_LAYOUT,
  COPY_LIMITS,
  DESIGN_SPEC_KIND,
  DESIGN_SPEC_VERSION,
  LAYOUT_FOR_DIRECTION,
  LAYOUT_IDS,
  SECTION_IDS,
  SPEC_SOURCES,
  TYPEFACE_IDS,
  type ComponentId,
  type DesignAsset,
  type DesignCopy,
  type DesignJourneyStep,
  type DesignSection,
  type DesignService,
  type DesignSpec,
  type LayoutId,
  type SpecSectionId,
  type TypefaceId
} from "./types";

export type SpecIssue = { path: string; message: string };

export type SpecValidation =
  | { ok: true; spec: DesignSpec }
  | { ok: false; code: "invalid" | "incomplete"; reason: string; issues: SpecIssue[] };

const EXECUTABLE = /\b(eval|Function|javascript:|onerror\s*=|onclick\s*=|<\s*script|<\s*iframe)\b/i;

function bounded(value: unknown, max: number, path: string, issues: SpecIssue[]): string {
  if (typeof value !== "string") {
    issues.push({ path, message: "must be a string" });
    return "";
  }
  if (EXECUTABLE.test(value)) {
    issues.push({ path, message: "executable or markup payloads are refused" });
  }
  if (value.length > max) {
    issues.push({ path, message: `exceeds ${max} characters` });
    return value.slice(0, max);
  }
  return value;
}

function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === "string" && (LAYOUT_IDS as readonly string[]).includes(value);
}

function isComponentId(value: unknown): value is ComponentId {
  return typeof value === "string" && (COMPONENT_IDS as readonly string[]).includes(value);
}

function isTypefaceId(value: unknown): value is TypefaceId {
  return typeof value === "string" && (TYPEFACE_IDS as readonly string[]).includes(value);
}

function isSectionId(value: unknown): value is SpecSectionId {
  return typeof value === "string" && (SECTION_IDS as readonly string[]).includes(value);
}

export function validateDesignSpec(input: unknown): SpecValidation {
  const issues: SpecIssue[] = [];
  if (!input || typeof input !== "object") {
    return { ok: false, code: "incomplete", reason: "Design specification is missing.", issues: [{ path: "", message: "not an object" }] };
  }
  const raw = input as Partial<DesignSpec> & Record<string, unknown>;
  if ("jsx" in raw || "html" in raw || "css" in raw || "javascript" in raw || "code" in raw) {
    return {
      ok: false,
      code: "invalid",
      reason: "Executable fields are not allowed on a design specification.",
      issues: [{ path: "", message: "jsx/html/css/code rejected" }]
    };
  }
  if (raw.version !== DESIGN_SPEC_VERSION) {
    issues.push({ path: "version", message: "unsupported specification version" });
  }
  if (raw.kind !== DESIGN_SPEC_KIND) {
    issues.push({ path: "kind", message: "unsupported specification kind" });
  }
  if (!isDirectionId(raw.directionId)) {
    issues.push({ path: "directionId", message: "unknown direction" });
  }
  if (!isLayoutId(raw.layoutId)) {
    issues.push({ path: "layoutId", message: "unknown layout" });
  }
  if (isDirectionId(raw.directionId) && isLayoutId(raw.layoutId) && LAYOUT_FOR_DIRECTION[raw.directionId] !== raw.layoutId) {
    issues.push({ path: "layoutId", message: "layout is not allowed for this direction" });
  }
  if (!isPaletteId(raw.paletteId)) {
    issues.push({ path: "paletteId", message: "unknown palette" });
  }
  if (!isVisualDirectionId(raw.visualDirectionId)) {
    issues.push({ path: "visualDirectionId", message: "unknown visual direction" });
  }
  if (!raw.typography || typeof raw.typography !== "object") {
    issues.push({ path: "typography", message: "missing typography tokens" });
  }
  const display = isTypefaceId(raw.typography?.display) ? raw.typography.display : null;
  const body = isTypefaceId(raw.typography?.body) ? raw.typography.body : null;
  if (!display) issues.push({ path: "typography.display", message: "unknown display typeface" });
  if (!body) issues.push({ path: "typography.body", message: "unknown body typeface" });

  const allowedComponents = isLayoutId(raw.layoutId) ? COMPONENTS_FOR_LAYOUT[raw.layoutId] : [];
  const componentIds = Array.isArray(raw.componentIds) ? raw.componentIds.filter(isComponentId) : [];
  if (!Array.isArray(raw.componentIds) || raw.componentIds.length === 0) {
    issues.push({ path: "componentIds", message: "at least one trusted component id is required" });
  }
  for (const id of componentIds) {
    if (!allowedComponents.includes(id)) {
      issues.push({ path: "componentIds", message: `${id} is not allowed in this layout` });
    }
  }

  const sections = Array.isArray(raw.sections) ? raw.sections : [];
  if (sections.length !== SECTION_IDS.length) {
    issues.push({ path: "sections", message: "section order must include opening, image, services, and action" });
  }
  const seen = new Set<string>();
  const normalizedSections: DesignSection[] = [];
  for (const [index, section] of sections.entries()) {
    if (!section || typeof section !== "object") {
      issues.push({ path: `sections.${index}`, message: "invalid section" });
      continue;
    }
    if (!isSectionId(section.id) || !isComponentId(section.componentId)) {
      issues.push({ path: `sections.${index}`, message: "unknown section or component" });
      continue;
    }
    if (seen.has(section.id)) issues.push({ path: `sections.${index}.id`, message: "duplicate section" });
    seen.add(section.id);
    if (!allowedComponents.includes(section.componentId)) {
      issues.push({ path: `sections.${index}.componentId`, message: "component not allowed for layout" });
    }
    normalizedSections.push({ id: section.id, componentId: section.componentId });
  }

  const copyRaw = raw.copy && typeof raw.copy === "object" ? raw.copy : ({} as DesignCopy);
  const copy: DesignCopy = {
    kicker: bounded(copyRaw.kicker, COPY_LIMITS.kicker, "copy.kicker", issues),
    headline: bounded(copyRaw.headline, COPY_LIMITS.headline, "copy.headline", issues),
    opening: bounded(copyRaw.opening, COPY_LIMITS.opening, "copy.opening", issues),
    atmosphere: bounded(copyRaw.atmosphere, COPY_LIMITS.atmosphere, "copy.atmosphere", issues),
    imageCaption: bounded(copyRaw.imageCaption, COPY_LIMITS.imageCaption, "copy.imageCaption", issues),
    actionLabel: bounded(copyRaw.actionLabel, COPY_LIMITS.actionLabel, "copy.actionLabel", issues),
    actionHint: bounded(copyRaw.actionHint, COPY_LIMITS.actionHint, "copy.actionHint", issues),
    closing: bounded(copyRaw.closing, COPY_LIMITS.closing, "copy.closing", issues),
    comparisonFeeling: bounded(copyRaw.comparisonFeeling, COPY_LIMITS.comparison, "copy.comparisonFeeling", issues),
    comparisonEmphasis: bounded(copyRaw.comparisonEmphasis, COPY_LIMITS.comparison, "copy.comparisonEmphasis", issues),
    comparisonAction: bounded(copyRaw.comparisonAction, COPY_LIMITS.comparison, "copy.comparisonAction", issues)
  };
  if (!copy.headline.trim() || !copy.actionLabel.trim()) {
    issues.push({ path: "copy", message: "headline and action label are required" });
  }

  const services: DesignService[] = Array.isArray(raw.services)
    ? raw.services.slice(0, 4).map((service, index) => ({
        id: bounded((service as DesignService)?.id, 40, `services.${index}.id`, issues) || `service-${index}`,
        title: bounded((service as DesignService)?.title, COPY_LIMITS.serviceTitle, `services.${index}.title`, issues),
        detail: bounded((service as DesignService)?.detail, COPY_LIMITS.serviceDetail, `services.${index}.detail`, issues)
      }))
    : [];
  if (services.length < 1) issues.push({ path: "services", message: "at least one service is required" });

  const journey: DesignJourneyStep[] = Array.isArray(raw.journey)
    ? raw.journey.slice(0, 4).map((step, index) => ({
        id: bounded((step as DesignJourneyStep)?.id, 40, `journey.${index}.id`, issues) || `step-${index}`,
        title: bounded((step as DesignJourneyStep)?.title, COPY_LIMITS.journeyTitle, `journey.${index}.title`, issues),
        detail: bounded((step as DesignJourneyStep)?.detail, COPY_LIMITS.journeyDetail, `journey.${index}.detail`, issues)
      }))
    : [];
  if (journey.length < 1) issues.push({ path: "journey", message: "a customer journey is required" });

  const assets: DesignAsset[] = Array.isArray(raw.assets)
    ? raw.assets.slice(0, 4).map((asset, index) => {
        const item = asset as DesignAsset;
        const href = bounded(item?.href, 180, `assets.${index}.href`, issues);
        const fallbackHref = bounded(item?.fallbackHref, 180, `assets.${index}.fallbackHref`, issues);
        if (href && !href.startsWith("/discovery/")) {
          issues.push({ path: `assets.${index}.href`, message: "assets must be local approved paths" });
        }
        if (fallbackHref && !fallbackHref.startsWith("/discovery/")) {
          issues.push({ path: `assets.${index}.fallbackHref`, message: "fallbacks must be local approved paths" });
        }
        return {
          id: bounded(item?.id, 40, `assets.${index}.id`, issues) || `asset-${index}`,
          href,
          fallbackHref,
          kind: ASSET_KINDS.includes(item?.kind) ? item.kind : "local_fallback",
          alt: bounded(item?.alt, COPY_LIMITS.alt, `assets.${index}.alt`, issues),
          width: typeof item?.width === "number" && item.width > 0 ? Math.min(item.width, 2400) : 1600,
          height: typeof item?.height === "number" && item.height > 0 ? Math.min(item.height, 1600) : 1000
        };
      })
    : [];
  if (assets.length < 1) issues.push({ path: "assets", message: "a local atmosphere asset is required" });

  const source = SPEC_SOURCES.includes(raw.source as DesignSpec["source"]) ? raw.source : null;
  if (!source) issues.push({ path: "source", message: "source must be curated_local or model_proposed" });

  const fatal = issues.some((issue) =>
    ["version", "kind", "directionId", "layoutId", "paletteId", "copy", "assets"].some((key) => issue.path === key || issue.path.startsWith(`${key}.`))
  );

  if (issues.length && (fatal || !isDirectionId(raw.directionId) || !isLayoutId(raw.layoutId) || !isPaletteId(raw.paletteId))) {
    return {
      ok: false,
      code: issues.some((issue) => issue.message.includes("required") || issue.message.includes("missing")) ? "incomplete" : "invalid",
      reason: issues[0]?.message ?? "Design specification is invalid.",
      issues
    };
  }

  if (!isDirectionId(raw.directionId) || !isLayoutId(raw.layoutId) || !isPaletteId(raw.paletteId) || !isVisualDirectionId(raw.visualDirectionId) || !display || !body || !source) {
    return { ok: false, code: "incomplete", reason: "Design specification is incomplete.", issues };
  }

  return {
    ok: true,
    spec: {
      version: DESIGN_SPEC_VERSION,
      kind: DESIGN_SPEC_KIND,
      directionId: raw.directionId,
      layoutId: raw.layoutId,
      componentIds: componentIds.length ? componentIds : allowedComponents,
      paletteId: raw.paletteId,
      visualDirectionId: raw.visualDirectionId,
      typography: { display, body },
      sections: normalizedSections.length
        ? normalizedSections
        : SECTION_IDS.map((id) => ({ id, componentId: allowedComponents[0] ?? "atmosphere_plate" })),
      copy,
      services,
      journey,
      goal: bounded(raw.goal, COPY_LIMITS.goal, "goal", issues),
      audience: bounded(raw.audience, COPY_LIMITS.audience, "audience", issues),
      assets,
      source,
      themeVersion: typeof raw.themeVersion === "number" && Number.isFinite(raw.themeVersion) ? raw.themeVersion : 2
    }
  };
}

export const OPENAI_DESIGN_SPEC_SCHEMA = {
  name: "atelier_concept_spec",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "version",
      "kind",
      "directionId",
      "layoutId",
      "componentIds",
      "paletteId",
      "visualDirectionId",
      "typography",
      "sections",
      "copy",
      "services",
      "journey",
      "goal",
      "audience",
      "assets",
      "source",
      "themeVersion"
    ],
    properties: {
      version: { type: "number", enum: [DESIGN_SPEC_VERSION] },
      kind: { type: "string", enum: [DESIGN_SPEC_KIND] },
      directionId: { type: "string", enum: [...DIRECTION_IDS] },
      layoutId: { type: "string", enum: [...LAYOUT_IDS] },
      componentIds: { type: "array", items: { type: "string", enum: [...COMPONENT_IDS] } },
      paletteId: { type: "string" },
      visualDirectionId: { type: "string" },
      typography: {
        type: "object",
        additionalProperties: false,
        required: ["display", "body"],
        properties: {
          display: { type: "string", enum: [...TYPEFACE_IDS] },
          body: { type: "string", enum: [...TYPEFACE_IDS] }
        }
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "componentId"],
          properties: {
            id: { type: "string", enum: [...SECTION_IDS] },
            componentId: { type: "string", enum: [...COMPONENT_IDS] }
          }
        }
      },
      copy: {
        type: "object",
        additionalProperties: false,
        required: [
          "kicker",
          "headline",
          "opening",
          "atmosphere",
          "imageCaption",
          "actionLabel",
          "actionHint",
          "closing",
          "comparisonFeeling",
          "comparisonEmphasis",
          "comparisonAction"
        ],
        properties: {
          kicker: { type: "string" },
          headline: { type: "string" },
          opening: { type: "string" },
          atmosphere: { type: "string" },
          imageCaption: { type: "string" },
          actionLabel: { type: "string" },
          actionHint: { type: "string" },
          closing: { type: "string" },
          comparisonFeeling: { type: "string" },
          comparisonEmphasis: { type: "string" },
          comparisonAction: { type: "string" }
        }
      },
      services: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "detail"],
          properties: { id: { type: "string" }, title: { type: "string" }, detail: { type: "string" } }
        }
      },
      journey: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "detail"],
          properties: { id: { type: "string" }, title: { type: "string" }, detail: { type: "string" } }
        }
      },
      goal: { type: "string" },
      audience: { type: "string" },
      assets: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "href", "fallbackHref", "kind", "alt", "width", "height"],
          properties: {
            id: { type: "string" },
            href: { type: "string" },
            fallbackHref: { type: "string" },
            kind: { type: "string", enum: [...ASSET_KINDS] },
            alt: { type: "string" },
            width: { type: "number" },
            height: { type: "number" }
          }
        }
      },
      source: { type: "string", enum: [...SPEC_SOURCES] },
      themeVersion: { type: "number" }
    }
  }
} as const;
