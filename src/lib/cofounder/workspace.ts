import { emptyProfile, normalizeProfile } from "@/lib/cofounder/profile";
import { resolvePlanId } from "@/lib/cofounder/entitlements";
import { ForbiddenError, NotFoundError } from "@/lib/domain/errors";
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

function companionId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export class CompanionWorkspace {
  constructor(private readonly store: PersistenceAdapter) {}

  async ensureForUser(user: User, requestedBusinessId?: string): Promise<AuthorizedBusinessContext> {
    if (requestedBusinessId) {
      return this.requireMembership(requestedBusinessId, user);
    }
    const existing = await this.store.companion.listBusinessesForUser(user.id);
    if (existing[0]) {
      await this.attachOrphanProjects(existing[0], user);
      return this.requireMembership(existing[0].id, user);
    }
    const stamp = now();
    const business: Business = {
      id: companionId("biz"),
      ownerId: user.id,
      name: user.displayName ? `${user.displayName}’s business` : "Your business",
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
    await this.store.companion.upsertProfile(emptyProfile(business.id, stamp));
    await this.attachOrphanProjects(business, user);
    return this.requireMembership(business.id, user);
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

  async listForUser(user: User) {
    if (user.role === "founder") {
      return this.store.companion.listAllBusinesses();
    }
    return this.store.companion.listBusinessesForUser(user.id);
  }

  async updateProfile(businessId: string, user: User, patch: Partial<BusinessProfile>) {
    const context = await this.requireMembership(businessId, user);
    if (context.membership.role === "founder" && context.business.ownerId !== user.id) {
      throw new ForbiddenError("Founder visibility does not edit another client’s confirmed facts.");
    }
    const next = normalizeProfile({
      ...context.profile,
      ...patch,
      fields: { ...context.profile.fields, ...patch.fields },
      approvedRates: patch.approvedRates ?? context.profile.approvedRates,
      brandAssets: patch.brandAssets ?? context.profile.brandAssets,
      sourceDocumentIds: patch.sourceDocumentIds ?? context.profile.sourceDocumentIds,
      businessId,
      updatedAt: now(),
      updatedBy: user.id
    });
    await this.store.companion.upsertProfile(next);
    const business = { ...context.business, name: next.fields.name.value || context.business.name, updatedAt: next.updatedAt };
    await this.store.companion.updateBusiness(business);
    return next;
  }

  async proposeMemory(
    businessId: string,
    user: User,
    fieldKey: ProfileFieldKey,
    proposedValue: string,
    rationale?: string
  ) {
    await this.requireMembership(businessId, user);
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
    const context = await this.requireMembership(businessId, user);
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
    await this.requireMembership(businessId, user);
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
