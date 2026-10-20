export const BUSINESS_MEMBER_ROLES = ["owner", "member", "founder"] as const;
export type BusinessMemberRole = (typeof BUSINESS_MEMBER_ROLES)[number];

export const MEMORY_STATUSES = ["pending", "accepted", "edited", "rejected", "deleted"] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const FACT_KINDS = ["confirmed", "preference", "suggestion"] as const;
export type FactKind = (typeof FACT_KINDS)[number];

export const WORK_KINDS = ["draft", "task", "asset", "estimate"] as const;
export type WorkKind = (typeof WORK_KINDS)[number];

export const WORK_STATUSES = [
  "open",
  "in_progress",
  "awaiting_review",
  "approved",
  "exported",
  "done",
  "archived"
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const ASSET_STATUSES = ["pending", "ready", "failed", "invalidated"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const DOCUMENT_STATUSES = ["uploaded", "ready", "failed", "deleted"] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const USAGE_KINDS = ["talk", "image", "voice", "tool"] as const;
export type UsageKind = (typeof USAGE_KINDS)[number];

export const USAGE_EVENT_STATUSES = ["held", "settled", "released"] as const;
export type UsageEventStatus = (typeof USAGE_EVENT_STATUSES)[number];

export const PLAN_IDS = ["atelier", "connected", "partnership"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const PROFILE_FIELD_KEYS = [
  "name",
  "audience",
  "services",
  "products",
  "approvedPrices",
  "tone",
  "priorities",
  "brandNotes"
] as const;
export type ProfileFieldKey = (typeof PROFILE_FIELD_KEYS)[number];

export type ProfileField = {
  key: ProfileFieldKey;
  value: string;
  kind: FactKind;
  source?: string;
  updatedAt?: string;
};

export type ApprovedRate = {
  id: string;
  label: string;
  unit: "each" | "hour" | "project";
  amountCents: number;
  currency: "USD";
  source: string;
  updatedAt: string;
};

export type BrandAssetRef = {
  id: string;
  kind: "logo" | "document" | "image";
  title: string;
  documentId?: string;
  assetId?: string;
};

export type BusinessProfile = {
  businessId: string;
  fields: Record<ProfileFieldKey, ProfileField>;
  approvedRates: ApprovedRate[];
  brandAssets: BrandAssetRef[];
  sourceDocumentIds: string[];
  updatedAt: string;
  updatedBy?: string;
};

export type Business = {
  id: string;
  ownerId: string;
  name: string;
  planId: PlanId;
  createdAt: string;
  updatedAt: string;
};

export type BusinessMember = {
  businessId: string;
  userId: string;
  role: BusinessMemberRole;
  createdAt: string;
};

export type MemoryProposal = {
  id: string;
  businessId: string;
  fieldKey: ProfileFieldKey;
  proposedValue: string;
  rationale?: string;
  status: MemoryStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type BusinessDocument = {
  id: string;
  businessId: string;
  title: string;
  mime: string;
  status: DocumentStatus;
  blobId?: string;
  source: "owner_upload" | "imported_url";
  createdAt: string;
  deletedAt?: string;
  providerFileId?: string;
  indexStatus?: "none" | "pending" | "ready" | "failed";
};

export type CompanionConversation = {
  id: string;
  businessId: string;
  projectId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type CompanionMessage = {
  id: string;
  conversationId: string;
  businessId: string;
  projectId?: string;
  authorKind: "client" | "assistant" | "system";
  body: string;
  liveAi: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type WorkItem = {
  id: string;
  businessId: string;
  projectId?: string;
  kind: WorkKind;
  title: string;
  status: WorkStatus;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
};

export type StudioLayer = {
  id: string;
  kind: "headline" | "body" | "logo" | "image";
  text?: string;
  assetId?: string;
  documentId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  cropX?: number;
  cropY?: number;
  cropZoom?: number;
};

export type StudioLayoutId = "square_announcement" | "portrait_social" | "story_portrait" | "website_banner";

export type StudioDraft = {
  id: string;
  businessId: string;
  workItemId: string;
  layout: StudioLayoutId;
  layers: StudioLayer[];
  selectedAssetId?: string;
  sourceWorkItemId?: string;
  saveRevision: number;
  createdAt: string;
  updatedAt: string;
};

export type StudioAsset = {
  id: string;
  businessId: string;
  workItemId?: string;
  draftId?: string;
  status: AssetStatus;
  prompt: string;
  model?: string;
  blobId?: string;
  revision: number;
  parentId?: string;
  compositionRevisionId?: string;
  outputHash?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type CompositionRevision = {
  id: string;
  businessId: string;
  draftId: string;
  workItemId?: string;
  version: number;
  layout: StudioLayoutId;
  width: number;
  height: number;
  layers: StudioLayer[];
  palette: { canvas: string; ink: string; muted: string; accent: string };
  composition: Record<string, unknown>;
  rendererVersion?: string;
  outputHash?: string;
  createdAt: string;
  createdBy: string;
};

export const COMPOSITION_RENDERER_VERSION = "atelier-owner-canvas-1";

export type UsageEvent = {
  id: string;
  businessId: string;
  userId: string;
  kind: UsageKind;
  units: number;
  createdAt: string;
  status?: UsageEventStatus;
  operationId?: string;
  attempt?: number;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
};

export function usageEventStatus(event: Pick<UsageEvent, "status" | "metadata">): UsageEventStatus {
  if (event.status === "held" || event.status === "settled" || event.status === "released") return event.status;
  const meta = event.metadata?.status;
  if (meta === "held" || meta === "settled" || meta === "released") return meta;
  return "settled";
}

export function usageCountsTowardBudget(event: Pick<UsageEvent, "status" | "metadata">) {
  const status = usageEventStatus(event);
  return status === "held" || status === "settled";
}

export type GenerationJob = {
  id: string;
  businessId: string;
  ownerId: string;
  sessionId: string;
  kind: "talk" | "image" | "voice";
  status: "pending" | "completed" | "failed" | "invalidated";
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  resultJson?: string;
  error?: string;
  attempt?: number;
};

export type CompanionBlob = {
  id: string;
  businessId: string;
  mime: string;
  bytes: Uint8Array;
  createdAt: string;
};

export type EstimateLine = {
  id: string;
  label: string;
  quantity: number;
  rateId: string;
  amountCents: number;
};

export type PreparedEstimate = {
  currency: "USD";
  lines: EstimateLine[];
  subtotalCents: number;
  labeled: "draft_requires_owner_review";
  notes: string;
};

export type UsageSnapshot = {
  planId: PlanId;
  periodStart: string;
  talkUsed: number;
  talkLimit: number;
  imagesUsed: number;
  imageLimit: number;
  voiceMinutesUsed: number;
  voiceMinuteLimit: number;
  concurrentLimit: number;
  remaining: {
    talk: number;
    images: number;
    voiceMinutes: number;
  };
};

export type TodayView = {
  generatedAt: string;
  unfinishedDrafts: WorkItem[];
  openTasks: WorkItem[];
  pendingApprovals: Array<MemoryProposal | WorkItem>;
  pendingAssets: StudioAsset[];
  continueItemId?: string;
  continuePreviewAssetId?: string;
  emptyReason?: string;
};

export type AuthorizedBusinessContext = {
  business: Business;
  membership: BusinessMember;
  profile: BusinessProfile;
  documents: BusinessDocument[];
  projects: Array<{ id: string; title: string; status: string }>;
  memoryPending: MemoryProposal[];
};
