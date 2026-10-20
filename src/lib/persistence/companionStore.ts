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
  StudioDirectionAdoption,
  StudioDraft,
  UsageEvent,
  UsageKind,
  WorkItem
} from "@/lib/cofounder/types";

export type CompanionStore = {
  reset(): void | Promise<void>;

  createBusiness(business: Business): Business | Promise<Business>;
  getBusiness(id: string): Business | null | Promise<Business | null>;
  listBusinessesForUser(userId: string): Business[] | Promise<Business[]>;
  listAllBusinesses(): Business[] | Promise<Business[]>;
  updateBusiness(business: Business): Business | Promise<Business>;
  getInitialBusinessId(userId: string): string | null | Promise<string | null>;
  claimInitialBusiness(
    userId: string,
    businessId: string,
    createdAt: string
  ): { claimed: boolean; businessId: string } | Promise<{ claimed: boolean; businessId: string }>;
  getGuestWorkClaim(guestWorkId: string): GuestWorkClaim | null | Promise<GuestWorkClaim | null>;
  insertGuestWorkClaim(claim: GuestWorkClaim): GuestWorkClaim | Promise<GuestWorkClaim>;
  getBusinessConfirmation(businessId: string): BusinessConfirmation | null | Promise<BusinessConfirmation | null>;
  upsertBusinessConfirmation(confirmation: BusinessConfirmation): BusinessConfirmation | Promise<BusinessConfirmation>;
  getStudioDirectionAdoption(
    businessId: string,
    sourceSelectionId: string,
    sourceRevision: number,
    directionId: string
  ): StudioDirectionAdoption | null | Promise<StudioDirectionAdoption | null>;
  insertStudioDirectionAdoption(
    adoption: StudioDirectionAdoption
  ):
    | { inserted: boolean; adoption: StudioDirectionAdoption }
    | Promise<{ inserted: boolean; adoption: StudioDirectionAdoption }>;

  addMember(member: BusinessMember): BusinessMember | Promise<BusinessMember>;
  getMember(businessId: string, userId: string): BusinessMember | null | Promise<BusinessMember | null>;
  listMembers(businessId: string): BusinessMember[] | Promise<BusinessMember[]>;

  upsertProfile(profile: BusinessProfile): BusinessProfile | Promise<BusinessProfile>;
  getProfile(businessId: string): BusinessProfile | Promise<BusinessProfile>;

  addMemoryProposal(proposal: MemoryProposal): MemoryProposal | Promise<MemoryProposal>;
  getMemoryProposal(id: string): MemoryProposal | null | Promise<MemoryProposal | null>;
  listMemoryProposals(businessId: string): MemoryProposal[] | Promise<MemoryProposal[]>;
  updateMemoryProposal(proposal: MemoryProposal): MemoryProposal | Promise<MemoryProposal>;

  addDocument(document: BusinessDocument): BusinessDocument | Promise<BusinessDocument>;
  getDocument(id: string): BusinessDocument | null | Promise<BusinessDocument | null>;
  listDocuments(businessId: string): BusinessDocument[] | Promise<BusinessDocument[]>;
  updateDocument(document: BusinessDocument): BusinessDocument | Promise<BusinessDocument>;

  createConversation(conversation: CompanionConversation): CompanionConversation | Promise<CompanionConversation>;
  getConversation(id: string): CompanionConversation | null | Promise<CompanionConversation | null>;
  listConversations(businessId: string): CompanionConversation[] | Promise<CompanionConversation[]>;
  updateConversation(conversation: CompanionConversation): CompanionConversation | Promise<CompanionConversation>;

  addMessage(message: CompanionMessage): CompanionMessage | Promise<CompanionMessage>;
  listMessages(conversationId: string): CompanionMessage[] | Promise<CompanionMessage[]>;

  addWorkItem(item: WorkItem): WorkItem | Promise<WorkItem>;
  getWorkItem(id: string): WorkItem | null | Promise<WorkItem | null>;
  listWorkItems(businessId: string): WorkItem[] | Promise<WorkItem[]>;
  updateWorkItem(item: WorkItem): WorkItem | Promise<WorkItem>;

  addStudioDraft(draft: StudioDraft): StudioDraft | Promise<StudioDraft>;
  getStudioDraft(id: string): StudioDraft | null | Promise<StudioDraft | null>;
  listStudioDrafts(businessId: string): StudioDraft[] | Promise<StudioDraft[]>;
  updateStudioDraft(draft: StudioDraft): StudioDraft | Promise<StudioDraft>;
  compareAndSwapStudioDraft(draft: StudioDraft, expectedSaveRevision: number): StudioDraft | null | Promise<StudioDraft | null>;
  lockUsageBudget(businessId: string, kind: UsageKind, periodKey: string): void | Promise<void>;
  countHeldUsage(businessId: string, kind: UsageKind): number | Promise<number>;
  transitionUsageEvent(
    id: string,
    fromStatus: UsageEvent["status"],
    event: UsageEvent,
    expectedAttempt?: number
  ): UsageEvent | null | Promise<UsageEvent | null>;
  compareAndSwapJob(
    job: GenerationJob,
    expectedAttempt: number,
    expectedStatus?: GenerationJob["status"]
  ): GenerationJob | null | Promise<GenerationJob | null>;
  lockStudioGeneration(
    jobId: string,
    usageId: string,
    draftId: string
  ):
    | { job: GenerationJob | null; usage: UsageEvent | null; draft: StudioDraft | null }
    | Promise<{ job: GenerationJob | null; usage: UsageEvent | null; draft: StudioDraft | null }>;

  addStudioAsset(asset: StudioAsset): StudioAsset | Promise<StudioAsset>;
  getStudioAsset(id: string): StudioAsset | null | Promise<StudioAsset | null>;
  listStudioAssets(businessId: string): StudioAsset[] | Promise<StudioAsset[]>;
  updateStudioAsset(asset: StudioAsset): StudioAsset | Promise<StudioAsset>;

  addUsageEvent(event: UsageEvent): UsageEvent | Promise<UsageEvent>;
  updateUsageEvent(event: UsageEvent): UsageEvent | Promise<UsageEvent>;
  getUsageEvent(id: string): UsageEvent | null | Promise<UsageEvent | null>;
  getUsageByOperation(businessId: string, operationId: string): UsageEvent | null | Promise<UsageEvent | null>;
  releaseExpiredHolds(asOfIso: string): number | Promise<number>;
  sumUsage(businessId: string, kind: UsageKind, sinceIso: string): number | Promise<number>;
  countPendingJobs(businessId: string, kind: GenerationJob["kind"]): number | Promise<number>;

  addCompositionRevision(revision: CompositionRevision): CompositionRevision | Promise<CompositionRevision>;
  getCompositionRevision(id: string): CompositionRevision | null | Promise<CompositionRevision | null>;
  listCompositionRevisions(draftId: string): CompositionRevision[] | Promise<CompositionRevision[]>;
  nextCompositionVersion(draftId: string): number | Promise<number>;

  addJob(job: GenerationJob): GenerationJob | Promise<GenerationJob>;
  getJob(id: string): GenerationJob | null | Promise<GenerationJob | null>;
  getJobByIdempotency(businessId: string, key: string): GenerationJob | null | Promise<GenerationJob | null>;
  updateJob(job: GenerationJob): GenerationJob | Promise<GenerationJob>;
  invalidateJobsForSession(sessionId: string): number | Promise<number>;

  putBlob(blob: CompanionBlob): CompanionBlob | Promise<CompanionBlob>;
  getBlob(id: string): CompanionBlob | null | Promise<CompanionBlob | null>;
  deleteBlob(id: string): void | Promise<void>;
};

