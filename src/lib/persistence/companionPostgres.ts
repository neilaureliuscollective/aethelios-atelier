import type { Sql, TransactionSql } from "postgres";
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
  CompositionRevision,
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
  mapCompositionRevision,
  mapStudioAsset,
  mapStudioDraft,
  mapUsage,
  mapWorkItem
} from "@/lib/persistence/companionMaps";
import { COMPANION_RESET_SQL, COMPANION_SQL, type CompanionStore } from "@/lib/persistence/companionStore";
import type { Row } from "@/lib/persistence/map";

type SqlFn = () => Sql | TransactionSql;

export class PostgresCompanionStore implements CompanionStore {
  constructor(private readonly client: SqlFn) {}

  async initialize() {
    for (const statement of COMPANION_SQL.split(";").map((item) => item.trim()).filter(Boolean)) {
      await this.client().unsafe(statement);
    }
    await this.client().unsafe("ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_id TEXT");
    await this.client().unsafe("ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS operation_id TEXT");
    await this.client().unsafe("ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS status TEXT");
    await this.client().unsafe("ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS expires_at TEXT");
    await this.client().unsafe("ALTER TABLE studio_assets ADD COLUMN IF NOT EXISTS composition_revision_id TEXT");
    await this.client().unsafe("ALTER TABLE studio_assets ADD COLUMN IF NOT EXISTS output_hash TEXT");
    await this.client().unsafe("ALTER TABLE studio_composition_revisions ADD COLUMN IF NOT EXISTS renderer_version TEXT");
    await this.client().unsafe("ALTER TABLE studio_composition_revisions ADD COLUMN IF NOT EXISTS output_hash TEXT");
    await this.client().unsafe("ALTER TABLE studio_drafts ADD COLUMN IF NOT EXISTS save_revision INTEGER NOT NULL DEFAULT 1");
    await this.client().unsafe("ALTER TABLE usage_events ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1");
    await this.client().unsafe("ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS attempt INTEGER NOT NULL DEFAULT 1");
  }

