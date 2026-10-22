import { emptyProfile, normalizeProfile } from "@/lib/cofounder/profile";
import { resolvePlanId } from "@/lib/cofounder/entitlements";
import {
  applyConfirmedIntake,
  candidateFromDraft,
  draftIntakeChange,
  rejectDocumentCandidatesForSource,
  refreshFieldSourceStatuses
} from "@/lib/cofounder/intake";
import {
  assertSelectableSourceDocumentIds,
  extractDocumentPages
} from "@/lib/cofounder/documents";
import { isLifestyleOwner, lifestyleProfileFields, LIFESTYLE_PROJECT } from "@/lib/cofounder/lifestyle";
import { canonicalOwnedBusiness, DEFAULT_WORKSPACE_NAME } from "@/lib/cofounder/provision";
import { ForbiddenError, NotFoundError, UniqueConstraintError } from "@/lib/domain/errors";
import { isUniqueViolation } from "@/lib/persistence/unique";
import { currentClientProposal, isClientVisibleProposal } from "@/lib/domain/proposal";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type {
  AuthorizedBusinessContext,
  Business,
  BusinessProfile,
  MemoryProposal,
  ProfileFieldKey
} from "@/lib/cofounder/types";
import type { User } from "@/lib/types";

function now() {
  return new Date().toISOString();
}

