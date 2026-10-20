import { emptyProfile, normalizeProfile } from "@/lib/cofounder/profile";
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
  StudioDirectionAdoption,
  StudioDraft,
  UsageEvent,
  UsageKind,
  WorkItem
} from "@/lib/cofounder/types";
import type { CompanionStore } from "@/lib/persistence/companionStore";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryCompanionStore implements CompanionStore {
  private businesses = new Map<string, Business>();
  private initialBusiness = new Map<string, string>();
  private guestClaims = new Map<string, GuestWorkClaim>();
  private confirmations = new Map<string, BusinessConfirmation>();
  private members = new Map<string, BusinessMember>();
  private profiles = new Map<string, BusinessProfile>();
  private memory = new Map<string, MemoryProposal>();
  private documents = new Map<string, BusinessDocument>();
  private conversations = new Map<string, CompanionConversation>();
  private messages = new Map<string, CompanionMessage[]>();
  private work = new Map<string, WorkItem>();
  private drafts = new Map<string, StudioDraft>();
  private adoptions = new Map<string, StudioDirectionAdoption>();
  private assets = new Map<string, StudioAsset>();
  private usage: UsageEvent[] = [];
  private jobs = new Map<string, GenerationJob>();
  private blobs = new Map<string, CompanionBlob>();
  private revisions = new Map<string, CompositionRevision>();

  snapshot() {
    return {
      businesses: new Map(this.businesses),
      initialBusiness: new Map(this.initialBusiness),
      guestClaims: new Map(this.guestClaims),
      confirmations: new Map(this.confirmations),
      members: new Map(this.members),
      profiles: new Map(this.profiles),
      work: new Map(this.work),
      drafts: new Map(this.drafts),
      adoptions: new Map(this.adoptions)
    };
  }

  restore(snapshot: ReturnType<MemoryCompanionStore["snapshot"]>) {
    this.businesses = new Map(snapshot.businesses);
    this.initialBusiness = new Map(snapshot.initialBusiness);
    this.guestClaims = new Map(snapshot.guestClaims);
    this.confirmations = new Map(snapshot.confirmations);
    this.members = new Map(snapshot.members);
    this.profiles = new Map(snapshot.profiles);
    this.work = new Map(snapshot.work);
    this.drafts = new Map(snapshot.drafts);
    this.adoptions = new Map(snapshot.adoptions);
  }

  reset() {
    this.businesses.clear();
    this.initialBusiness.clear();
    this.guestClaims.clear();
    this.confirmations.clear();
    this.members.clear();
    this.profiles.clear();
    this.memory.clear();
    this.documents.clear();
    this.conversations.clear();
    this.messages.clear();
    this.work.clear();
    this.drafts.clear();
    this.adoptions.clear();
    this.assets.clear();
    this.usage = [];
    this.jobs.clear();
    this.blobs.clear();
    this.revisions.clear();
  }

  createBusiness(business: Business) {
    this.businesses.set(business.id, clone(business));
    return clone(business);
  }

  getBusiness(id: string) {
    const item = this.businesses.get(id);
    return item ? clone(item) : null;
  }

  listBusinessesForUser(userId: string) {
    const ids = [...this.members.values()].filter((member) => member.userId === userId).map((m) => m.businessId);
    return [...this.businesses.values()].filter((item) => ids.includes(item.id) || item.ownerId === userId).map(clone);
  }

  listAllBusinesses() {
    return [...this.businesses.values()].map(clone);
  }

  updateBusiness(business: Business) {
    this.businesses.set(business.id, clone(business));
    return clone(business);
  }

  getInitialBusinessId(userId: string) {
    return this.initialBusiness.get(userId) ?? null;
  }

  claimInitialBusiness(userId: string, businessId: string) {
    const existing = this.initialBusiness.get(userId);
    if (existing) {
      return { claimed: false, businessId: existing };
    }
    this.initialBusiness.set(userId, businessId);
    return { claimed: true, businessId };
  }

  private claimKey(guestWorkId: string, sourceRevision: number) {
    return `${guestWorkId}:${sourceRevision}`;
  }

  listGuestWorkClaims(guestWorkId: string) {
    return [...this.guestClaims.values()]
      .filter((item) => item.guestWorkId === guestWorkId)
      .sort((a, b) => a.sourceRevision - b.sourceRevision)
      .map((item) => clone(item));
  }

  getGuestWorkClaim(guestWorkId: string, sourceRevision?: number | null) {
    if (sourceRevision != null) {
      const item = this.guestClaims.get(this.claimKey(guestWorkId, sourceRevision));
      return item ? clone(item) : null;
    }
    const listed = this.listGuestWorkClaims(guestWorkId);
    return listed.at(-1) ?? null;
  }

  insertGuestWorkClaim(claim: GuestWorkClaim) {
    const key = this.claimKey(claim.guestWorkId, claim.sourceRevision);
    const existing = this.guestClaims.get(key);
    if (existing) return clone(existing);
    this.guestClaims.set(key, clone(claim));
    return clone(claim);
  }

  getBusinessConfirmation(businessId: string) {
    const item = this.confirmations.get(businessId);
    return item ? clone(item) : null;
  }

  upsertBusinessConfirmation(confirmation: BusinessConfirmation) {
    this.confirmations.set(confirmation.businessId, clone(confirmation));
    return clone(confirmation);
  }

  private adoptionKey(
    businessId: string,
    sourceSelectionId: string,
    sourceRevision: number,
    directionId: string
  ) {
    return `${businessId}:${sourceSelectionId}:${sourceRevision}:${directionId}`;
  }

  getStudioDirectionAdoption(
    businessId: string,
    sourceSelectionId: string,
    sourceRevision: number,
    directionId: string
  ) {
    const item = this.adoptions.get(this.adoptionKey(businessId, sourceSelectionId, sourceRevision, directionId));
    return item ? clone(item) : null;
  }

  insertStudioDirectionAdoption(adoption: StudioDirectionAdoption) {
    const key = this.adoptionKey(
      adoption.businessId,
      adoption.sourceSelectionId,
      adoption.sourceRevision,
      adoption.directionId
    );
    const existing = this.adoptions.get(key);
    if (existing) {
      return { inserted: false, adoption: clone(existing) };
    }
    this.adoptions.set(key, clone(adoption));
    return { inserted: true, adoption: clone(adoption) };
  }

  addMember(member: BusinessMember) {
    this.members.set(`${member.businessId}:${member.userId}`, clone(member));
    return clone(member);
  }

  getMember(businessId: string, userId: string) {
    const item = this.members.get(`${businessId}:${userId}`);
    return item ? clone(item) : null;
  }

  listMembers(businessId: string) {
    return [...this.members.values()].filter((item) => item.businessId === businessId).map(clone);
  }

  compareAndSwapProfile(profile: BusinessProfile, expectedUpdatedAt: string) {
    if (this.profiles.get(profile.businessId)?.updatedAt !== expectedUpdatedAt) return null;
    return this.upsertProfile(profile);
  }

  upsertProfile(profile: BusinessProfile) {
    const next = normalizeProfile(profile);
    this.profiles.set(next.businessId, clone(next));
    return clone(next);
  }

  getProfile(businessId: string) {
    const item = this.profiles.get(businessId);
    return item ? clone(item) : emptyProfile(businessId, new Date().toISOString());
  }

  addMemoryProposal(proposal: MemoryProposal) {
    this.memory.set(proposal.id, clone(proposal));
    return clone(proposal);
  }

  getMemoryProposal(id: string) {
    const item = this.memory.get(id);
    return item ? clone(item) : null;
  }

  listMemoryProposals(businessId: string) {
    return [...this.memory.values()]
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  }

  updateMemoryProposal(proposal: MemoryProposal) {
    this.memory.set(proposal.id, clone(proposal));
    return clone(proposal);
  }

  addDocument(document: BusinessDocument) {
    this.documents.set(document.id, clone(document));
    return clone(document);
  }

  getDocument(id: string) {
    const item = this.documents.get(id);
    return item ? clone(item) : null;
  }

  listDocuments(businessId: string) {
    return [...this.documents.values()].filter((item) => item.businessId === businessId).map(clone);
  }

  updateDocument(document: BusinessDocument) {
    this.documents.set(document.id, clone(document));
    return clone(document);
  }

  createConversation(conversation: CompanionConversation) {
    this.conversations.set(conversation.id, clone(conversation));
    return clone(conversation);
  }

  getConversation(id: string) {
    const item = this.conversations.get(id);
    return item ? clone(item) : null;
  }

  listConversations(businessId: string) {
    return [...this.conversations.values()]
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone);
  }

  updateConversation(conversation: CompanionConversation) {
    this.conversations.set(conversation.id, clone(conversation));
    return clone(conversation);
  }

  addMessage(message: CompanionMessage) {
    const list = this.messages.get(message.conversationId) ?? [];
    list.push(clone(message));
    this.messages.set(message.conversationId, list);
    return clone(message);
  }

  listMessages(conversationId: string) {
    return (this.messages.get(conversationId) ?? []).map(clone);
  }

  addWorkItem(item: WorkItem) {
    this.work.set(item.id, clone(item));
    return clone(item);
  }

  getWorkItem(id: string) {
    const item = this.work.get(id);
    return item ? clone(item) : null;
  }

  listWorkItems(businessId: string) {
    return [...this.work.values()]
      .filter((item) => item.businessId === businessId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(clone);
  }

  updateWorkItem(item: WorkItem) {
    this.work.set(item.id, clone(item));
    return clone(item);
  }

  addStudioDraft(draft: StudioDraft) {
    this.drafts.set(draft.id, clone(draft));
    return clone(draft);
  }

  getStudioDraft(id: string) {
    const item = this.drafts.get(id);
    return item ? clone(item) : null;
  }

  listStudioDrafts(businessId: string) {
    return [...this.drafts.values()].filter((item) => item.businessId === businessId).map(clone);
  }

  updateStudioDraft(draft: StudioDraft) {
    this.drafts.set(draft.id, clone(draft));
    return clone(draft);
  }

  compareAndSwapStudioDraft(draft: StudioDraft, expectedSaveRevision: number) {
    const current = this.drafts.get(draft.id);
    if (!current || current.saveRevision !== expectedSaveRevision) return null;
    this.drafts.set(draft.id, clone(draft));
    return clone(draft);
  }

  lockUsageBudget() {
    /* Single-process memory adapter; reserve() still uses a database transaction when available. */
  }

  countHeldUsage(businessId: string, kind: UsageKind) {
    return this.usage.filter((event) => event.businessId === businessId && event.kind === kind && event.status === "held")
      .length;
  }

  transitionUsageEvent(
    id: string,
    fromStatus: UsageEvent["status"],
    event: UsageEvent,
    expectedAttempt?: number
  ) {
    const index = this.usage.findIndex((item) => item.id === id);
    const current = index >= 0 ? this.usage[index] : undefined;
    if (!current || current.status !== fromStatus) return null;
    if (expectedAttempt != null && (current.attempt ?? 1) !== expectedAttempt) return null;
    this.usage[index] = clone(event);
    return clone(event);
  }

  addStudioAsset(asset: StudioAsset) {
    this.assets.set(asset.id, clone(asset));
    return clone(asset);
  }

  getStudioAsset(id: string) {
    const item = this.assets.get(id);
    return item ? clone(item) : null;
  }

  listStudioAssets(businessId: string) {
    return [...this.assets.values()].filter((item) => item.businessId === businessId).map(clone);
  }

  updateStudioAsset(asset: StudioAsset) {
    this.assets.set(asset.id, clone(asset));
    return clone(asset);
  }

  addUsageEvent(event: UsageEvent) {
    this.usage.push(clone(event));
    return clone(event);
  }

  updateUsageEvent(event: UsageEvent) {
    const index = this.usage.findIndex((item) => item.id === event.id);
    if (index >= 0) this.usage[index] = clone(event);
    return clone(event);
  }

  getUsageEvent(id: string) {
    const event = this.usage.find((item) => item.id === id);
    return event ? clone(event) : null;
  }

  getUsageByOperation(businessId: string, operationId: string) {
    const event = this.usage.find((item) => item.businessId === businessId && item.operationId === operationId);
    return event ? clone(event) : null;
  }

  releaseExpiredHolds(asOfIso: string) {
    let count = 0;
    this.usage = this.usage.map((event) => {
      if (event.status === "held" && event.expiresAt && event.expiresAt <= asOfIso) {
        count += 1;
        return {
          ...event,
          status: "released" as const,
          expiresAt: undefined,
          metadata: { ...event.metadata, status: "released", releasedAt: asOfIso, reason: "expired_hold" }
        };
      }
      return event;
    });
    return count;
  }

  addCompositionRevision(revision: CompositionRevision) {
    this.revisions.set(revision.id, clone(revision));
    return clone(revision);
  }

  getCompositionRevision(id: string) {
    const revision = this.revisions.get(id);
    return revision ? clone(revision) : null;
  }

  listCompositionRevisions(draftId: string) {
    return [...this.revisions.values()]
      .filter((item) => item.draftId === draftId)
      .sort((a, b) => a.version - b.version)
      .map(clone);
  }

  nextCompositionVersion(draftId: string) {
    return this.listCompositionRevisions(draftId).reduce((max, item) => Math.max(max, item.version), 0) + 1;
  }

  sumUsage(businessId: string, kind: UsageKind, sinceIso: string) {
    return this.usage
      .filter(
        (event) =>
          event.businessId === businessId &&
          event.kind === kind &&
          event.createdAt >= sinceIso &&
          usageCountsTowardBudget(event)
      )
      .reduce((sum, event) => sum + event.units, 0);
  }

  countPendingJobs(businessId: string, kind: GenerationJob["kind"]) {
    return [...this.jobs.values()].filter(
      (job) => job.businessId === businessId && job.kind === kind && job.status === "pending"
    ).length;
  }

  addJob(job: GenerationJob) {
    this.jobs.set(job.id, clone(job));
    return clone(job);
  }

  getJob(id: string) {
    const item = this.jobs.get(id);
    return item ? clone(item) : null;
  }

  getJobByIdempotency(businessId: string, key: string) {
    const item = [...this.jobs.values()].find((job) => job.businessId === businessId && job.idempotencyKey === key);
    return item ? clone(item) : null;
  }

  updateJob(job: GenerationJob) {
    this.jobs.set(job.id, clone(job));
    return clone(job);
  }

  compareAndSwapJob(job: GenerationJob, expectedAttempt: number, expectedStatus: GenerationJob["status"] = "pending") {
    const current = this.jobs.get(job.id);
    if (!current || (current.attempt ?? 1) !== expectedAttempt || current.status !== expectedStatus) return null;
    this.jobs.set(job.id, clone(job));
    return clone(job);
  }

  lockStudioGeneration(jobId: string, usageId: string, draftId: string) {
    return {
      job: this.getJob(jobId),
      usage: this.getUsageEvent(usageId),
      draft: this.getStudioDraft(draftId)
    };
  }

  invalidateJobsForSession(sessionId: string) {
    let count = 0;
    for (const job of this.jobs.values()) {
      if (job.sessionId === sessionId && job.status === "pending") {
        job.status = "invalidated";
        job.updatedAt = new Date().toISOString();
        count += 1;
      }
    }
    return count;
  }

  putBlob(blob: CompanionBlob) {
    this.blobs.set(blob.id, {
      ...blob,
      bytes: new Uint8Array(blob.bytes)
    });
    return { ...blob, bytes: new Uint8Array(blob.bytes) };
  }

  getBlob(id: string) {
    const item = this.blobs.get(id);
    return item ? { ...item, bytes: new Uint8Array(item.bytes) } : null;
  }

  deleteBlob(id: string) {
    this.blobs.delete(id);
  }
}
