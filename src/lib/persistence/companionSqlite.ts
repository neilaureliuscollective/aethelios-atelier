import type { DatabaseSync } from "node:sqlite";
import { emptyProfile } from "@/lib/cofounder/profile";
import { usageCountsTowardBudget } from "@/lib/cofounder/types";
import type {
  Business,
  BusinessConfirmation,
  BusinessDocument,
  BusinessMember,
  BusinessProfile,
  GuestWorkClaim,
  CompanionBlob,
  CompanionConversation,
  CompanionMessage,
  GenerationJob,
  MemoryProposal,
  CompositionRevision,
  StudioAsset,
  StudioDraft,
  UsageEvent,
  UsageKind,
  WorkItem
} from "@/lib/cofounder/types";
import { throwIfUnique } from "@/lib/persistence/unique";
import {
  mapBlob,
  mapBusiness,
  mapConfirmation,
  mapGuestClaim,
  mapCompanionMessage,
  mapConversation,
  mapDocument,
  mapJob,
  mapMember,
  mapMemory,
  mapProfile,
  mapCompositionRevision,
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
    this.ensureUsageColumns();
    this.ensureAssetRevisionColumn();
    this.ensureOutputHashColumns();
    this.ensureDraftRevisionColumn();
    this.ensureJobAttemptColumn();
  }

  private ensureProjectBusinessColumn() {
    const columns = this.db.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "business_id")) {
      this.db.exec("ALTER TABLE projects ADD COLUMN business_id TEXT");
    }
  }

  private ensureUsageColumns() {
    const columns = this.db.prepare("PRAGMA table_info(usage_events)").all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has("operation_id")) this.db.exec("ALTER TABLE usage_events ADD COLUMN operation_id TEXT");
    if (!names.has("status")) this.db.exec("ALTER TABLE usage_events ADD COLUMN status TEXT");
    if (!names.has("expires_at")) this.db.exec("ALTER TABLE usage_events ADD COLUMN expires_at TEXT");
    if (!names.has("attempt")) this.db.exec("ALTER TABLE usage_events ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1");
    this.db.exec(
      "CREATE UNIQUE INDEX IF NOT EXISTS usage_events_operation_idx ON usage_events (business_id, operation_id) WHERE operation_id IS NOT NULL"
    );
  }

  private ensureJobAttemptColumn() {
    const columns = this.db.prepare("PRAGMA table_info(generation_jobs)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "attempt")) {
      this.db.exec("ALTER TABLE generation_jobs ADD COLUMN attempt INTEGER NOT NULL DEFAULT 1");
    }
  }

  private ensureAssetRevisionColumn() {
    const columns = this.db.prepare("PRAGMA table_info(studio_assets)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "composition_revision_id")) {
      this.db.exec("ALTER TABLE studio_assets ADD COLUMN composition_revision_id TEXT");
    }
  }

  private ensureOutputHashColumns() {
    const assets = this.db.prepare("PRAGMA table_info(studio_assets)").all() as Array<{ name: string }>;
    if (!assets.some((column) => column.name === "output_hash")) {
      this.db.exec("ALTER TABLE studio_assets ADD COLUMN output_hash TEXT");
    }
    const revisions = this.db.prepare("PRAGMA table_info(studio_composition_revisions)").all() as Array<{ name: string }>;
    const names = new Set(revisions.map((column) => column.name));
    if (!names.has("renderer_version")) this.db.exec("ALTER TABLE studio_composition_revisions ADD COLUMN renderer_version TEXT");
    if (!names.has("output_hash")) this.db.exec("ALTER TABLE studio_composition_revisions ADD COLUMN output_hash TEXT");
  }

  private ensureDraftRevisionColumn() {
    const columns = this.db.prepare("PRAGMA table_info(studio_drafts)").all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "save_revision")) {
      this.db.exec("ALTER TABLE studio_drafts ADD COLUMN save_revision INTEGER NOT NULL DEFAULT 1");
    }
  }

  lockUsageBudget() {
    /* BEGIN IMMEDIATE already serializes this sqlite connection. */
  }

  countHeldUsage(businessId: string, kind: UsageKind) {
    const row = this.db
      .prepare("SELECT COUNT(*) as total FROM usage_events WHERE business_id=? AND kind=? AND status='held'")
      .get(businessId, kind) as { total: number } | undefined;
    return Number(row?.total ?? 0);
  }

  transitionUsageEvent(
    id: string,
    fromStatus: UsageEvent["status"],
    event: UsageEvent,
    expectedAttempt?: number
  ) {
    const result = this.db
      .prepare(
        expectedAttempt == null
          ? "UPDATE usage_events SET units=?, metadata_json=?, status=?, expires_at=?, attempt=? WHERE id=? AND status=?"
          : "UPDATE usage_events SET units=?, metadata_json=?, status=?, expires_at=?, attempt=? WHERE id=? AND status=? AND attempt=?"
      )
      .run(
        event.units,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.status ?? null,
        event.expiresAt ?? null,
        event.attempt ?? 1,
        id,
        fromStatus ?? null,
        ...(expectedAttempt == null ? [] : [expectedAttempt])
      );
    return result.changes === 1 ? event : null;
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

  getInitialBusinessId(userId: string) {
    const row = this.db.prepare("SELECT business_id FROM user_initial_business WHERE user_id = ?").get(userId) as
      | { business_id: string }
      | undefined;
    return row?.business_id ?? null;
  }

  claimInitialBusiness(userId: string, businessId: string, createdAt: string) {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO user_initial_business(user_id, business_id, created_at) VALUES(?,?,?)"
      )
      .run(userId, businessId, createdAt);
    const existing = this.getInitialBusinessId(userId);
    return { claimed: existing === businessId, businessId: existing ?? businessId };
  }

  getGuestWorkClaim(guestWorkId: string) {
    const row = this.db.prepare("SELECT * FROM guest_work_claims WHERE guest_work_id = ?").get(guestWorkId) as
      | Row
      | undefined;
    return row ? mapGuestClaim(row) : null;
  }

  insertGuestWorkClaim(claim: GuestWorkClaim) {
    try {
      this.db
        .prepare(
          "INSERT INTO guest_work_claims(guest_work_id,owner_id,kind,destination,payload_json,created_at) VALUES(?,?,?,?,?,?)"
        )
        .run(claim.guestWorkId, claim.ownerId, claim.kind, claim.destination, claim.payloadJson, claim.createdAt);
      return claim;
    } catch (error) {
      throwIfUnique(error, "This guest work has already been claimed.");
    }
  }

  getBusinessConfirmation(businessId: string) {
    const row = this.db.prepare("SELECT * FROM business_confirmations WHERE business_id = ?").get(businessId) as
      | Row
      | undefined;
    return row ? mapConfirmation(row) : null;
  }

  upsertBusinessConfirmation(confirmation: BusinessConfirmation) {
    this.db
      .prepare(
        `INSERT INTO business_confirmations(
          business_id,owner_id,business_name,business_context,source_selection_id,source_revision,direction_id,confirmed_at,confirmed_by
        ) VALUES(?,?,?,?,?,?,?,?,?)
        ON CONFLICT(business_id) DO UPDATE SET
          owner_id=excluded.owner_id,
          business_name=excluded.business_name,
          business_context=excluded.business_context,
          source_selection_id=excluded.source_selection_id,
          source_revision=excluded.source_revision,
          direction_id=excluded.direction_id,
          confirmed_at=excluded.confirmed_at,
          confirmed_by=excluded.confirmed_by`
      )
      .run(
        confirmation.businessId,
        confirmation.ownerId,
        confirmation.businessName,
        confirmation.businessContext,
        confirmation.sourceSelectionId,
        confirmation.sourceRevision,
        confirmation.directionId,
        confirmation.confirmedAt,
        confirmation.confirmedBy
      );
    return confirmation;
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
        `INSERT INTO studio_drafts(id,business_id,work_item_id,layout,layers_json,selected_asset_id,source_work_item_id,created_at,updated_at,save_revision)
         VALUES(?,?,?,?,?,?,?,?,?,?)`
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
        draft.updatedAt,
        draft.saveRevision ?? 1
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
      .prepare(
        "UPDATE studio_drafts SET layout=?, layers_json=?, selected_asset_id=?, updated_at=?, save_revision=? WHERE id=?"
      )
      .run(
        draft.layout,
        JSON.stringify(draft.layers),
        draft.selectedAssetId ?? null,
        draft.updatedAt,
        draft.saveRevision ?? 1,
        draft.id
      );
    return draft;
  }

  compareAndSwapStudioDraft(draft: StudioDraft, expectedSaveRevision: number) {
    const result = this.db
      .prepare(
        "UPDATE studio_drafts SET layout=?, layers_json=?, selected_asset_id=?, updated_at=?, save_revision=? WHERE id=? AND save_revision=?"
      )
      .run(
        draft.layout,
        JSON.stringify(draft.layers),
        draft.selectedAssetId ?? null,
        draft.updatedAt,
        draft.saveRevision,
        draft.id,
        expectedSaveRevision
      );
    return result.changes === 1 ? draft : null;
  }

  addStudioAsset(asset: StudioAsset) {
    this.db
      .prepare(
        `INSERT INTO studio_assets(id,business_id,work_item_id,draft_id,status,prompt,model,blob_id,revision,parent_id,error,created_at,updated_at,composition_revision_id,output_hash)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
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
        asset.updatedAt,
        asset.compositionRevisionId ?? null,
        asset.outputHash ?? null
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
      .prepare(
        "UPDATE studio_assets SET status=?, blob_id=?, error=?, updated_at=?, revision=?, model=?, composition_revision_id=?, output_hash=? WHERE id=?"
      )
      .run(
        asset.status,
        asset.blobId ?? null,
        asset.error ?? null,
        asset.updatedAt,
        asset.revision,
        asset.model ?? null,
        asset.compositionRevisionId ?? null,
        asset.outputHash ?? null,
        asset.id
      );
    return asset;
  }

  addUsageEvent(event: UsageEvent) {
    this.db
      .prepare(
        "INSERT INTO usage_events(id,business_id,user_id,kind,units,created_at,metadata_json,operation_id,status,expires_at,attempt) VALUES(?,?,?,?,?,?,?,?,?,?,?)"
      )
      .run(
        event.id,
        event.businessId,
        event.userId,
        event.kind,
        event.units,
        event.createdAt,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.operationId ?? null,
        event.status ?? null,
        event.expiresAt ?? null,
        event.attempt ?? 1
      );
    return event;
  }

  updateUsageEvent(event: UsageEvent) {
    this.db
      .prepare("UPDATE usage_events SET units=?, metadata_json=?, status=?, expires_at=?, attempt=? WHERE id=?")
      .run(
        event.units,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.status ?? null,
        event.expiresAt ?? null,
        event.attempt ?? 1,
        event.id
      );
    return event;
  }

  getUsageEvent(id: string) {
    const row = this.db.prepare("SELECT * FROM usage_events WHERE id = ?").get(id) as Row | undefined;
    return row ? mapUsage(row) : null;
  }

  getUsageByOperation(businessId: string, operationId: string) {
    const row = this.db
      .prepare("SELECT * FROM usage_events WHERE business_id = ? AND operation_id = ?")
      .get(businessId, operationId) as Row | undefined;
    return row ? mapUsage(row) : null;
  }

  releaseExpiredHolds(asOfIso: string) {
    const result = this.db
      .prepare(
        "UPDATE usage_events SET status='released', expires_at=NULL, metadata_json=? WHERE status='held' AND expires_at IS NOT NULL AND expires_at <= ?"
      )
      .run(JSON.stringify({ status: "released", releasedAt: asOfIso, reason: "expired_hold" }), asOfIso);
    return Number(result.changes ?? 0);
  }

  addCompositionRevision(revision: CompositionRevision) {
    this.db
      .prepare(
        `INSERT INTO studio_composition_revisions(
           id,business_id,draft_id,work_item_id,version,layout,width,height,layers_json,palette_json,composition_json,created_at,created_by,renderer_version,output_hash
         ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        revision.id,
        revision.businessId,
        revision.draftId,
        revision.workItemId ?? null,
        revision.version,
        revision.layout,
        revision.width,
        revision.height,
        JSON.stringify(revision.layers),
        JSON.stringify(revision.palette),
        JSON.stringify(revision.composition),
        revision.createdAt,
        revision.createdBy,
        revision.rendererVersion ?? null,
        revision.outputHash ?? null
      );
    return revision;
  }

  getCompositionRevision(id: string) {
    const row = this.db.prepare("SELECT * FROM studio_composition_revisions WHERE id = ?").get(id) as Row | undefined;
    return row ? mapCompositionRevision(row) : null;
  }

  listCompositionRevisions(draftId: string) {
    return (
      this.db
        .prepare("SELECT * FROM studio_composition_revisions WHERE draft_id = ? ORDER BY version ASC")
        .all(draftId) as Row[]
    ).map(mapCompositionRevision);
  }

  nextCompositionVersion(draftId: string) {
    const row = this.db
      .prepare("SELECT MAX(version) as total FROM studio_composition_revisions WHERE draft_id = ?")
      .get(draftId) as { total: number | null } | undefined;
    return Number(row?.total ?? 0) + 1;
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
        `INSERT INTO generation_jobs(id,business_id,owner_id,session_id,kind,status,idempotency_key,created_at,updated_at,result_json,error,attempt)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
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
        job.error ?? null,
        job.attempt ?? 1
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
      .prepare("UPDATE generation_jobs SET status=?, session_id=?, updated_at=?, result_json=?, error=?, attempt=? WHERE id=?")
      .run(
        job.status,
        job.sessionId,
        job.updatedAt,
        job.resultJson ?? null,
        job.error ?? null,
        job.attempt ?? 1,
        job.id
      );
    return job;
  }

  compareAndSwapJob(job: GenerationJob, expectedAttempt: number, expectedStatus: GenerationJob["status"] = "pending") {
    const result = this.db
      .prepare(
        "UPDATE generation_jobs SET status=?, session_id=?, updated_at=?, result_json=?, error=?, attempt=? WHERE id=? AND attempt=? AND status=?"
      )
      .run(
        job.status,
        job.sessionId,
        job.updatedAt,
        job.resultJson ?? null,
        job.error ?? null,
        job.attempt ?? expectedAttempt,
        job.id,
        expectedAttempt,
        expectedStatus
      );
    return result.changes === 1 ? job : null;
  }

  lockStudioGeneration(jobId: string, usageId: string, draftId: string) {
    return {
      job: this.getJob(jobId),
      usage: this.getUsageEvent(usageId),
      draft: this.getStudioDraft(draftId)
    };
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
