import { serviceInterestToStoredProjectType } from "@/lib/serviceCategories";
import type { Brief, BriefFieldKey, ProjectType } from "@/lib/types";

export const DISCOVERY_CATALOG_VERSION = 1;
export const DISCOVERY_TEMPLATE_VERSION = 1;
export const DISCOVERY_STORAGE_VERSION = 2;
export const SUPPORTED_STORAGE_VERSIONS = [1, 2] as const;
export const DISCOVERY_STORAGE_KEY = "aethelios.atelier.discovery.v1";
export const DISCOVERY_HANDOFF_KEY = "aethelios.atelier.discovery.handoff.v1";

export const DISCOVERY_PHASES = [
  "enter",
  "intake",
  "qualities",
  "studio",
  "compare",
  "review"
] as const;

export type DiscoveryPhase = (typeof DISCOVERY_PHASES)[number];

export const INTAKE_STEP_MIN = 0;
export const INTAKE_STEP_MAX = 3;
export const INTAKE_STEP_COUNT = INTAKE_STEP_MAX - INTAKE_STEP_MIN + 1;

export const BUSINESS_TYPES = [
  "appointment",
  "local_service",
  "independent",
  "not_sure"
] as const;

export type BusinessTypeId = (typeof BUSINESS_TYPES)[number];

export const INTENT_IDS = [
  "clearer_presence",
  "easier_booking",
  "truer_feeling",
  "connect_booking",
  "not_sure"
] as const;

export type IntentId = (typeof INTENT_IDS)[number];

export const FEELING_IDS = ["calm", "welcomed", "confident", "grounded", "contemporary"] as const;

export type FeelingId = (typeof FEELING_IDS)[number];

export const QUALITY_IDS = ["refined", "welcoming", "bold", "grounded", "contemporary"] as const;

export type QualityId = (typeof QUALITY_IDS)[number];

export const DIRECTION_IDS = ["lumen", "hearth", "signal"] as const;

export type DirectionId = (typeof DIRECTION_IDS)[number];

export const PALETTE_IDS = ["nocturne", "ivory_hall", "hearth_linen", "verdant", "signal_ink"] as const;

export type PaletteId = (typeof PALETTE_IDS)[number];

export const VISUAL_DIRECTION_IDS = ["glass", "material", "mark"] as const;

export type VisualDirectionId = (typeof VISUAL_DIRECTION_IDS)[number];

export const SERVICE_INTEREST_IDS = [
  "unspecified",
  "website",
  "custom_apps_platforms",
  "ecommerce_storefronts",
  "digital_infrastructure",
  "booking_connected_website"
] as const;

export type ServiceInterestId = (typeof SERVICE_INTEREST_IDS)[number];

export const PREVIEW_MODES = ["desktop", "mobile"] as const;

export type PreviewMode = (typeof PREVIEW_MODES)[number];

export const GUIDE_STATES = ["available", "unavailable", "loading", "error"] as const;

export type GuideState = (typeof GUIDE_STATES)[number];

export const PERSISTENCE_STATES = ["memory", "opted_in", "unavailable", "quota", "malformed"] as const;

export type PersistenceState = (typeof PERSISTENCE_STATES)[number];

export type DiscoveryDraft = {
  catalogVersion: number;
  templateVersion: number;
  businessName: string;
  businessType: BusinessTypeId | "";
  intent: IntentId | "";
  intentNote: string;
  audience: string;
  customerFeeling: FeelingId | "";
  qualities: QualityId[];
  headline: string;
  paletteId: PaletteId;
  visualDirectionId: VisualDirectionId;
  activeDirectionId: DirectionId;
  serviceInterest: ServiceInterestId;
  likesNote: string;
  changeNote: string;
  exclusions: string;
  favorites: DirectionId[];
  compareIds: [DirectionId, DirectionId];
};

export type PreviewActionContext = {
  instanceId: string;
  directionId: DirectionId;
  draft: DiscoveryDraft;
  source: "exploration" | "confirmed";
};

