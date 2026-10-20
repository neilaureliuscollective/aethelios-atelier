import { trustedSpecFromDiscovery } from "@/lib/design-spec/fromDiscovery";
import { validateDesignSpec } from "@/lib/design-spec/validate";
import { DIRECTIONS, defaultPaletteFor, defaultVisualFor } from "./catalog";
import { visitorNotesFromDraft } from "./personalize";
import { LIMITS, sanitizeMultiline, sanitizePlainText } from "./sanitize";
import {
  DISCOVERY_CATALOG_VERSION,
  DISCOVERY_TEMPLATE_VERSION,
  DIRECTION_IDS,
  isBusinessTypeId,
  isDirectionId,
  isFeelingId,
  isIntentId,
  isPaletteId,
  isQualityId,
  isServiceInterestId,
  isVisualDirectionId,
  type DirectionId,
  type DiscoveryDraft,
  type DiscoverySelection,
  type QualityId
} from "./types";

export function createDraft(partial?: Partial<DiscoveryDraft>): DiscoveryDraft {
  const active = isDirectionId(partial?.activeDirectionId) ? partial.activeDirectionId : "lumen";
  return sanitizeDraft({ ...createBareDraft(), ...partial, activeDirectionId: active });
}

export function hasVisitorAnswers(draft: DiscoveryDraft): boolean {
  return Boolean(
    draft.businessName.trim() ||
      draft.headline.trim() ||
      draft.businessType ||
      draft.intent ||
      draft.intentNote.trim() ||
      draft.audience.trim() ||
      draft.customerFeeling ||
      draft.qualities.length ||
      draft.likesNote.trim() ||
      draft.changeNote.trim() ||
      draft.exclusions.trim() ||
      (draft.serviceInterest && draft.serviceInterest !== "unspecified")
  );
}

export function createSampleExplorationDraft(): DiscoveryDraft {
  return createDraft({
    businessName: "Northridge",
    businessType: "independent",
    intent: "clearer_presence",
    intentNote: "A public presence for a custom home studio.",
    audience: "People looking for a timber home that belongs to its land.",
    customerFeeling: "grounded",
    qualities: ["refined", "grounded"],
    headline: "Homes in harmony with place",
    activeDirectionId: "hearth",
    paletteId: "hearth_linen",
    visualDirectionId: "material",
    serviceInterest: "website"
  });
}

function createBareDraft(): DiscoveryDraft {
  return {
    catalogVersion: DISCOVERY_CATALOG_VERSION,
    templateVersion: DISCOVERY_TEMPLATE_VERSION,
    businessName: "",
    businessType: "",
    intent: "",
    intentNote: "",
    audience: "",
    customerFeeling: "",
    qualities: [],
    headline: "",
    paletteId: "nocturne",
    visualDirectionId: "glass",
    activeDirectionId: "lumen",
    serviceInterest: "unspecified",
    likesNote: "",
    changeNote: "",
    exclusions: "",
    favorites: [],
    compareIds: ["lumen", "hearth"]
  };
}