  async lockUsageBudget(businessId: string, kind: UsageKind, periodKey: string) {
    await this.client()`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:${kind}:${periodKey}`}))`;
  }

  async countHeldUsage(businessId: string, kind: UsageKind) {
    const rows =
      await this.client()`SELECT COUNT(*)::int as total FROM usage_events WHERE business_id = ${businessId} AND kind = ${kind} AND status = ${"held"}`;
    return Number(rows[0]?.total ?? 0);
  }

  async transitionUsageEvent(
    id: string,
    fromStatus: UsageEvent["status"],
    event: UsageEvent,
    expectedAttempt?: number
  ) {
    const rows =
      expectedAttempt == null
        ? await this.client()`
            UPDATE usage_events
            SET units = ${event.units}, metadata_json = ${event.metadata ? JSON.stringify(event.metadata) : null},
                status = ${event.status ?? null}, expires_at = ${event.expiresAt ?? null},
                attempt = ${event.attempt ?? 1}
            WHERE id = ${id} AND status = ${fromStatus ?? null}
            RETURNING *
          `
        : await this.client()`
            UPDATE usage_events
            SET units = ${event.units}, metadata_json = ${event.metadata ? JSON.stringify(event.metadata) : null},
                status = ${event.status ?? null}, expires_at = ${event.expiresAt ?? null},
                attempt = ${event.attempt ?? expectedAttempt}
            WHERE id = ${id} AND status = ${fromStatus ?? null} AND attempt = ${expectedAttempt}
            RETURNING *
          `;
    return rows[0] ? mapUsage(rows[0] as Row) : null;
  }

  async reset() {
    await this.client().unsafe(COMPANION_RESET_SQL);
  }

  async createBusiness(business: Business) {
    await this.client()`
      INSERT INTO businesses(id,owner_id,name,plan_id,created_at,updated_at)
      VALUES (${business.id}, ${business.ownerId}, ${business.name}, ${business.planId}, ${business.createdAt}, ${business.updatedAt})
    `;
    return business;
  }

  async getBusiness(id: string) {
    const rows = await this.client()`SELECT * FROM businesses WHERE id = ${id}`;
    return rows[0] ? mapBusiness(rows[0] as Row) : null;
  }

  async listBusinessesForUser(userId: string) {
    const rows = await this.client()`
      SELECT DISTINCT b.* FROM businesses b
      LEFT JOIN business_members m ON m.business_id = b.id
      WHERE b.owner_id = ${userId} OR m.user_id = ${userId}
      ORDER BY b.updated_at DESC
    `;
    return rows.map((row) => mapBusiness(row as Row));
  }

  async listAllBusinesses() {
    const rows = await this.client()`SELECT * FROM businesses ORDER BY updated_at DESC`;
    return rows.map((row) => mapBusiness(row as Row));
  }

  async updateBusiness(business: Business) {
    await this.client()`
      UPDATE businesses SET name = ${business.name}, plan_id = ${business.planId}, updated_at = ${business.updatedAt}
      WHERE id = ${business.id}
    `;
    return business;
  }

  async addMember(member: BusinessMember) {
    await this.client()`
      INSERT INTO business_members(business_id,user_id,role,created_at)
      VALUES (${member.businessId}, ${member.userId}, ${member.role}, ${member.createdAt})
      ON CONFLICT (business_id, user_id) DO UPDATE SET role = excluded.role
    `;
    return member;
  }

  async getMember(businessId: string, userId: string) {
    const rows =
      await this.client()`SELECT * FROM business_members WHERE business_id = ${businessId} AND user_id = ${userId}`;
    return rows[0] ? mapMember(rows[0] as Row) : null;
  }

  async listMembers(businessId: string) {
    const rows = await this.client()`SELECT * FROM business_members WHERE business_id = ${businessId}`;
    return rows.map((row) => mapMember(row as Row));
  }

  async upsertProfile(profile: BusinessProfile) {
    await this.client()`
      INSERT INTO business_profiles(business_id,profile_json,updated_at,updated_by)
      VALUES (${profile.businessId}, ${JSON.stringify(profile)}, ${profile.updatedAt}, ${profile.updatedBy ?? null})
      ON CONFLICT (business_id) DO UPDATE SET
        profile_json = excluded.profile_json,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `;
    return profile;
  }

  async getProfile(businessId: string) {
    const rows = await this.client()`SELECT * FROM business_profiles WHERE business_id = ${businessId}`;
    return rows[0] ? mapProfile(rows[0] as Row) : emptyProfile(businessId, new Date().toISOString());
  }

  async addMemoryProposal(proposal: MemoryProposal) {
    await this.client()`
      INSERT INTO business_memory_proposals(id,business_id,field_key,proposed_value,rationale,status,created_at,resolved_at,resolved_by)
      VALUES (
        ${proposal.id}, ${proposal.businessId}, ${proposal.fieldKey}, ${proposal.proposedValue},
        ${proposal.rationale ?? null}, ${proposal.status}, ${proposal.createdAt},
        ${proposal.resolvedAt ?? null}, ${proposal.resolvedBy ?? null}
      )
    `;
    return proposal;
  }

  async getMemoryProposal(id: string) {
    const rows = await this.client()`SELECT * FROM business_memory_proposals WHERE id = ${id}`;
    return rows[0] ? mapMemory(rows[0] as Row) : null;
  }

  async listMemoryProposals(businessId: string) {
    const rows =
      await this.client()`SELECT * FROM business_memory_proposals WHERE business_id = ${businessId} ORDER BY created_at DESC`;
    return rows.map((row) => mapMemory(row as Row));
  }

  async updateMemoryProposal(proposal: MemoryProposal) {
    await this.client()`
      UPDATE business_memory_proposals
      SET proposed_value = ${proposal.proposedValue}, rationale = ${proposal.rationale ?? null},
          status = ${proposal.status}, resolved_at = ${proposal.resolvedAt ?? null},
          resolved_by = ${proposal.resolvedBy ?? null}
      WHERE id = ${proposal.id}
    `;
    return proposal;
  }

  async addDocument(document: BusinessDocument) {
    await this.client()`
      INSERT INTO business_documents(id,business_id,title,mime,status,blob_id,source,created_at,deleted_at,provider_file_id,index_status)
      VALUES (
        ${document.id}, ${document.businessId}, ${document.title}, ${document.mime}, ${document.status},
        ${document.blobId ?? null}, ${document.source}, ${document.createdAt}, ${document.deletedAt ?? null},
        ${document.providerFileId ?? null}, ${document.indexStatus ?? "none"}
      )
    `;
    return document;
  }

  async getDocument(id: string) {
    const rows = await this.client()`SELECT * FROM business_documents WHERE id = ${id}`;
    return rows[0] ? mapDocument(rows[0] as Row) : null;
  }

  async listDocuments(businessId: string) {
    const rows = await this.client()`SELECT * FROM business_documents WHERE business_id = ${businessId}`;
    return rows.map((row) => mapDocument(row as Row));
  }

  async updateDocument(document: BusinessDocument) {
    await this.client()`
      UPDATE business_documents
      SET title = ${document.title}, status = ${document.status}, blob_id = ${document.blobId ?? null},
          deleted_at = ${document.deletedAt ?? null}, provider_file_id = ${document.providerFileId ?? null},
          index_status = ${document.indexStatus ?? "none"}
      WHERE id = ${document.id}
    `;
    return document;
  }

  async createConversation(conversation: CompanionConversation) {
    await this.client()`
      INSERT INTO business_conversations(id,business_id,project_id,title,created_at,updated_at)
      VALUES (
        ${conversation.id}, ${conversation.businessId}, ${conversation.projectId ?? null},
        ${conversation.title}, ${conversation.createdAt}, ${conversation.updatedAt}
      )
    `;
    return conversation;
  }

  async getConversation(id: string) {
    const rows = await this.client()`SELECT * FROM business_conversations WHERE id = ${id}`;
    return rows[0] ? mapConversation(rows[0] as Row) : null;
  }

  async listConversations(businessId: string) {
    const rows =
      await this.client()`SELECT * FROM business_conversations WHERE business_id = ${businessId} ORDER BY updated_at DESC`;
    return rows.map((row) => mapConversation(row as Row));
  }

  async updateConversation(conversation: CompanionConversation) {
    await this.client()`
      UPDATE business_conversations
      SET title = ${conversation.title}, project_id = ${conversation.projectId ?? null}, updated_at = ${conversation.updatedAt}
      WHERE id = ${conversation.id}
    `;
    return conversation;
  }

  async addMessage(message: CompanionMessage) {
    await this.client()`
      INSERT INTO business_messages(id,conversation_id,business_id,project_id,author_kind,body,live_ai,created_at,metadata_json)
      VALUES (
        ${message.id}, ${message.conversationId}, ${message.businessId}, ${message.projectId ?? null},
        ${message.authorKind}, ${message.body}, ${message.liveAi ? 1 : 0}, ${message.createdAt},
        ${message.metadata ? JSON.stringify(message.metadata) : null}
      )
    `;
    return message;
  }

  async listMessages(conversationId: string) {
    const rows =
      await this.client()`SELECT * FROM business_messages WHERE conversation_id = ${conversationId} ORDER BY created_at ASC`;
    return rows.map((row) => mapCompanionMessage(row as Row));
  }

  async addWorkItem(item: WorkItem) {
    await this.client()`
      INSERT INTO work_items(id,business_id,project_id,kind,title,status,payload_json,created_by,created_at,updated_at,archived_at)
      VALUES (
        ${item.id}, ${item.businessId}, ${item.projectId ?? null}, ${item.kind}, ${item.title}, ${item.status},
        ${JSON.stringify(item.payload)}, ${item.createdBy}, ${item.createdAt}, ${item.updatedAt}, ${item.archivedAt ?? null}
      )
    `;
    return item;
  }

  async getWorkItem(id: string) {
    const rows = await this.client()`SELECT * FROM work_items WHERE id = ${id}`;
    return rows[0] ? mapWorkItem(rows[0] as Row) : null;
  }

  async listWorkItems(businessId: string) {
    const rows = await this.client()`SELECT * FROM work_items WHERE business_id = ${businessId} ORDER BY updated_at DESC`;
    return rows.map((row) => mapWorkItem(row as Row));
  }

  async updateWorkItem(item: WorkItem) {
    await this.client()`
      UPDATE work_items
      SET title = ${item.title}, status = ${item.status}, payload_json = ${JSON.stringify(item.payload)},
          project_id = ${item.projectId ?? null}, updated_at = ${item.updatedAt}, archived_at = ${item.archivedAt ?? null}
      WHERE id = ${item.id}
    `;
    return item;
  }

  async addStudioDraft(draft: StudioDraft) {
    await this.client()`
      INSERT INTO studio_drafts(id,business_id,work_item_id,layout,layers_json,selected_asset_id,source_work_item_id,created_at,updated_at,save_revision)
      VALUES (
        ${draft.id}, ${draft.businessId}, ${draft.workItemId}, ${draft.layout}, ${JSON.stringify(draft.layers)},
        ${draft.selectedAssetId ?? null}, ${draft.sourceWorkItemId ?? null}, ${draft.createdAt}, ${draft.updatedAt},
        ${draft.saveRevision ?? 1}
      )
    `;
    return draft;
  }

  async getStudioDraft(id: string) {
    const rows = await this.client()`SELECT * FROM studio_drafts WHERE id = ${id}`;
    return rows[0] ? mapStudioDraft(rows[0] as Row) : null;
  }

  async listStudioDrafts(businessId: string) {
    const rows = await this.client()`SELECT * FROM studio_drafts WHERE business_id = ${businessId}`;
    return rows.map((row) => mapStudioDraft(row as Row));
  }

  async updateStudioDraft(draft: StudioDraft) {
    await this.client()`
      UPDATE studio_drafts
      SET layout = ${draft.layout}, layers_json = ${JSON.stringify(draft.layers)},
          selected_asset_id = ${draft.selectedAssetId ?? null}, updated_at = ${draft.updatedAt},
          save_revision = ${draft.saveRevision ?? 1}
      WHERE id = ${draft.id}
    `;
    return draft;
  }

  async compareAndSwapStudioDraft(draft: StudioDraft, expectedSaveRevision: number) {
    const rows = await this.client()`
      UPDATE studio_drafts
      SET layout = ${draft.layout}, layers_json = ${JSON.stringify(draft.layers)},
          selected_asset_id = ${draft.selectedAssetId ?? null}, updated_at = ${draft.updatedAt},
          save_revision = ${draft.saveRevision}
      WHERE id = ${draft.id} AND save_revision = ${expectedSaveRevision}
      RETURNING *
    `;
    return rows[0] ? mapStudioDraft(rows[0] as Row) : null;
  }

  async addStudioAsset(asset: StudioAsset) {
    await this.client()`
      INSERT INTO studio_assets(id,business_id,work_item_id,draft_id,status,prompt,model,blob_id,revision,parent_id,error,created_at,updated_at,composition_revision_id,output_hash)
      VALUES (
        ${asset.id}, ${asset.businessId}, ${asset.workItemId ?? null}, ${asset.draftId ?? null}, ${asset.status},
        ${asset.prompt}, ${asset.model ?? null}, ${asset.blobId ?? null}, ${asset.revision}, ${asset.parentId ?? null},
        ${asset.error ?? null}, ${asset.createdAt}, ${asset.updatedAt}, ${asset.compositionRevisionId ?? null},
        ${asset.outputHash ?? null}
      )
    `;
    return asset;
  }

  async getStudioAsset(id: string) {
    const rows = await this.client()`SELECT * FROM studio_assets WHERE id = ${id}`;
    return rows[0] ? mapStudioAsset(rows[0] as Row) : null;
  }

  async listStudioAssets(businessId: string) {
    const rows = await this.client()`SELECT * FROM studio_assets WHERE business_id = ${businessId}`;
    return rows.map((row) => mapStudioAsset(row as Row));
  }

  async updateStudioAsset(asset: StudioAsset) {
    await this.client()`
      UPDATE studio_assets
      SET status = ${asset.status}, blob_id = ${asset.blobId ?? null}, error = ${asset.error ?? null},
          updated_at = ${asset.updatedAt}, revision = ${asset.revision}, model = ${asset.model ?? null},
          composition_revision_id = ${asset.compositionRevisionId ?? null}, output_hash = ${asset.outputHash ?? null}
      WHERE id = ${asset.id}
    `;
    return asset;
  }

  async addUsageEvent(event: UsageEvent) {
    await this.client()`
      INSERT INTO usage_events(id,business_id,user_id,kind,units,created_at,metadata_json,operation_id,status,expires_at,attempt)
      VALUES (
        ${event.id}, ${event.businessId}, ${event.userId}, ${event.kind}, ${event.units}, ${event.createdAt},
        ${event.metadata ? JSON.stringify(event.metadata) : null}, ${event.operationId ?? null},
        ${event.status ?? null}, ${event.expiresAt ?? null}, ${event.attempt ?? 1}
      )
    `;
    return event;
  }

  async updateUsageEvent(event: UsageEvent) {
    await this.client()`
      UPDATE usage_events
      SET units = ${event.units}, metadata_json = ${event.metadata ? JSON.stringify(event.metadata) : null},
          status = ${event.status ?? null}, expires_at = ${event.expiresAt ?? null},
          attempt = ${event.attempt ?? 1}
      WHERE id = ${event.id}
    `;
    return event;
  }

  async getUsageEvent(id: string) {
    const rows = await this.client()`SELECT * FROM usage_events WHERE id = ${id}`;
    return rows[0] ? mapUsage(rows[0] as Row) : null;
  }

  async getUsageByOperation(businessId: string, operationId: string) {
    const rows =
      await this.client()`SELECT * FROM usage_events WHERE business_id = ${businessId} AND operation_id = ${operationId}`;
    return rows[0] ? mapUsage(rows[0] as Row) : null;
  }

  async releaseExpiredHolds(asOfIso: string) {
    const rows = await this.client()`
      UPDATE usage_events
      SET status = ${"released"}, expires_at = NULL,
          metadata_json = ${JSON.stringify({ status: "released", releasedAt: asOfIso, reason: "expired_hold" })}
      WHERE status = ${"held"} AND expires_at IS NOT NULL AND expires_at <= ${asOfIso}
      RETURNING id
    `;
    return rows.length;
  }

  async addCompositionRevision(revision: CompositionRevision) {
    await this.client()`
      INSERT INTO studio_composition_revisions(
        id,business_id,draft_id,work_item_id,version,layout,width,height,layers_json,palette_json,composition_json,created_at,created_by,renderer_version,output_hash
      ) VALUES (
        ${revision.id}, ${revision.businessId}, ${revision.draftId}, ${revision.workItemId ?? null}, ${revision.version},
        ${revision.layout}, ${revision.width}, ${revision.height}, ${JSON.stringify(revision.layers)},
        ${JSON.stringify(revision.palette)}, ${JSON.stringify(revision.composition)}, ${revision.createdAt}, ${revision.createdBy},
        ${revision.rendererVersion ?? null}, ${revision.outputHash ?? null}
      )
    `;
    return revision;
  }

  async getCompositionRevision(id: string) {
    const rows = await this.client()`SELECT * FROM studio_composition_revisions WHERE id = ${id}`;
    return rows[0] ? mapCompositionRevision(rows[0] as Row) : null;
  }

  async listCompositionRevisions(draftId: string) {
    const rows =
      await this.client()`SELECT * FROM studio_composition_revisions WHERE draft_id = ${draftId} ORDER BY version ASC`;
    return rows.map((row) => mapCompositionRevision(row as Row));
  }

  async nextCompositionVersion(draftId: string) {
    const rows =
      await this.client()`SELECT COALESCE(MAX(version), 0) as total FROM studio_composition_revisions WHERE draft_id = ${draftId}`;
    return Number(rows[0]?.total ?? 0) + 1;
  }

  async sumUsage(businessId: string, kind: UsageKind, sinceIso: string) {
    const rows = await this.client()`
      SELECT * FROM usage_events
      WHERE business_id = ${businessId} AND kind = ${kind} AND created_at >= ${sinceIso}
    `;
    return rows
      .map((row) => mapUsage(row as Row))
      .filter(usageCountsTowardBudget)
      .reduce((sum, event) => sum + event.units, 0);
  }

  async countPendingJobs(businessId: string, kind: GenerationJob["kind"]) {
    const rows = await this.client()`
      SELECT COUNT(*) as total FROM generation_jobs
      WHERE business_id = ${businessId} AND kind = ${kind} AND status = 'pending'
    `;
    return Number(rows[0]?.total ?? 0);
  }

  async addJob(job: GenerationJob) {
    await this.client()`
      INSERT INTO generation_jobs(id,business_id,owner_id,session_id,kind,status,idempotency_key,created_at,updated_at,result_json,error,attempt)
      VALUES (
        ${job.id}, ${job.businessId}, ${job.ownerId}, ${job.sessionId}, ${job.kind}, ${job.status},
        ${job.idempotencyKey}, ${job.createdAt}, ${job.updatedAt}, ${job.resultJson ?? null}, ${job.error ?? null},
        ${job.attempt ?? 1}
      )
    `;
    return job;
  }

  async getJob(id: string) {
    const rows = await this.client()`SELECT * FROM generation_jobs WHERE id = ${id}`;
    return rows[0] ? mapJob(rows[0] as Row) : null;
  }

  async getJobByIdempotency(businessId: string, key: string) {
    const rows =
      await this.client()`SELECT * FROM generation_jobs WHERE business_id = ${businessId} AND idempotency_key = ${key}`;
    return rows[0] ? mapJob(rows[0] as Row) : null;
  }

  async updateJob(job: GenerationJob) {
    await this.client()`
      UPDATE generation_jobs
      SET status = ${job.status}, session_id = ${job.sessionId}, updated_at = ${job.updatedAt},
          result_json = ${job.resultJson ?? null}, error = ${job.error ?? null},
          attempt = ${job.attempt ?? 1}
      WHERE id = ${job.id}
    `;
    return job;
  }

  async compareAndSwapJob(job: GenerationJob, expectedAttempt: number) {
    const rows = await this.client()`
      UPDATE generation_jobs
      SET status = ${job.status}, session_id = ${job.sessionId}, updated_at = ${job.updatedAt},
          result_json = ${job.resultJson ?? null}, error = ${job.error ?? null},
          attempt = ${job.attempt ?? expectedAttempt}
      WHERE id = ${job.id} AND attempt = ${expectedAttempt}
      RETURNING *
    `;
    return rows[0] ? mapJob(rows[0] as Row) : null;
  }

  async invalidateJobsForSession(sessionId: string) {
    const rows = await this.client()`
      UPDATE generation_jobs SET status = 'invalidated', updated_at = ${new Date().toISOString()}
      WHERE session_id = ${sessionId} AND status = 'pending'
    `;
    return rows.count ?? 0;
  }

  async putBlob(blob: CompanionBlob) {
    await this.client()`
      INSERT INTO companion_blobs(id,business_id,mime,bytes,created_at)
      VALUES (${blob.id}, ${blob.businessId}, ${blob.mime}, ${Buffer.from(blob.bytes).toString("base64")}, ${blob.createdAt})
    `;
    return blob;
  }

  async getBlob(id: string) {
    const rows = await this.client()`SELECT * FROM companion_blobs WHERE id = ${id}`;
    return rows[0] ? mapBlob(rows[0] as Row) : null;
  }

  async deleteBlob(id: string) {
    await this.client()`DELETE FROM companion_blobs WHERE id = ${id}`;
  }
}