export type DiscoverySelection = {
  selectionId: string;
  localRevision: number;
  catalogVersion: number;
  templateVersion: number;
  businessName: string;
  businessType: BusinessTypeId | "";
  audience: string;
  desiredQualities: QualityId[];
  intent: IntentId | "";
  intentNote: string;
  customerFeeling: FeelingId | "";
  selectedDirectionId: DirectionId;
  visualPreferences: {
    paletteId: PaletteId;
    visualDirectionId: VisualDirectionId;
    headline: string;
  };
  serviceInterest: ServiceInterestId;
  likesNote: string;
  changeNote: string;
  visitorNotes: string;
  exclusions: string;
  createdAt: string;
  updatedAt: string;
};

export type BriefProposal = {
  field: BriefFieldKey;
  proposedValue: string;
  reason: string;
  existingValue: string;
  conflict: boolean;
  apply: "propose";
};

export type DiscoveryBriefMapping = {
  version: 2;
  kind: "discovery_brief_mapping";
  sourceSelectionId: string;
  sourceRevision: number;
  briefFingerprint: string;
  proposals: BriefProposal[];
  untouchedFields: BriefFieldKey[];
  summary: string;
  unknowns: string[];
  warnings: string[];
};

export type ApplyDecision = "append" | "replace" | "skip";

export type ApplyResult =
  | { ok: true; brief: Brief }
  | {
      ok: false;
      code: "stale_mapping" | "missing_decision" | "invalid_project_type_append";
      reason: string;
    };

export type ConceptService = {
  id: string;
  title: string;
  detail: string;
};

export type ConceptContent = {
  directionId: DirectionId;
  businessName: string;
  kicker: string;
  headline: string;
  opening: string;
  atmosphere: string;
  imageCaption: string;
  services: ConceptService[];
  journey: Array<{ id: string; title: string; detail: string }>;
  actionLabel: string;
  actionHint: string;
  closing: string;
  comparisonFeeling: string;
  comparisonEmphasis: string;
  comparisonAction: string;
};

export type AetheliosGuidanceRequest = {
  version: 1;
  kind: "discovery_guidance";
  payload: {
    businessType: BusinessTypeId | "";
    qualities: QualityId[];
    selectedDirectionId: DirectionId;
    paletteId: PaletteId;
    visualDirectionId: VisualDirectionId;
  };
};

export type AetheliosGuideView = {
  state: GuideState;
  title: string;
  body: string;
  labeled: "curated" | "live_model";
};

export type StoredDiscoveryEnvelope = {
  version: number;
  kind: "discovery_session";
  savedAt: string;
  draft: DiscoveryDraft;
  confirmed: DiscoverySelection | null;
  phase: DiscoveryPhase;
  intakeStep: number;
};

export function isDirectionId(value: unknown): value is DirectionId {
  return typeof value === "string" && (DIRECTION_IDS as readonly string[]).includes(value);
}

export function isPaletteId(value: unknown): value is PaletteId {
  return typeof value === "string" && (PALETTE_IDS as readonly string[]).includes(value);
}

export function isQualityId(value: unknown): value is QualityId {
  return typeof value === "string" && (QUALITY_IDS as readonly string[]).includes(value);
}

export function isVisualDirectionId(value: unknown): value is VisualDirectionId {
  return typeof value === "string" && (VISUAL_DIRECTION_IDS as readonly string[]).includes(value);
}

export function isBusinessTypeId(value: unknown): value is BusinessTypeId {
  return typeof value === "string" && (BUSINESS_TYPES as readonly string[]).includes(value);
}

export function isIntentId(value: unknown): value is IntentId {
  return typeof value === "string" && (INTENT_IDS as readonly string[]).includes(value);
}

export function isFeelingId(value: unknown): value is FeelingId {
  return typeof value === "string" && (FEELING_IDS as readonly string[]).includes(value);
}

export function isServiceInterestId(value: unknown): value is ServiceInterestId {
  return typeof value === "string" && (SERVICE_INTEREST_IDS as readonly string[]).includes(value);
}

export function isDiscoveryPhase(value: unknown): value is DiscoveryPhase {
  return typeof value === "string" && (DISCOVERY_PHASES as readonly string[]).includes(value);
}

export function serviceInterestToProjectType(interest: ServiceInterestId): ProjectType | null {
  return serviceInterestToStoredProjectType(interest);
}