export function sanitizeDraft(input: Partial<DiscoveryDraft> | DiscoveryDraft): DiscoveryDraft {
  const base = createBareDraft();
  const active = isDirectionId(input.activeDirectionId) ? input.activeDirectionId : base.activeDirectionId;
  const qualities = Array.isArray(input.qualities)
    ? uniqueQualities(input.qualities.filter(isQualityId))
    : [];
  const favorites = Array.isArray(input.favorites)
    ? uniqueDirections(input.favorites.filter(isDirectionId))
    : [];
  const compare: DirectionId[] = Array.isArray(input.compareIds)
    ? uniqueDirections(input.compareIds.filter(isDirectionId))
    : ["lumen", "hearth"];
  const first: DirectionId = compare[0] ?? "lumen";
  const second: DirectionId =
    compare.find((id) => id !== first) ?? (first === "lumen" ? "hearth" : "lumen");
  const compareIds: [DirectionId, DirectionId] = [first, second];

  return {
    catalogVersion: DISCOVERY_CATALOG_VERSION,
    templateVersion: DISCOVERY_TEMPLATE_VERSION,
    businessName: sanitizePlainText(input.businessName, LIMITS.businessName),
    businessType: isBusinessTypeId(input.businessType) ? input.businessType : "",
    intent: isIntentId(input.intent) ? input.intent : "",
    intentNote: sanitizeMultiline(input.intentNote, LIMITS.short),
    audience: sanitizeMultiline(input.audience, LIMITS.audience),
    customerFeeling: isFeelingId(input.customerFeeling) ? input.customerFeeling : "",
    qualities,
    headline: sanitizePlainText(input.headline, LIMITS.headline),
    paletteId: isPaletteId(input.paletteId) ? input.paletteId : defaultPaletteFor(active),
    visualDirectionId: isVisualDirectionId(input.visualDirectionId)
      ? input.visualDirectionId
      : defaultVisualFor(active),
    activeDirectionId: active,
    serviceInterest: isServiceInterestId(input.serviceInterest) ? input.serviceInterest : "unspecified",
    likesNote: sanitizeMultiline(input.likesNote, LIMITS.note),
    changeNote: sanitizeMultiline(input.changeNote, LIMITS.note),
    exclusions: sanitizeMultiline(input.exclusions, LIMITS.note),
    favorites,
    compareIds
  };
}

export function patchDraft(draft: DiscoveryDraft, patch: Partial<DiscoveryDraft>): DiscoveryDraft {
  const next = sanitizeDraft({ ...draft, ...patch });
  if (patch.activeDirectionId && !patch.paletteId && patch.activeDirectionId !== draft.activeDirectionId) {
    const directionChanged = true;
    if (directionChanged && draft.paletteId === defaultPaletteFor(draft.activeDirectionId)) {
      next.paletteId = defaultPaletteFor(next.activeDirectionId);
    }
    if (!patch.visualDirectionId && draft.visualDirectionId === defaultVisualFor(draft.activeDirectionId)) {
      next.visualDirectionId = defaultVisualFor(next.activeDirectionId);
    }
  }
  return next;
}

export function resetField<K extends keyof DiscoveryDraft>(
  draft: DiscoveryDraft,
  key: K
): DiscoveryDraft {
  const blank = createBareDraft();
  if (key === "paletteId") {
    return { ...draft, paletteId: defaultPaletteFor(draft.activeDirectionId) };
  }
  if (key === "visualDirectionId") {
    return { ...draft, visualDirectionId: defaultVisualFor(draft.activeDirectionId) };
  }
  if (key === "activeDirectionId") {
    return {
      ...draft,
      activeDirectionId: "lumen",
      paletteId: draft.paletteId,
      visualDirectionId: draft.visualDirectionId
    };
  }
  return { ...draft, [key]: blank[key] };
}

export function toggleFavorite(draft: DiscoveryDraft, id: DirectionId): DiscoveryDraft {
  const has = draft.favorites.includes(id);
  return {
    ...draft,
    favorites: has ? draft.favorites.filter((item) => item !== id) : [...draft.favorites, id]
  };
}

export function toggleQuality(draft: DiscoveryDraft, id: QualityId): DiscoveryDraft {
  const has = draft.qualities.includes(id);
  return {
    ...draft,
    qualities: has ? draft.qualities.filter((item) => item !== id) : [...draft.qualities, id]
  };
}