export const COMPANION_SQL = `
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_initial_business (
  user_id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS guest_work_claims (
  guest_work_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  destination TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS business_confirmations (
  business_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_context TEXT NOT NULL,
  source_selection_id TEXT,
  source_revision INTEGER,
  direction_id TEXT,
  studio_draft_id TEXT,
  confirmed_at TEXT NOT NULL,
  confirmed_by TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS studio_direction_adoptions (
  business_id TEXT NOT NULL,
  source_selection_id TEXT NOT NULL,
  source_revision INTEGER NOT NULL,
  direction_id TEXT NOT NULL,
  draft_id TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (business_id, source_selection_id, source_revision, direction_id)
);
CREATE TABLE IF NOT EXISTS business_members (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (business_id, user_id)
);
CREATE TABLE IF NOT EXISTS business_profiles (
  business_id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS business_memory_proposals (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE TABLE IF NOT EXISTS business_documents (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  title TEXT NOT NULL,
  mime TEXT NOT NULL,
  status TEXT NOT NULL,
  blob_id TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  provider_file_id TEXT,
  index_status TEXT
);
CREATE TABLE IF NOT EXISTS business_conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS business_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  project_id TEXT,
  author_kind TEXT NOT NULL,
  body TEXT NOT NULL,
  live_ai INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  project_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS studio_drafts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  layout TEXT NOT NULL,
  layers_json TEXT NOT NULL,
  selected_asset_id TEXT,
  source_work_item_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  save_revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS studio_assets (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  work_item_id TEXT,
  draft_id TEXT,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT,
  blob_id TEXT,
  revision INTEGER NOT NULL,
  parent_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  units INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  operation_id TEXT,
  status TEXT,
  expires_at TEXT,
  attempt INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_operation_idx
  ON usage_events (business_id, operation_id)
  WHERE operation_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS studio_composition_revisions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  work_item_id TEXT,
  version INTEGER NOT NULL,
  layout TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  layers_json TEXT NOT NULL,
  palette_json TEXT NOT NULL,
  composition_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE (draft_id, version)
);
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  UNIQUE (business_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS companion_blobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const COMPANION_RESET_SQL = `
  DELETE FROM companion_blobs;
  DELETE FROM generation_jobs;
  DELETE FROM usage_events;
  DELETE FROM studio_composition_revisions;
  DELETE FROM studio_assets;
  DELETE FROM studio_direction_adoptions;
  DELETE FROM studio_drafts;
  DELETE FROM work_items;
  DELETE FROM business_messages;
  DELETE FROM business_conversations;
  DELETE FROM business_documents;
  DELETE FROM business_memory_proposals;
  DELETE FROM business_profiles;
  DELETE FROM business_confirmations;
  DELETE FROM guest_work_claims;
  DELETE FROM user_initial_business;
  DELETE FROM business_members;
  DELETE FROM businesses;
`;
