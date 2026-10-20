import type { DatabaseSync } from "node:sqlite";
import { emptyProfile } from "@/lib/cofounder/profile";
import { usageCountsTowardBudget } from "@/lib/cofounder/types";
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
  StudioAsset,
  StudioDraft,
  UsageEvent,
  UsageKind,
  WorkItem
} from "@/lib/cofounder/types";
import {
  mapBlob,
  mapBusiness,
  mapCompanionMessage,
  mapConversation,
  mapDocument,
  mapJob,
  mapMember,
  mapMemory,
  mapProfile,
  mapStudioAsset,
  mapStudioDraft,
  mapUsage,
  mapWorkItem
} from "@/lib/persistence/companionMaps";
import { COMPANION_RESET_SQL, COMPANION_SQL, type CompanionStore } from "@/lib/persistence/companionStore";
import type { Row } from "@/lib/persistence/map";

export class SqliteCompanionStore implements CompanionStore {
  constructor(private readonly db: DatabaseSync) {
    this.db.exec(COMPANION_SQL);
    this.ensureProjectBusinessColumn();
  }

  private ensureProjectBusinessColumn() {
    const columns = this.db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "business_id")) {
      this.db.exec("ALTER TABLE projects ADD COLUMN business_id TEXT");
    }
  }

  reset() {
    this.db.exec(COMPANION_RESET_SQL);
  }

  createBusiness(business: Business) {
    this.db
      .prepare("INSERT INTO businesses(id,owner_id,name,plan_id,created_at,updated_at) VALUES(?,?,?,?,?,?)")
      .run(business.id, business.ownerId, business.name, business.planId, business.createdAt, business.updatedAt);
    return business;
  }

  getBusiness(id: string) {
    const row = this.db.prepare("SELECT * FROM businesses WHERE id = ?").get(id) as Row | undefined;
    return row ? mapBusiness(row) : null;
  }

  listBusinessesForUser(userId: string) {
    const rows = this.db
      .prepare(
        `SELECT DISTINCT b.* FROM businesses b
         LEFT JOIN business_members m ON m.business_id = b.id
         WHERE b.owner_id = ? OR m.user_id = ?
         ORDER BY b.updated_at DESC`
      )
      .all(userId, userId) as Row[];
    return rows.map(mapBusiness);
  }

  listAllBusinesses() {
    return (this.db.prepare("SELECT * FROM businesses ORDER BY updated_at DESC").all() as Row[]).map(mapBusiness);
  }

  updateBusiness(business: Business) {
    this.db
      .prepare("UPDATE businesses SET name=?, plan_id=?, updated_at=? WHERE id=?")
      .run(business.name, business.planId, business.updatedAt, business.id);
    return business;
  }

  addMember(member: BusinessMember) {
    this.db
      .prepare(
        `INSERT INTO business_members(business_id,user_id,role,created_at) VALUES(?,?,?,?)
         ON CONFLICT(business_id,user_id) DO UPDATE SET role=excluded.role`
      )
      .run(member.businessId, member.userId, member.role, member.createdAt);
    return member;
  }

  getMember(businessId: string, userId: string) {
    const row = this.db
      .prepare("SELECT * FROM business_members WHERE business_id = ? AND user_id = ?")
      .get(businessId, userId) as Row | undefined;
    return row ? mapMember(row) : null;
  }

  listMembers(businessId: string) {
    return (this.db.prepare("SELECT * FROM business_members WHERE business_id = ?").all(businessId) as Row[]).map(
      mapMember
    );
  }

  upsertProfile(profile: BusinessProfile) {
    this.db
      .prepare(
        `INSERT INTO business_profiles(business_id,profile_json,updated_at,updated_by) VALUES(?,?,?,?)
         ON CONFLICT(business_id) DO UPDATE SET profile_json=excluded.profile_json, updated_at=excluded.updated_at, updated_by=excluded.updated_by`
      )
      .run(profile.businessId, JSON.stringify(profile), profile.updatedAt, profile.updatedBy ?? null);
    return profile;
  }

  getProfile(businessId: string) {
    const row = this.db.prepare("SELECT * FROM business_profiles WHERE business_id = ?").get(businessId) as
      | Row
      | undefined;
    return row ? mapProfile(row) : emptyProfile(businessId, new Date().toISOString());
  }

  addMemoryProposal(proposal: MemoryProposal) {
    this.db
      .prepare(
        `INSERT INTO business_memory_proposals(id,business_id,field_key,proposed_value,rationale,status,created_at,resolved_at,resolved_by)
         VALUES(?,?,?,?,?,?,?,?,?)`
      )
      .run(
        proposal.id,
        proposal.businessId,
        proposal.fieldKey,
        proposal.proposedValue,
        proposal.rationale ?? null,
        proposal.status,
        proposal.createdAt,
        proposal.resolvedAt ?? null,
        proposal.resolvedBy ?? null
      );
    return proposal;
  }

  getMemoryProposal(id: string) {
    const row = this.db.prepare("SELECT * FROM business_memory_proposals WHERE id = ?").get(id) as Row | undefined;
    return row ? mapMemory(row) : null;
  }

  listMemoryProposals(businessId: string) {
    return (
      this.db
        .prepare("SELECT * FROM business_memory_proposals WHERE business_id = ? ORDER BY created_at DESC")
        .all(businessId) as Row[]
    ).map(mapMemory);
  }

  updateMemoryProposal(proposal: MemoryProposal) {
    this.db
      .prepare(
        "UPDATE business_memory_proposals SET proposed_value=?, rationale=?, status=?, resolved_at=?, resolved_by=? WHERE id=?"
      )
      .run(
        proposal.proposedValue,
        proposal.rationale ?? null,
        proposal.status,
        proposal.resolvedAt ?? null,
        proposal.resolvedBy ?? null,
        proposal.id
      );
    return proposal;
  }

  addDocument(document: BusinessDocument) {
    this.db
      .prepare(
        `INSERT INTO business_documents(id,business_id,title,mime,status,blob_id,source,created_at,deleted_at,provider_file_id,index_status)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        document.id,
        document.businessId,
        document.title,
        document.mime,
        document.status,
        document.blobId ?? null,
        document.source,
        document.createdAt,
        document.deletedAt ?? null,
        document.providerFileId ?? null,
        document.indexStatus ?? "none"
      );
    return document;
  }

  getDocument(id: string) {
    const row = this.db.prepare("SELECT * FROM business_documents WHERE id = ?").get(id) as Row | undefined;
    return row ? mapDocument(row) : null;
  }

  listDocuments(businessId: string) {
    return (this.db.prepare("SELECT * FROM business_documents WHERE business_id = ?").all(businessId) as Row[]).map(
      mapDocument
    );
  }

  updateDocument(document: BusinessDocument) {
    this.db
      .prepare(
        "UPDATE business_documents SET title=?, status=?, blob_id=?, deleted_at=?, provider_file_id=?, index_status=? WHERE id=?"
      )
      .run(
        document.title,
        document.status,
        document.blobId ?? null,
        document.deletedAt ?? null,
        document.providerFileId ?? null,
        document.indexStatus ?? "none",
        document.id
      );
    return document;
  }

  createConversation(conversation: CompanionConversation) {
    this.db
      .prepare(
        "INSERT INTO business_conversations(id,business_id,project_id,title,created_at,updated_at) VALUES(?,?,?,?,?,?)"
      )
      .run(
        conversation.id,
        conversation.businessId,
        conversation.projectId ?? null,
        conversation.title,
        conversation.createdAt,
        conversation.updatedAt
      );
    return conversation;
  }

  getConversation(id: string) {
    const row = this.db.prepare("SELECT * FROM business_conversations WHERE id = ?").get(id) as Row | undefined;
    return row ? mapConversation(row) : null;
  }

  listConversations(businessId: string) {
    return (
      this.db
        .prepare("SELECT * FROM business_conversations WHERE business_id = ? ORDER BY updated_at DESC")
        .all(businessId) as Row[]
    ).map(mapConversation);
  }

  updateConversation(conversation: CompanionConversation) {
    this.db
      .prepare("UPDATE business_conversations SET title=?, project_id=?, updated_at=? WHERE id=?")
      .run(conversation.title, conversation.projectId ?? null, conversation.updatedAt, conversation.id);
    return conversation;
  }

  addMessage(message: CompanionMessage) {
    this.db
      .prepare(
        `INSERT INTO business_messages(id,conversation_id,business_id,project_id,author_kind,body,live_ai,created_at,metadata_json)
         VALUES(?,?,?,?,?,?,?,?,?)`
      )
      .run(
        message.id,
        message.conversationId,
        message.businessId,
        message.projectId ?? null,
        message.authorKind,
        message.body,
        message.liveAi ? 1 : 0,
        message.createdAt,
        message.metadata ? JSON.stringify(message.metadata) : null
      );
    return message;
  }

  listMessages(conversationId: string) {
    return (
      this.db
        .prepare("SELECT * FROM business_messages WHERE conversation_id = ? ORDER BY created_at ASC")
        .all(conversationId) as Row[]
    ).map(mapCompanionMessage);
  }

  addWorkItem(item: WorkItem) {
    this.db
      .prepare(
        `INSERT INTO work_items(id,business_id,project_id,kind,title,status,payload_json,created_by,created_at,updated_at,archived_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        item.id,
        item.businessId,
        item.projectId ?? null,
        item.kind,
        item.title,
        item.status,
        JSON.stringify(item.payload),
        item.createdBy,
        item.createdAt,
        item.updatedAt,
        item.archivedAt ?? null
      );
    return item;
  }

  getWorkItem(id: string) {
    const row = this.db.prepare("SELECT * FROM work_items WHERE id = ?").get(id) as Row | undefined;
    return row ? mapWorkItem(row) : null;
  }

  listWorkItems(businessId: string) {
    return (
      this.db.prepare("SELECT * FROM work_items WHERE business_id = ? ORDER BY updated_at DESC").all(businessId) as Row[]
    ).map(mapWorkItem);
  }

  updateWorkItem(item: WorkItem) {
    this.db
      .prepare(
        "UPDATE work_items SET title=?, status=?, payload_json=?, project_id=?, updated_at=?, archived_at=? WHERE id=?"
      )
      .run(
        item.title,
        item.status,
        JSON.stringify(item.payload),
        item.projectId ?? null,
        item.updatedAt,
        item.archivedAt ?? null,
        item.id
      );
    return item;
  }

  addStudioDraft(draft: StudioDraft) {
    this.db
      .prepare(
        `INSERT INTO studio_drafts(id,business_id,work_item_id,layout,layers_json,selected_asset_id,source_work_item_id,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?)`
      )
      .run(
        draft.id,
        draft.businessId,
        draft.workItemId,
        draft.layout,
        JSON.stringify(draft.layers),
        draft.selectedAssetId ?? null,
        draft.sourceWorkItemId ?? null,
        draft.createdAt,
        draft.updatedAt
      );
    return draft;
  }

  getStudioDraft(id: string) {
    const row = this.db.prepare("SELECT * FROM studio_drafts WHERE id = ?").get(id) as Row | undefined;
    return row ? mapStudioDraft(row) : null;
  }

  listStudioDrafts(businessId: string) {
    return (this.db.prepare("SELECT * FROM studio_drafts WHERE business_id = ?").all(businessId) as Row[]).map(
      mapStudioDraft
    );
  }

  updateStudioDraft(draft: StudioDraft) {
    this.db
      .prepare("UPDATE studio_drafts SET layout=?, layers_json=?, selected_asset_id=?, updated_at=? WHERE id=?")
      .run(draft.layout, JSON.stringify(draft.layers), draft.selectedAssetId ?? null, draft.updatedAt, draft.id);
    return draft;
  }

  addStudioAsset(asset: StudioAsset) {
    this.db
      .prepare(
        `INSERT INTO studio_assets(id,business_id,work_item_id,draft_id,status,prompt,model,blob_id,revision,parent_id,error,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        asset.id,
        asset.businessId,
        asset.workItemId ?? null,
        asset.draftId ?? null,
        asset.status,
        asset.prompt,
        asset.model ?? null,
        asset.blobId ?? null,
        asset.revision,
        asset.parentId ?? null,
        asset.error ?? null,
        asset.createdAt,
        asset.updatedAt
      );
    return asset;
  }

  getStudioAsset(id: string) {
    const row = this.db.prepare("SELECT * FROM studio_assets WHERE id = ?").get(id) as Row | undefined;
    return row ? mapStudioAsset(row) : null;
  }

  listStudioAssets(businessId: string) {
    return (this.db.prepare("SELECT * FROM studio_assets WHERE business_id = ?").all(businessId) as Row[]).map(
      mapStudioAsset
    );
  }

  updateStudioAsset(asset: StudioAsset) {
    this.db
      .prepare("UPDATE studio_assets SET status=?, blob_id=?, error=?, updated_at=?, revision=?, model=? WHERE id=?")
      .run(asset.status, asset.blobId ?? null, asset.error ?? null, asset.updatedAt, asset.revision, asset.model ?? null, asset.id);
    return asset;
  }

  addUsageEvent(event: UsageEvent) {
    this.db
      .prepare(
        "INSERT INTO usage_events(id,business_id,user_id,kind,units,created_at,metadata_json) VALUES(?,?,?,?,?,?,?)"
      )
      .run(
        event.id,
        event.businessId,
        event.userId,
        event.kind,
        event.units,
        event.createdAt,
        event.metadata ? JSON.stringify(event.metadata) : null
      );
    return event;
  }

  updateUsageEvent(event: UsageEvent) {
    this.db
      .prepare("UPDATE usage_events SET units=?, metadata_json=? WHERE id=?")
      .run(event.units, event.metadata ? JSON.stringify(event.metadata) : null, event.id);
    return event;
  }

  sumUsage(businessId: string, kind: UsageKind, sinceIso: string) {
    const rows = this.db
      .prepare("SELECT * FROM usage_events WHERE business_id=? AND kind=? AND created_at>=?")
      .all(businessId, kind, sinceIso) as Row[];
    return rows
      .map(mapUsage)
      .filter(usageCountsTowardBudget)
      .reduce((sum, event) => sum + event.units, 0);
  }

  countPendingJobs(businessId: string, kind: GenerationJob["kind"]) {
    const row = this.db
      .prepare("SELECT COUNT(*) as total FROM generation_jobs WHERE business_id=? AND kind=? AND status='pending'")
      .get(businessId, kind) as { total: number } | undefined;
    return Number(row?.total ?? 0);
  }

  addJob(job: GenerationJob) {
    this.db
      .prepare(
        `INSERT INTO generation_jobs(id,business_id,owner_id,session_id,kind,status,idempotency_key,created_at,updated_at,result_json,error)
         VALUES(?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        job.id,
        job.businessId,
        job.ownerId,
        job.sessionId,
        job.kind,
        job.status,
        job.idempotencyKey,
        job.createdAt,
        job.updatedAt,
        job.resultJson ?? null,
        job.error ?? null
      );
    return job;
  }

  getJob(id: string) {
    const row = this.db.prepare("SELECT * FROM generation_jobs WHERE id = ?").get(id) as Row | undefined;
    return row ? mapJob(row) : null;
  }

  getJobByIdempotency(businessId: string, key: string) {
    const row = this.db
      .prepare("SELECT * FROM generation_jobs WHERE business_id = ? AND idempotency_key = ?")
      .get(businessId, key) as Row | undefined;
    return row ? mapJob(row) : null;
  }

  updateJob(job: GenerationJob) {
    this.db
      .prepare("UPDATE generation_jobs SET status=?, session_id=?, updated_at=?, result_json=?, error=? WHERE id=?")
      .run(job.status, job.sessionId, job.updatedAt, job.resultJson ?? null, job.error ?? null, job.id);
    return job;
  }

  invalidateJobsForSession(sessionId: string) {
    const result = this.db
      .prepare("UPDATE generation_jobs SET status='invalidated', updated_at=? WHERE session_id=? AND status='pending'")
      .run(new Date().toISOString(), sessionId);
    return Number(result.changes ?? 0);
  }

  putBlob(blob: CompanionBlob) {
    this.db
      .prepare("INSERT INTO companion_blobs(id,business_id,mime,bytes,created_at) VALUES(?,?,?,?,?)")
      .run(blob.id, blob.businessId, blob.mime, Buffer.from(blob.bytes).toString("base64"), blob.createdAt);
    return blob;
  }

  getBlob(id: string) {
    const row = this.db.prepare("SELECT * FROM companion_blobs WHERE id = ?").get(id) as Row | undefined;
    return row ? mapBlob(row) : null;
  }

  deleteBlob(id: string) {
    this.db.prepare("DELETE FROM companion_blobs WHERE id = ?").run(id);
  }
}