export function createSelectionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `dsel_${crypto.randomUUID()}`;
  }
  return `dsel_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function confirmDirection(
  draft: DiscoveryDraft,
  directionId: DirectionId,
  previous: DiscoverySelection | null,
  now = new Date()
): { draft: DiscoveryDraft; selection: DiscoverySelection } {
  const nextDraft = patchDraft(draft, { activeDirectionId: directionId });
  return {
    draft: nextDraft,
    selection: confirmSelection(nextDraft, previous, now)
  };
}

export function confirmSelection(
  draft: DiscoveryDraft,
  previous: DiscoverySelection | null,
  now = new Date()
): DiscoverySelection {
  const timestamp = now.toISOString();
  const sanitized = sanitizeDraft(draft);
  return {
    designSpec: trustedSpecFromDiscovery(sanitized, sanitized.activeDirectionId),
    selectionId: previous?.selectionId ?? createSelectionId(),
    localRevision: (previous?.localRevision ?? 0) + 1,
    catalogVersion: DISCOVERY_CATALOG_VERSION,
    templateVersion: DISCOVERY_TEMPLATE_VERSION,
    businessName: sanitized.businessName,
    businessType: sanitized.businessType,
    audience: sanitized.audience,
    desiredQualities: sanitized.qualities,
    intent: sanitized.intent,
    intentNote: sanitized.intentNote,
    customerFeeling: sanitized.customerFeeling,
    selectedDirectionId: sanitized.activeDirectionId,
    visualPreferences: {
      paletteId: sanitized.paletteId,
      visualDirectionId: sanitized.visualDirectionId,
      headline: sanitized.headline
    },
    serviceInterest: sanitized.serviceInterest,
    likesNote: sanitized.likesNote,
    changeNote: sanitized.changeNote,
    visitorNotes: visitorNotesFromDraft(sanitized),
    exclusions: sanitized.exclusions,
    createdAt: previous?.createdAt ?? timestamp,
    updatedAt: timestamp
  };
}

export function selectionFingerprint(selection: Pick<
  DiscoverySelection,
  | "businessName"
  | "businessType"
  | "audience"
  | "desiredQualities"
  | "intent"
  | "intentNote"
  | "customerFeeling"
  | "selectedDirectionId"
  | "visualPreferences"
  | "serviceInterest"
  | "likesNote"
  | "changeNote"
  | "visitorNotes"
  | "exclusions"
>): string {
  return JSON.stringify({
    businessName: selection.businessName,
    businessType: selection.businessType,
    audience: selection.audience,
    desiredQualities: selection.desiredQualities,
    intent: selection.intent,
    intentNote: selection.intentNote,
    customerFeeling: selection.customerFeeling,
    selectedDirectionId: selection.selectedDirectionId,
    visualPreferences: selection.visualPreferences,
    serviceInterest: selection.serviceInterest,
    likesNote: selection.likesNote,
    changeNote: selection.changeNote,
    visitorNotes: selection.visitorNotes,
    exclusions: selection.exclusions
  });
}

export function draftFingerprint(draft: DiscoveryDraft): string {
  return selectionFingerprint({
    businessName: draft.businessName,
    businessType: draft.businessType,
    audience: draft.audience,
    desiredQualities: draft.qualities,
    intent: draft.intent,
    intentNote: draft.intentNote,
    customerFeeling: draft.customerFeeling,
    selectedDirectionId: draft.activeDirectionId,
    visualPreferences: {
      paletteId: draft.paletteId,
      visualDirectionId: draft.visualDirectionId,
      headline: draft.headline
    },
    serviceInterest: draft.serviceInterest,
    likesNote: draft.likesNote,
    changeNote: draft.changeNote,
    visitorNotes: visitorNotesFromDraft(draft),
    exclusions: draft.exclusions
  });
}

export function hasUnpublishedChanges(
  draft: DiscoveryDraft,
  confirmed: DiscoverySelection | null
): boolean {
  if (!confirmed) return false;
  return draftFingerprint(draft) !== selectionFingerprint(confirmed);
}

export function parseSelection(input: unknown): DiscoverySelection | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DiscoverySelection>;
  if (raw.catalogVersion !== DISCOVERY_CATALOG_VERSION) return null;
  if (raw.templateVersion !== DISCOVERY_TEMPLATE_VERSION) return null;
  if (typeof raw.selectionId !== "string" || !raw.selectionId) return null;
  if (typeof raw.localRevision !== "number" || !Number.isFinite(raw.localRevision) || raw.localRevision < 1) {
    return null;
  }
  if (!isDirectionId(raw.selectedDirectionId)) return null;
  const prefs = raw.visualPreferences;
  if (!prefs || typeof prefs !== "object") return null;
  if (!isPaletteId(prefs.paletteId) || !isVisualDirectionId(prefs.visualDirectionId)) return null;
  if (typeof prefs.headline !== "string") return null;
  if (!isServiceInterestId(raw.serviceInterest)) return null;

  const snapshot = raw.designSpec === undefined ? null : validateDesignSpec(raw.designSpec);
  if (snapshot && (!snapshot.ok || snapshot.spec.directionId !== raw.selectedDirectionId || snapshot.spec.paletteId !== prefs.paletteId || snapshot.spec.visualDirectionId !== prefs.visualDirectionId)) return null;
  const qualities = Array.isArray(raw.desiredQualities) ? raw.desiredQualities.filter(isQualityId) : [];

  return {
    ...(snapshot?.ok ? { designSpec: snapshot.spec } : {}),
    selectionId: sanitizePlainText(raw.selectionId, 80),
    localRevision: Math.floor(raw.localRevision),
    catalogVersion: DISCOVERY_CATALOG_VERSION,
    templateVersion: DISCOVERY_TEMPLATE_VERSION,
    businessName: sanitizePlainText(raw.businessName, LIMITS.businessName),
    businessType: isBusinessTypeId(raw.businessType) ? raw.businessType : "",
    audience: sanitizeMultiline(raw.audience, LIMITS.audience),
    desiredQualities: uniqueQualities(qualities),
    intent: isIntentId(raw.intent) ? raw.intent : "",
    intentNote: sanitizeMultiline(raw.intentNote, LIMITS.short),
    customerFeeling: isFeelingId(raw.customerFeeling) ? raw.customerFeeling : "",
    selectedDirectionId: raw.selectedDirectionId,
    visualPreferences: {
      paletteId: prefs.paletteId,
      visualDirectionId: prefs.visualDirectionId,
      headline: sanitizePlainText(prefs.headline, LIMITS.headline)
    },
    serviceInterest: raw.serviceInterest,
    likesNote: sanitizeMultiline(raw.likesNote, LIMITS.note),
    changeNote: sanitizeMultiline(raw.changeNote, LIMITS.note),
    visitorNotes: sanitizeMultiline(raw.visitorNotes, LIMITS.note * 2),
    exclusions: sanitizeMultiline(raw.exclusions, LIMITS.note),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "",
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : ""
  };
}

export function parseDraft(input: unknown): DiscoveryDraft | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<DiscoveryDraft>;
  if (raw.catalogVersion !== DISCOVERY_CATALOG_VERSION) return null;
  if (raw.templateVersion !== DISCOVERY_TEMPLATE_VERSION) return null;
  return sanitizeDraft(raw);
}

function uniqueQualities(ids: QualityId[]): QualityId[] {
  return [...new Set(ids)];
}

function uniqueDirections(ids: DirectionId[]): DirectionId[] {
  return [...new Set(ids)].filter((id) => DIRECTION_IDS.includes(id));
}

export function directionLabel(id: DirectionId): string {
  return `${DIRECTIONS[id].name} — ${DIRECTIONS[id].epithet}`;
}

export function draftFromSelection(selection: DiscoverySelection): DiscoveryDraft {
  return createDraft({
    businessName: selection.businessName,
    businessType: selection.businessType,
    intent: selection.intent,
    intentNote: selection.intentNote,
    audience: selection.audience,
    customerFeeling: selection.customerFeeling,
    qualities: selection.desiredQualities,
    headline: selection.visualPreferences.headline,
    paletteId: selection.visualPreferences.paletteId,
    visualDirectionId: selection.visualPreferences.visualDirectionId,
    activeDirectionId: selection.selectedDirectionId,
    serviceInterest: selection.serviceInterest,
    likesNote: selection.likesNote,
    changeNote: selection.changeNote,
    exclusions: selection.exclusions
  });
}

export const CONCEPT_SECTIONS = ["opening", "image", "services", "action"] as const;

export type ConceptSection = (typeof CONCEPT_SECTIONS)[number];

export function previewInstanceId(scope: "solo" | "compare" | "recap", directionId: DirectionId, slot = 0): string {
  return `preview-${scope}-${directionId}-${slot}`;
}

export function conceptSectionId(instanceId: string, section: string): string {
  return `${instanceId}-${section}`;
}

export function allPreviewSectionIds(instanceIds: string[]): string[] {
  return instanceIds.flatMap((instanceId) => CONCEPT_SECTIONS.map((section) => conceptSectionId(instanceId, section)));
}
