import { normalizeProfile } from "@/lib/cofounder/profile";
import { usageEventStatus } from "@/lib/cofounder/types";
import type {
  Business,
  BusinessDocument,
  BusinessMember,
  BusinessProfile,
  CompanionBlob,
  CompanionConversation,
  CompanionMessage,
  GenerationJob,
  MemoryProposal,
  PlanId,
  CompositionRevision,
  StudioAsset,
  StudioDraft,
  UsageEvent,
  WorkItem
} from "@/lib/cofounder/types";
import { asFlag, asNumber, asOptionalString, asString, type Row } from "@/lib/persistence/map";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function mapBusiness(row: Row): Business {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    name: asString(row.name),
    planId: asString(row.plan_id) as PlanId,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };
}

export function mapMember(row: Row): BusinessMember {
  return {
    businessId: asString(row.business_id),
    userId: asString(row.user_id),
    role: row.role as BusinessMember["role"],
    createdAt: asString(row.created_at)
  };
}

export function mapProfile(row: Row): BusinessProfile {
  return normalizeProfile({
    ...parseJson<BusinessProfile>(asString(row.profile_json, "{}"), {
      businessId: asString(row.business_id),
      fields: {} as BusinessProfile["fields"],
      approvedRates: [],
      brandAssets: [],
      sourceDocumentIds: [],
      updatedAt: asString(row.updated_at)
    }),
    businessId: asString(row.business_id),
    updatedAt: asString(row.updated_at),
    updatedBy: asOptionalString(row.updated_by)
  });
}

export function mapMemory(row: Row): MemoryProposal {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    fieldKey: row.field_key as MemoryProposal["fieldKey"],
    proposedValue: asString(row.proposed_value),
    rationale: asOptionalString(row.rationale),
    status: row.status as MemoryProposal["status"],
    createdAt: asString(row.created_at),
    resolvedAt: asOptionalString(row.resolved_at),
    resolvedBy: asOptionalString(row.resolved_by)
  };
}

export function mapDocument(row: Row): BusinessDocument {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    title: asString(row.title),
    mime: asString(row.mime),
    status: row.status as BusinessDocument["status"],
    blobId: asOptionalString(row.blob_id),
    source: row.source as BusinessDocument["source"],
    createdAt: asString(row.created_at),
    deletedAt: asOptionalString(row.deleted_at),
    providerFileId: asOptionalString(row.provider_file_id),
    indexStatus: (asOptionalString(row.index_status) as BusinessDocument["indexStatus"]) ?? "none"
  };
}

export function mapConversation(row: Row): CompanionConversation {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    projectId: asOptionalString(row.project_id),
    title: asString(row.title),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };
}

export function mapCompanionMessage(row: Row): CompanionMessage {
  return {
    id: asString(row.id),
    conversationId: asString(row.conversation_id),
    businessId: asString(row.business_id),
    projectId: asOptionalString(row.project_id),
    authorKind: row.author_kind as CompanionMessage["authorKind"],
    body: asString(row.body),
    liveAi: asFlag(row.live_ai),
    createdAt: asString(row.created_at),
    metadata: row.metadata_json ? parseJson(asString(row.metadata_json), undefined) : undefined
  };
}

export function mapWorkItem(row: Row): WorkItem {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    projectId: asOptionalString(row.project_id),
    kind: row.kind as WorkItem["kind"],
    title: asString(row.title),
    status: row.status as WorkItem["status"],
    payload: parseJson(asString(row.payload_json, "{}"), {}),
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    archivedAt: asOptionalString(row.archived_at)
  };
}

export function mapStudioDraft(row: Row): StudioDraft {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    workItemId: asString(row.work_item_id),
    layout: row.layout as StudioDraft["layout"],
    layers: parseJson(asString(row.layers_json, "[]"), []),
    selectedAssetId: asOptionalString(row.selected_asset_id),
    sourceWorkItemId: asOptionalString(row.source_work_item_id),
    saveRevision: Number(row.save_revision ?? 1) || 1,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };
}

export function mapStudioAsset(row: Row): StudioAsset {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    workItemId: asOptionalString(row.work_item_id),
    draftId: asOptionalString(row.draft_id),
    status: row.status as StudioAsset["status"],
    prompt: asString(row.prompt),
    model: asOptionalString(row.model),
    blobId: asOptionalString(row.blob_id),
    revision: asNumber(row.revision),
    parentId: asOptionalString(row.parent_id),
    compositionRevisionId: asOptionalString(row.composition_revision_id),
    outputHash: asOptionalString(row.output_hash),
    error: asOptionalString(row.error),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };
}

export function mapUsage(row: Row): UsageEvent {
  const metadata = row.metadata_json ? parseJson<Record<string, unknown>>(asString(row.metadata_json), {}) : undefined;
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    userId: asString(row.user_id),
    kind: row.kind as UsageEvent["kind"],
    units: asNumber(row.units),
    createdAt: asString(row.created_at),
    metadata,
    operationId: asOptionalString(row.operation_id),
    expiresAt: asOptionalString(row.expires_at),
    attempt: Number(row.attempt ?? 1) || 1,
    status: usageEventStatus({ status: asOptionalString(row.status) as UsageEvent["status"], metadata })
  };
}

export function mapCompositionRevision(row: Row): CompositionRevision {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    draftId: asString(row.draft_id),
    workItemId: asOptionalString(row.work_item_id),
    version: asNumber(row.version),
    layout: asString(row.layout) as CompositionRevision["layout"],
    width: asNumber(row.width),
    height: asNumber(row.height),
    layers: parseJson(asString(row.layers_json, "[]"), []),
    palette: parseJson(asString(row.palette_json, "{}"), { canvas: "#2a2218", ink: "#f4efe4", muted: "#c9bba8", accent: "#b5834a" }),
    composition: parseJson(asString(row.composition_json, "{}"), {}),
    rendererVersion: asOptionalString(row.renderer_version),
    outputHash: asOptionalString(row.output_hash),
    createdAt: asString(row.created_at),
    createdBy: asString(row.created_by)
  };
}

export function mapJob(row: Row): GenerationJob {
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    ownerId: asString(row.owner_id),
    sessionId: asString(row.session_id),
    kind: row.kind as GenerationJob["kind"],
    status: row.status as GenerationJob["status"],
    idempotencyKey: asString(row.idempotency_key),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    resultJson: asOptionalString(row.result_json),
    error: asOptionalString(row.error),
    attempt: Number(row.attempt ?? 1) || 1
  };
}

export function mapBlob(row: Row): CompanionBlob {
  const raw = asString(row.bytes);
  return {
    id: asString(row.id),
    businessId: asString(row.business_id),
    mime: asString(row.mime),
    bytes: Uint8Array.from(Buffer.from(raw, "base64")),
    createdAt: asString(row.created_at)
  };
}