export function canMutateWorkspace(context: AuthorizedBusinessContext, user: User) {
  return (
    context.business.ownerId === user.id ||
    context.membership.role === "owner" ||
    context.membership.role === "member"
  );
}

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class CompanionWorkspace {
  constructor(private readonly store: PersistenceAdapter) {}

  async ensureForUser(user: User, requestedBusinessId?: string): Promise<AuthorizedBusinessContext> {
    if (requestedBusinessId) {
      return this.requireMembership(requestedBusinessId, user);
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.provisionInitialWorkspace(user);
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 3) throw error;
      }
    }
    throw new UniqueConstraintError("The initial workspace could not be provisioned uniquely.");
  }

  private async provisionInitialWorkspace(user: User): Promise<AuthorizedBusinessContext> {
    return this.store.runInTransaction(async () => {
      const claimedId = await this.store.companion.getInitialBusinessId(user.id);
      if (claimedId) {
        const claimed = await this.store.companion.getBusiness(claimedId);
        if (claimed) {
          await this.attachOrphanProjects(claimed, user);
          return this.requireMembership(claimed.id, user);
        }
      }

      const existing = await this.store.companion.listBusinessesForUser(user.id);
      const owned = canonicalOwnedBusiness(existing, user.id);
      if (owned) {
        const claim = await this.store.companion.claimInitialBusiness(user.id, owned.id, owned.createdAt);
        const canonical = (await this.store.companion.getBusiness(claim.businessId)) ?? owned;
        await this.attachOrphanProjects(canonical, user);
        return this.requireMembership(canonical.id, user);
      }

      const stamp = now();
      const lifestyle = isLifestyleOwner(user.email);
      const business: Business = {
        id: companionId("biz"),
        ownerId: user.id,
        name: lifestyle ? LIFESTYLE_PROJECT.brandName : DEFAULT_WORKSPACE_NAME,
        planId: resolvePlanId(process.env.ATELIER_DEFAULT_PLAN),
        createdAt: stamp,
        updatedAt: stamp
      };
      await this.store.companion.createBusiness(business);
      await this.store.companion.addMember({
        businessId: business.id,
        userId: user.id,
        role: user.role === "founder" ? "founder" : "owner",
        createdAt: stamp
      });
      const profile = emptyProfile(business.id, stamp);
      if (lifestyle) {
        profile.fields = lifestyleProfileFields(stamp);
      }
      await this.store.companion.upsertProfile(profile);
      const claim = await this.store.companion.claimInitialBusiness(user.id, business.id, stamp);
      if (claim.businessId !== business.id) {
        throw new UniqueConstraintError("Initial workspace already exists for this account.");
      }
      await this.attachOrphanProjects(business, user);
      return this.requireMembership(business.id, user);
    });
  }

  async requireMembership(businessId: string, user: User): Promise<AuthorizedBusinessContext> {
    const business = await this.store.companion.getBusiness(businessId);
    if (!business) throw new NotFoundError("Business workspace not found.");
    let membership = await this.store.companion.getMember(businessId, user.id);
    if (!membership && user.role === "founder") {
      membership = await this.store.companion.addMember({
        businessId,
        userId: user.id,
        role: "founder",
        createdAt: now()
      });
    }
    if (!membership) {
      throw new ForbiddenError("You are not a member of this business workspace.");
    }
    const projects = await this.store.listProjectsByBusiness(businessId);
    return {
      business,
      membership,
      profile: await this.store.companion.getProfile(businessId),
      documents: (await this.store.companion.listDocuments(businessId)).filter((doc) => doc.status !== "deleted"),
      projects: projects.map((project) => ({ id: project.id, title: project.title, status: project.status })),
      memoryPending: (await this.store.companion.listMemoryProposals(businessId)).filter(
        (item) => item.status === "pending"
      )
    };
  }

  async requireMutable(businessId: string, user: User): Promise<AuthorizedBusinessContext> {
    const context = await this.requireMembership(businessId, user);
    this.assertMutable(context, user);
    return context;
  }

  assertMutable(context: AuthorizedBusinessContext, user: User) {
    if (!canMutateWorkspace(context, user)) {
      throw new ForbiddenError("Founder visibility does not change another client’s workspace or accept their memory.");
    }
    return context;
  }

  async listForUser(user: User) {
    if (user.role === "founder") {
      return this.store.companion.listAllBusinesses();
    }
    return this.store.companion.listBusinessesForUser(user.id);
  }

  async updateProfile(businessId: string, user: User, patch: Partial<BusinessProfile>) {
    const context = await this.requireMutable(businessId, user);
    const documents = await this.store.companion.listDocuments(businessId);
    const live = documents.filter((doc) => doc.status !== "deleted");
    const sourceDocumentIds =
      patch.sourceDocumentIds !== undefined
        ? assertSelectableSourceDocumentIds(live, patch.sourceDocumentIds)
        : context.profile.sourceDocumentIds;
    let next = normalizeProfile({
      ...context.profile,
      ...patch,
      fields: { ...context.profile.fields, ...patch.fields },
      approvedRates: patch.approvedRates ?? context.profile.approvedRates,
      brandAssets: patch.brandAssets ?? context.profile.brandAssets,
      sourceDocumentIds,
      documentCandidates: patch.documentCandidates ?? context.profile.documentCandidates,
      businessId,
      updatedAt: now(),
      updatedBy: user.id
    });
    next = refreshFieldSourceStatuses(
      next,
      new Set(live.map((doc) => doc.id)),
      new Set(sourceDocumentIds)
    );
    return this.persistProfile(context, next);
  }

  async selectSourceDocuments(businessId: string, user: User, sourceDocumentIds: string[]) {
    return this.updateProfile(businessId, user, { sourceDocumentIds });
  }

  async proposeMemory(
    businessId: string,
    user: User,
    fieldKey: ProfileFieldKey,
    proposedValue: string,
    rationale?: string
  ) {
    await this.requireMutable(businessId, user);
    const proposal: MemoryProposal = {
      id: companionId("mem"),
      businessId,
      fieldKey,
      proposedValue,
      rationale,
      status: "pending",
      createdAt: now()
    };
    return this.store.companion.addMemoryProposal(proposal);
  }

  async resolveMemory(
    businessId: string,
    user: User,
    proposalId: string,
    action: "accept" | "edit" | "reject" | "delete",
    editedValue?: string
  ) {
    const context = await this.requireMutable(businessId, user);
    const proposal = await this.store.companion.getMemoryProposal(proposalId);
    if (!proposal || proposal.businessId !== businessId) {
      throw new NotFoundError("Memory proposal not found.");
    }
    if (action === "delete") {
      const deleted = {
        ...proposal,
        status: "deleted" as const,
        resolvedAt: now(),
        resolvedBy: user.id
      };
      return this.store.companion.updateMemoryProposal(deleted);
    }
    if (action === "reject") {
      return this.store.companion.updateMemoryProposal({
        ...proposal,
        status: "rejected",
        resolvedAt: now(),
        resolvedBy: user.id
      });
    }
    const value = action === "edit" ? (editedValue ?? proposal.proposedValue) : proposal.proposedValue;
    const profile = context.profile;
    profile.fields[proposal.fieldKey] = {
      key: proposal.fieldKey,
      value,
      kind: "confirmed",
      source: action === "edit" ? "owner_edited_suggestion" : "owner_accepted_suggestion",
      updatedAt: now()
    };
    profile.updatedAt = now();
    profile.updatedBy = user.id;
    await this.store.companion.upsertProfile(profile);
    return this.store.companion.updateMemoryProposal({
      ...proposal,
      proposedValue: value,
      status: action === "edit" ? "edited" : "accepted",
      resolvedAt: now(),
      resolvedBy: user.id
    });
  }

  async linkProject(businessId: string, user: User, projectId: string) {
    await this.requireMutable(businessId, user);
    const project = await this.store.getProject(projectId);
    if (!project) throw new NotFoundError("Project not found.");
    if (project.ownerId !== user.id && user.role !== "founder") {
      throw new ForbiddenError("This commission belongs to another account.");
    }
    if (project.businessId && project.businessId !== businessId) {
      throw new ForbiddenError("This commission is already linked to another business.");
    }
    const updated = { ...project, businessId, updatedAt: now() };
    await this.store.updateProject(updated);
    return updated;
  }

  async getDocumentBytes(businessId: string, user: User, documentId: string) {
    await this.requireMembership(businessId, user);
    const document = await this.store.companion.getDocument(documentId);
    if (!document || document.businessId !== businessId || document.status === "deleted") {
      throw new NotFoundError("Document not found.");
    }
    if (!document.blobId) throw new NotFoundError("Document bytes were not stored.");
    const blob = await this.store.companion.getBlob(document.blobId);
    if (!blob || blob.businessId !== businessId) throw new NotFoundError("Document bytes were not stored.");
    return { document, blob };
  }

  async previewDocument(businessId: string, user: User, documentId: string) {
    const context = await this.requireMembership(businessId, user);
    const { document, blob } = await this.getDocumentBytes(businessId, user, documentId);
    return {
      document,
      extracted: extractDocumentPages(document.mime, blob.bytes, document.title),
      profile: context.profile
    };
  }

  async proposeDocumentIntake(
    businessId: string,
    user: User,
    input: {
      documentId: string;
      fieldKey: string;
      pageNumber: number;
      excerpt: string;
      proposedValue?: string;
    }
  ) {
    const context = await this.requireMutable(businessId, user);
    const preview = await this.previewDocument(businessId, user, input.documentId);
    const draft = draftIntakeChange({
      document: preview.document,
      profile: context.profile,
      extracted: preview.extracted,
      fieldKey: input.fieldKey,
      pageNumber: input.pageNumber,
      excerpt: input.excerpt,
      proposedValue: input.proposedValue
    });
    const candidate = candidateFromDraft(draft, {
      id: companionId("cand"),
      createdAt: now()
    });
    const profile = await this.persistProfile(context, {
      ...context.profile,
      documentCandidates: [candidate, ...context.profile.documentCandidates.filter((item) => item.id !== candidate.id)],
      updatedAt: now(),
      updatedBy: user.id
    });
    return { draft, candidate, profile };
  }

  async resolveDocumentIntake(
    businessId: string,
    user: User,
    input: {
      documentId: string;
      candidateId?: string;
      fieldKey: string;
      pageNumber: number;
      excerpt: string;
      proposedValue?: string;
      action: "confirm" | "edit" | "reject";
      ownerEdited?: boolean;
      conflictResolution?: "replace" | "keep";
      selectSource?: boolean;
    }
  ) {
    const context = await this.requireMutable(businessId, user);
    if (input.action === "reject") {
      const candidate = this.requireCandidate(context.profile, input.candidateId, input.documentId);
      const next = {
        ...candidate,
        status: "rejected" as const,
        resolvedAt: now(),
        resolvedBy: user.id
      };
      const profile = await this.persistProfile(context, {
        ...context.profile,
        documentCandidates: context.profile.documentCandidates.map((item) =>
          item.id === next.id ? next : item
        ),
        updatedAt: now(),
        updatedBy: user.id
      });
      return { candidate: next, profile };
    }

    const preview = await this.previewDocument(businessId, user, input.documentId);
    const draft = draftIntakeChange({
      document: preview.document,
      profile: context.profile,
      extracted: preview.extracted,
      fieldKey: input.fieldKey,
      pageNumber: input.pageNumber,
      excerpt: input.excerpt,
      proposedValue: input.proposedValue
    });
    const existing = input.candidateId
      ? this.requireCandidate(context.profile, input.candidateId, input.documentId)
      : undefined;
    const candidate =
      existing ??
      candidateFromDraft(draft, {
        id: companionId("cand"),
        createdAt: now()
      });
    const withCandidate = existing
      ? context.profile
      : { ...context.profile, documentCandidates: [candidate, ...context.profile.documentCandidates] };
    const applied = applyConfirmedIntake(withCandidate, draft, user.id, {
      ownerEdited: input.action === "edit" || input.ownerEdited,
      conflictResolution: input.conflictResolution,
      selectSource: input.selectSource,
      candidate
    });
    const profile = await this.persistProfile(context, applied.profile);
    const resolved = profile.documentCandidates.find((item) => item.id === candidate.id) ?? candidate;
    return { draft, candidate: resolved, confirmation: applied.confirmation, profile };
  }

  async confirmDocumentIntake(
    businessId: string,
    user: User,
    input: {
      documentId: string;
      candidateId?: string;
      fieldKey: string;
      pageNumber: number;
      excerpt: string;
      proposedValue?: string;
      ownerEdited?: boolean;
      conflictResolution?: "replace" | "keep";
      selectSource?: boolean;
    }
  ) {
    return this.resolveDocumentIntake(businessId, user, {
      ...input,
      action: input.ownerEdited ? "edit" : "confirm"
    });
  }

  async deleteDocument(businessId: string, user: User, documentId: string) {
    const context = await this.requireMutable(businessId, user);
    const document = await this.store.companion.getDocument(documentId);
    if (!document || document.businessId !== businessId) {
      throw new NotFoundError("Document not found.");
    }
    const nextDocument = {
      ...document,
      status: "deleted" as const,
      deletedAt: now(),
      providerFileId: undefined
    };
    await this.store.companion.updateDocument(nextDocument);
    if (document.blobId) await this.store.companion.deleteBlob(document.blobId);
    const live = (await this.store.companion.listDocuments(businessId)).filter((item) => item.status !== "deleted");
    const selected = context.profile.sourceDocumentIds.filter((id) => id !== documentId);
    const scrubbed = refreshFieldSourceStatuses(
      rejectDocumentCandidatesForSource(context.profile, documentId, user.id),
      new Set(live.map((item) => item.id)),
      new Set(selected)
    );
    const profile = await this.persistProfile(context, {
      ...scrubbed,
      updatedAt: now(),
      updatedBy: user.id
    });
    return { document: nextDocument, profile };
  }

  private requireCandidate(profile: BusinessProfile, candidateId: string | undefined, documentId: string) {
    if (!candidateId) {
      throw new NotFoundError("Document fact candidate not found.");
    }
    const candidate = profile.documentCandidates.find((item) => item.id === candidateId);
    if (!candidate || candidate.documentId !== documentId) {
      throw new NotFoundError("Document fact candidate not found.");
    }
    return candidate;
  }

  private async persistProfile(context: AuthorizedBusinessContext, profile: BusinessProfile) {
    const next = normalizeProfile({
      ...profile,
      businessId: context.business.id,
      updatedAt: profile.updatedAt || now(),
      updatedBy: profile.updatedBy
    });
    await this.store.companion.upsertProfile(next);
    const business = {
      ...context.business,
      name: next.fields.name.value || context.business.name,
      updatedAt: next.updatedAt
    };
    await this.store.companion.updateBusiness(business);
    return next;
  }

  async authorizedProjectStatus(businessId: string, user: User, projectId?: string) {
    const context = await this.requireMembership(businessId, user);
    const projects = projectId
      ? (await this.store.listProjectsByBusiness(businessId)).filter((item) => item.id === projectId)
      : await this.store.listProjectsByBusiness(businessId);
    const views = [];
    for (const project of projects) {
      if (user.role !== "founder" && project.ownerId !== user.id) continue;
      const proposals = (await this.store.listProposals(project.id)).filter(isClientVisibleProposal);
      const live = currentClientProposal(proposals);
      views.push({
        id: project.id,
        title: project.title,
        status: project.status,
        currentProposalVersion: live?.version ?? null,
        currentProposalStatus: live?.status ?? null
      });
    }
    return { businessId: context.business.id, projects: views };
  }

  private async attachOrphanProjects(business: Business, user: User) {
    const owned = await this.store.listProjectsByOwner(user.id);
    for (const project of owned) {
      if (project.businessId) continue;
      await this.store.updateProject({ ...project, businessId: business.id, updatedAt: now() });
    }
  }
}
