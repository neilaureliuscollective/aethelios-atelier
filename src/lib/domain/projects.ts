import "server-only";
import { briefTitle, createEmptyBrief, normalizeBrief } from "@/lib/brief";
import { CONSENT_TEXT, DELIVERY_APPROVAL_TEXT, PROPOSAL_AGREEMENT_TEXT } from "@/lib/copy";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/domain/errors";
import { isUniqueViolation } from "@/lib/persistence/unique";
import { GuestWorkService } from "@/lib/guest/claim";
import { buildDeliveryHandoff } from "@/lib/domain/handoff";
import { toClientView } from "@/lib/domain/next-step";
import {
  assertPublishableScope,
  confirmedProposal,
  currentClientProposal,
  deliveryFingerprint,
  isClientVisibleDelivery,
  isClientVisibleProposal,
  latestOf,
  normalizeProposalScope,
  proposalFingerprint,
  seedProposalScope
} from "@/lib/domain/proposal";
import { createId, createReceiptId } from "@/lib/ids";
import { submitFingerprint } from "@/lib/submitFingerprint";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import type {
  AuthContext,
  Brief,
  BriefFieldKey,
  ChatMessage,
  ClientProjectView,
  ClientUpdateKind,
  ContentRequest,
  DeliveryFeedbackKind,
  DeliveryVersionKind,
  FounderAttentionItem,
  FounderNote,
  FounderProjectView,
  FounderQueueItem,
  GuestDraft,
  MilestoneStatus,
  Project,
  Proposal,
  ProposalDecisionKind,
  Suggestion,
  User
} from "@/lib/types";

function now() {
  return new Date().toISOString();
}

function assertOwner(project: Project, user: User) {
  if (project.ownerId !== user.id) {
    throw new ForbiddenError("This commission belongs to another account.");
  }
}

function assertFounder(user: User) {
  if (user.role !== "founder") {
    throw new ForbiddenError("Founder authorization is required.");
  }
}

function stripPrivate<T extends { privateNotes?: FounderNote[] }>(view: T) {
  const copy = { ...view };
  delete copy.privateNotes;
  return copy;
}

export class ProjectService {
  constructor(private readonly store: PersistenceAdapter) {}

  async createProject(owner: User, brief?: Brief, guestDraftId?: string) {
    const normalized = normalizeBrief(brief ?? createEmptyBrief());
    const stamp = now();
    const businesses = await this.store.companion.listBusinessesForUser(owner.id);
    const project: Project = {
      id: createId("prj"),
      ownerId: owner.id,
      title: briefTitle(normalized),
      status: "draft",
      brief: normalized,
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
      adoptedFromGuestId: guestDraftId,
      businessId: businesses[0]?.id
    };
    return this.store.createProject(project);
  }

  async adoptGuestDraft(owner: User, draft: GuestDraft, confirmed: boolean) {
    if (!confirmed) {
      throw new ForbiddenError("Guest drafts are not adopted until you confirm the review.");
    }
    if (draft.kind !== "guest_draft") {
      throw new ForbiddenError("Only labeled guest drafts can be adopted.");
    }
    return this.store.runInTransaction(async () => {
      const existing = await this.store.getProjectByOwnerAndGuestDraft(owner.id, draft.draftId);
      if (existing) return existing;
      const claimed = await this.store.getProjectByGuestDraft(draft.draftId);
      if (claimed && claimed.ownerId !== owner.id) {
        throw new ForbiddenError("This guest work already belongs to another account.");
      }
      await new GuestWorkService(this.store).claim(owner, {
        guestWorkId: draft.draftId,
        kind: "brief",
        destination: "/account/adopt"
      });
      try {
        const project = await this.createProject(owner, draft.brief, draft.draftId);
        for (const message of draft.messages) {
          await this.store.addMessage({
            id: createId("msg"),
            projectId: project.id,
            authorKind: message.authorKind,
            body: message.body,
            liveAi: false,
            createdAt: message.createdAt,
            metadata: { importedFromGuest: true, originalId: message.id }
          });
        }
        return project;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const again = await this.store.getProjectByOwnerAndGuestDraft(owner.id, draft.draftId);
        if (again) return again;
        throw new ForbiddenError("This guest work already belongs to another account.");
      }
    });
  }

  async listForOwner(user: User) {
    return this.store.listProjectsByOwner(user.id);
  }

  async getOwnedProject(id: string, user: User) {
    const project = await this.store.getProject(id);
    if (!project) throw new NotFoundError("Project not found.");
    assertOwner(project, user);
    return project;
  }

  async clientView(id: string, user: User): Promise<ClientProjectView> {
    const project = await this.getOwnedProject(id, user);
    return this.buildClientView(project, {
      user,
      session: { id: "", userId: user.id, createdAt: "", expiresAt: "" },
      adapter: user.adapter
    });
  }

  async founderView(id: string, founder: User): Promise<FounderProjectView> {
    assertFounder(founder);
    const project = await this.store.getProject(id);
    if (!project) throw new NotFoundError("Project not found.");
    const owner = await this.store.getUserById(project.ownerId);
    if (!owner) throw new NotFoundError("Owner not found.");
    const base = await this.buildClientView(project, null, true);
    const handoff = this.handoffFromView(base);
    return {
      ...base,
      privateNotes: await this.store.listFounderNotes(project.id),
      owner: {
        id: owner.id,
        email: owner.email,
        displayName: owner.displayName,
        adapter: owner.adapter
      },
      handoff
    };
  }

  async founderQueue(founder: User): Promise<FounderQueueItem[]> {
    assertFounder(founder);
    const projects = await this.store.listSubmittedProjects();
    const queue: FounderQueueItem[] = [];
    for (const project of projects) {
      const owner = await this.store.getUserById(project.ownerId);
      const reviews = await this.store.listReviewEvents(project.id);
      const attention = await this.founderAttention(project.id, reviews[0]?.createdAt ?? null);
      const proposals = await this.store.listProposals(project.id);
      const live = currentClientProposal(proposals);
      const confirmed = confirmedProposal(proposals);
      const milestones = await this.store.listDeliveryMilestones(project.id);
      const nextMilestone =
        milestones.find((item) => item.status === "current" || item.status === "waiting_on_client") ??
        milestones.find((item) => item.status === "upcoming");
      queue.push({
        id: project.id,
        title: briefTitle(project.brief),
        status: project.status,
        updatedAt: project.updatedAt,
        reviewStartedAt: reviews[0]?.createdAt ?? null,
        owner: owner
          ? { id: owner.id, email: owner.email, displayName: owner.displayName, adapter: owner.adapter }
          : null,
        attention,
        currentProposalVersion: live?.version ?? null,
        confirmedProposalVersion: confirmed?.version ?? null,
        nextMilestone: nextMilestone?.title ?? null
      });
    }
    return queue.sort((a, b) => {
      const score = (item: FounderQueueItem) => (item.attention.length ? 0 : 1);
      const byAttention = score(a) - score(b);
      if (byAttention !== 0) return byAttention;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  async saveBrief(
    projectId: string,
    user: User,
    brief: Brief,
    expectedVersion: number,
    localGeneration?: number
  ) {
    const project = await this.getOwnedProject(projectId, user);
    if (project.version !== expectedVersion) {
      throw new ConflictError(
        "The saved brief is newer than this edit. Your latest typing was not overwritten.",
        project.version,
        project.brief
      );
    }
    const stamp = now();
    const next: Project = {
      ...project,
      brief: normalizeBrief(brief),
      title: briefTitle(brief),
      version: project.version + 1,
      updatedAt: stamp
    };
    const saved = await this.store.updateProject(next);
    return { project: saved, appliedLocalGeneration: localGeneration ?? null };
  }

  async submit(
    projectId: string,
    user: User,
    consent: boolean,
    idempotencyKey: string,
    expectedVersion: number
  ) {
    if (!consent) {
      throw new ForbiddenError("Submission requires explicit consent.");
    }
    if (!idempotencyKey.trim()) {
      throw new ForbiddenError("An idempotency key is required so retries cannot duplicate this send.");
    }
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      throw new ForbiddenError("Consent must name the exact saved revision under review.");
    }
    const project = await this.getOwnedProject(projectId, user);
    const ledgerId = `${user.id}:${idempotencyKey}`;
    const prior = await this.store.getLedger(ledgerId);
    if (prior?.ownerId && prior.ownerId !== user.id) {
      throw new ForbiddenError("This retry belongs to another account.");
    }
    if (prior?.projectId && prior.projectId !== projectId) {
      throw new ConflictError("This retry key is bound to a different commission.");
    }

    const existing =
      (await this.store.getSubmissionByIdempotency(projectId, idempotencyKey)) ??
      (await this.store.getSubmissionByIdempotencyKey(idempotencyKey));
    if (existing) {
      if (existing.ownerId !== user.id) {
        throw new ForbiddenError("This retry belongs to another account.");
      }
      if (existing.projectId !== projectId) {
        throw new ConflictError("This retry key is bound to a different commission.");
      }
      if (existing.reviewedVersion !== expectedVersion) {
        throw new ConflictError("This retry key was issued for a different reviewed snapshot.");
      }
      if (existing.consentText !== CONSENT_TEXT) {
        throw new ConflictError("This retry key was issued for a different consent record.");
      }
      const readBack = await this.store.getSubmission(existing.id);
      if (!readBack?.receiptId) {
        throw new ConflictError("A receipt could not be independently read back.");
      }
      return { submission: readBack, duplicate: true as const };
    }

    if (project.version !== expectedVersion) {
      throw new ConflictError(
        "This consent applies to a different saved revision. Save the brief, review it, and send that exact version.",
        project.version,
        project.brief
      );
    }
    const payloadHash = submitFingerprint({
      projectId,
      ownerId: user.id,
      expectedVersion,
      brief: project.brief
    });
    if (prior?.payloadHash && prior.payloadHash !== payloadHash) {
      throw new ConflictError("This retry key was issued for a different reviewed snapshot.");
    }

    return this.store.runInTransaction(async () => {
      const insideExisting = await this.store.getSubmissionByIdempotency(projectId, idempotencyKey);
      if (insideExisting) {
        if (insideExisting.reviewedVersion !== expectedVersion || insideExisting.consentText !== CONSENT_TEXT) {
          throw new ConflictError("This retry key was issued for a different reviewed snapshot.");
        }
        return { submission: insideExisting, duplicate: true as const };
      }
      const current = await this.getOwnedProject(projectId, user);
      if (current.version !== expectedVersion) {
        throw new ConflictError(
          "This consent applies to a different saved revision. Save the brief, review it, and send that exact version.",
          current.version
        );
      }
      await this.store.putLedger({
        id: ledgerId,
        ownerId: user.id,
        projectId,
        operation: "submit",
        payloadHash,
        status: "in_flight",
        createdAt: prior?.createdAt ?? now(),
        updatedAt: now()
      });
      const stamp = now();
      const snapshot = structuredClone(current.brief);
      const created = await this.store.createSubmission({
        id: createId("sub"),
        projectId: current.id,
        ownerId: user.id,
        snapshot,
        title: current.title,
        consentText: CONSENT_TEXT,
        consentedAt: stamp,
        receiptId: createReceiptId(),
        idempotencyKey,
        createdAt: stamp,
        reviewedVersion: expectedVersion,
        payloadHash
      });
      await this.store.updateProject({
        ...current,
        status: current.status === "draft" ? "submitted" : current.status,
        latestSubmissionId: created.id,
        updatedAt: stamp
      });
      const readBack = await this.store.getSubmission(created.id);
      if (!readBack?.receiptId) {
        throw new ConflictError("Submission stored but the receipt could not be independently confirmed.");
      }
      await this.store.putLedger({
        id: ledgerId,
        ownerId: user.id,
        projectId,
        operation: "submit",
        payloadHash,
        status: "confirmed",
        resultJson: JSON.stringify({ id: readBack.id, receiptId: readBack.receiptId }),
        createdAt: prior?.createdAt ?? stamp,
        updatedAt: stamp
      });
      return { submission: readBack, duplicate: false as const };
    });
  }

  async markUncertain(ownerId: string, idempotencyKey: string, projectId: string, operation: string) {
    const ledgerId = `${ownerId}:${idempotencyKey}`;
    const prior = await this.store.getLedger(ledgerId);
    await this.store.putLedger({
      id: ledgerId,
      ownerId,
      projectId,
      operation,
      payloadHash: prior?.payloadHash ?? "",
      status: "uncertain",
      resultJson: prior?.resultJson,
      createdAt: prior?.createdAt ?? now(),
      updatedAt: now()
    });
  }

  async addClientMessage(projectId: string, user: User, body: string) {
    await this.getOwnedProject(projectId, user);
    return this.store.addMessage({
      id: createId("msg"),
      projectId,
      authorKind: "client",
      body,
      liveAi: false,
      createdAt: now()
    });
  }

  async addSystemMessage(projectId: string, body: string, liveAi = false, metadata?: ChatMessage["metadata"]) {
    return this.store.addMessage({
      id: createId("msg"),
      projectId,
      authorKind: liveAi ? "assistant" : "system",
      body,
      liveAi,
      createdAt: now(),
      metadata
    });
  }

  async proposeSuggestion(
    projectId: string,
    fieldKey: BriefFieldKey,
    proposedValue: string,
    rationale?: string
  ) {
    const project = await this.store.getProject(projectId);
    if (!project) throw new NotFoundError();
    const suggestion = await this.store.addSuggestion({
      id: createId("sug"),
      projectId,
      fieldKey,
      proposedValue,
      rationale,
      status: "pending",
      createdAt: now()
    });
    const brief = { ...project.brief };
    brief[fieldKey] = {
      ...brief[fieldKey],
      provenance: brief[fieldKey].value ? brief[fieldKey].provenance : "ai_suggestion_pending",
      pendingSuggestionId: suggestion.id,
      unresolvedQuestion: brief[fieldKey].unresolvedQuestion
    };
    await this.store.updateProject({ ...project, brief, updatedAt: now() });
    return suggestion;
  }

  async resolveSuggestion(
    projectId: string,
    suggestionId: string,
    user: User,
    action: "accept" | "reject" | "edit",
    editedValue?: string
  ) {
    const project = await this.getOwnedProject(projectId, user);
    const suggestion = await this.store.getSuggestion(suggestionId);
    if (!suggestion || suggestion.projectId !== projectId) {
      throw new NotFoundError("Suggestion not found.");
    }
    const stamp = now();
    const nextStatus = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "edited";
    const updated: Suggestion = { ...suggestion, status: nextStatus, resolvedAt: stamp };
    await this.store.updateSuggestion(updated);
    const brief = { ...project.brief };
    const field = { ...brief[suggestion.fieldKey] };
    if (action === "accept") {
      field.value = suggestion.proposedValue;
      field.provenance = "ai_suggestion_accepted";
      field.pendingSuggestionId = undefined;
    } else if (action === "edit") {
      field.value = editedValue ?? suggestion.proposedValue;
      field.provenance = "ai_suggestion_edited";
      field.pendingSuggestionId = undefined;
    } else {
      field.pendingSuggestionId = undefined;
      if (field.provenance === "ai_suggestion_pending") {
        field.provenance = field.value ? "client_statement" : "empty";
      }
    }
    brief[suggestion.fieldKey] = field;
    await this.store.updateProject({
      ...project,
      brief,
      title: briefTitle(brief),
      version: project.version + 1,
      updatedAt: stamp
    });
    return updated;
  }

  async startReview(projectId: string, founder: User) {
    assertFounder(founder);
    const project = await this.store.getProject(projectId);
    if (!project) throw new NotFoundError();
    if (!project.latestSubmissionId) {
      throw new ForbiddenError("Review can begin only after a submitted snapshot exists.");
    }
    const existing = await this.store.listReviewEvents(projectId);
    if (existing.length) return existing[0]!;
    const event = await this.store.addReviewEvent({
      id: createId("rev"),
      projectId,
      founderId: founder.id,
      kind: "review_started",
      createdAt: now()
    });
    await this.store.updateProject({
      ...project,
      status: "founder_reviewing",
      updatedAt: now()
    });
    return event;
  }

  async addPrivateNote(
    projectId: string,
    founder: User,
    body: string,
    kind: FounderNote["kind"] = "private_note"
  ) {
    assertFounder(founder);
    const project = await this.store.getProject(projectId);
    if (!project) throw new NotFoundError();
    return this.store.addFounderNote({
      id: createId("note"),
      projectId,
      founderId: founder.id,
      body,
      kind,
      createdAt: now(),
      updatedAt: now(),
      version: 1
    });
  }

  async publishUpdate(
    projectId: string,
    founder: User,
    kind: ClientUpdateKind,
    body: string,
    requiresResponse?: boolean
  ) {
    assertFounder(founder);
    const project = await this.store.getProject(projectId);
    if (!project) throw new NotFoundError();
    const update = await this.store.addClientUpdate({
      id: createId("upd"),
      projectId,
      founderId: founder.id,
      kind,
      body,
      requiresResponse: requiresResponse ?? kind === "clarification",
      createdAt: now()
    });
    let status = project.status;
    if (kind === "clarification") status = "clarification_requested";
    if (kind === "decision") status = "decision_published";
    await this.store.updateProject({ ...project, status, updatedAt: now() });
    return update;
  }

  async respondToClarification(projectId: string, user: User, updateId: string, body: string) {
    const project = await this.getOwnedProject(projectId, user);
    const update = (await this.store.listClientUpdates(projectId)).find((item) => item.id === updateId);
    if (!update || update.kind !== "clarification") {
      throw new NotFoundError("Clarification not found.");
    }
    const response = await this.store.addClarificationResponse({
      id: createId("clr"),
      updateId,
      projectId,
      authorId: user.id,
      body,
      createdAt: now()
    });
    if (project.status === "clarification_requested") {
      const reviews = await this.store.listReviewEvents(projectId);
      await this.store.updateProject({
        ...project,
        status: reviews.length ? "founder_reviewing" : "submitted",
        updatedAt: now()
      });
    }
    return response;
  }

  async saveProposalDraft(
    projectId: string,
    founder: User,
    scope: unknown,
    changeSummary = "",
    seedFromBrief = false
  ) {
    assertFounder(founder);
    const project = await this.requireSubmittedProject(projectId);
    const existing = await this.store.listProposals(projectId);
    const latest = latestOf(existing);
    const stamp = now();
    const snapshot = project.latestSubmissionId
      ? await this.store.getSubmission(project.latestSubmissionId)
      : (await this.store.listSubmissions(projectId)).at(-1);
    const nextScope = seedFromBrief
      ? seedProposalScope(snapshot?.snapshot ?? project.brief)
      : normalizeProposalScope(scope);

    if (latest?.status === "draft") {
      const updated: Proposal = {
        ...latest,
        scope: nextScope,
        changeSummary: changeSummary.trim() || latest.changeSummary,
        payloadHash: proposalFingerprint(nextScope, latest.version, changeSummary.trim() || latest.changeSummary),
        updatedAt: stamp
      };
      return this.store.updateProposal(updated);
    }

    const version = (latest?.version ?? 0) + 1;
    const created: Proposal = {
      id: createId("prp"),
      projectId,
      founderId: founder.id,
      version,
      status: "draft",
      scope: nextScope,
      changeSummary: changeSummary.trim(),
      basedOnSubmissionId: snapshot?.id,
      supersedesProposalId: latest?.id,
      payloadHash: proposalFingerprint(nextScope, version, changeSummary.trim()),
      createdAt: stamp,
      updatedAt: stamp
    };
    return this.store.addProposal(created);
  }

  async publishProposal(projectId: string, founder: User, proposalId: string) {
    assertFounder(founder);
    const project = await this.requireSubmittedProject(projectId);
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal || proposal.projectId !== projectId) {
      throw new NotFoundError("Proposal not found.");
    }
    if (proposal.status !== "draft") {
      throw new ForbiddenError("Only an unpublished draft can be published. Later edits create a new version.");
    }
    const scope = assertPublishableScope(proposal.scope);
    const reviews = await this.store.listReviewEvents(projectId);
    if (!reviews.length) {
      await this.startReview(projectId, founder);
    }
    const stamp = now();
    const siblings = await this.store.listProposals(projectId);
    for (const sibling of siblings) {
      if (sibling.id === proposal.id) continue;
      if (sibling.status === "published" || sibling.status === "changes_requested") {
        await this.store.updateProposal({
          ...sibling,
          status: "superseded",
          updatedAt: stamp
        });
      }
    }
    const published: Proposal = {
      ...proposal,
      scope,
      status: "published",
      payloadHash: proposalFingerprint(scope, proposal.version, proposal.changeSummary),
      publishedAt: stamp,
      updatedAt: stamp
    };
    await this.store.updateProposal(published);
    await this.store.updateProject({
      ...project,
      status: "proposal_ready",
      updatedAt: stamp
    });
    return published;
  }

  async decideProposal(
    projectId: string,
    user: User,
    proposalId: string,
    kind: ProposalDecisionKind,
    expectedVersion: number,
    body: string,
    consent = false
  ) {
    const project = await this.getOwnedProject(projectId, user);
    const proposal = await this.store.getProposal(proposalId);
    if (!proposal || proposal.projectId !== projectId || !isClientVisibleProposal(proposal)) {
      throw new NotFoundError("Proposal not found.");
    }
    if (proposal.version !== expectedVersion) {
      throw new ConflictError(
        "This action applies to a different proposal version. Reload the published version and respond to that exact text.",
        proposal.version
      );
    }
    if (proposal.status === "superseded") {
      throw new ConflictError("This proposal version was replaced. Review the current published version.", proposal.version);
    }
    if (proposal.status === "approved" && kind === "approve") {
      const existing = (await this.store.listProposalDecisions(projectId)).find(
        (item) => item.proposalId === proposalId && item.kind === "approve"
      );
      if (existing) return { decision: existing, duplicate: true as const, proposal };
    }
    if (proposal.status !== "published") {
      throw new ForbiddenError("Only the currently published proposal version can be approved or sent back.");
    }
    if (kind === "approve" && !consent) {
      throw new ForbiddenError("Agreeing to a proposal requires explicit consent to that exact version.");
    }
    if (kind === "request_changes" && !body.trim()) {
      throw new ForbiddenError("Describe the changes you need so the next version can be scoped.");
    }
    const stamp = now();
    const decision = await this.store.addProposalDecision({
      id: createId("pdc"),
      proposalId,
      projectId,
      authorId: user.id,
      kind,
      body: body.trim(),
      agreementText: kind === "approve" ? PROPOSAL_AGREEMENT_TEXT : undefined,
      agreedVersion: expectedVersion,
      createdAt: stamp
    });
    if (kind === "approve") {
      const approved = await this.store.updateProposal({
        ...proposal,
        status: "approved",
        updatedAt: stamp
      });
      await this.materializeMilestones(approved);
      await this.store.updateProject({
        ...project,
        status: "scope_confirmed",
        updatedAt: stamp
      });
      return { decision, duplicate: false as const, proposal: approved };
    }
    const returned = await this.store.updateProposal({
      ...proposal,
      status: "changes_requested",
      updatedAt: stamp
    });
    await this.store.updateProject({
      ...project,
      status: "proposal_changes_requested",
      updatedAt: stamp
    });
    return { decision, duplicate: false as const, proposal: returned };
  }

  async saveDeliveryDraft(
    projectId: string,
    founder: User,
    input: {
      kind: DeliveryVersionKind;
      title: string;
      summary: string;
      previewUrl?: string;
      notes?: string;
    }
  ) {
    assertFounder(founder);
    await this.requireSubmittedProject(projectId);
    const kind = input.kind;
    const existing = (await this.store.listDeliveryVersions(projectId)).filter((item) => item.kind === kind);
    const latest = latestOf(existing);
    const stamp = now();
    const title = input.title.trim();
    const summary = input.summary.trim();
    const notes = input.notes?.trim() ?? "";
    const previewUrl = input.previewUrl?.trim() || undefined;
    if (!title || !summary) {
      throw new ForbiddenError("A delivery version needs a title and a written explanation of what changed.");
    }
    if (latest?.status === "draft") {
      const updated = {
        ...latest,
        title,
        summary,
        previewUrl,
        notes,
        payloadHash: deliveryFingerprint({ kind, version: latest.version, title, summary, previewUrl, notes }),
        updatedAt: stamp
      };
      return this.store.updateDeliveryVersion(updated);
    }
    const version = (latest?.version ?? 0) + 1;
    return this.store.addDeliveryVersion({
      id: createId("dlv"),
      projectId,
      founderId: founder.id,
      kind,
      version,
      title,
      summary,
      previewUrl,
      notes,
      status: "draft",
      payloadHash: deliveryFingerprint({ kind, version, title, summary, previewUrl, notes }),
      createdAt: stamp,
      updatedAt: stamp
    });
  }

  async publishDeliveryVersion(projectId: string, founder: User, versionId: string) {
    assertFounder(founder);
    const project = await this.requireSubmittedProject(projectId);
    const version = await this.store.getDeliveryVersion(versionId);
    if (!version || version.projectId !== projectId) {
      throw new NotFoundError("Delivery version not found.");
    }
    if (version.status !== "draft") {
      throw new ForbiddenError("Only an unpublished draft can be published. Later edits create a new version.");
    }
    const stamp = now();
    const siblings = await this.store.listDeliveryVersions(projectId);
    for (const sibling of siblings) {
      if (sibling.id === version.id || sibling.kind !== version.kind) continue;
      if (sibling.status === "awaiting_review" || sibling.status === "changes_requested") {
        await this.store.updateDeliveryVersion({
          ...sibling,
          status: "superseded",
          updatedAt: stamp
        });
      }
    }
    const published = await this.store.updateDeliveryVersion({
      ...version,
      status: "awaiting_review",
      publishedAt: stamp,
      updatedAt: stamp
    });
    await this.store.updateProject({
      ...project,
      status: "delivery_review",
      updatedAt: stamp
    });
    return published;
  }

  async addDeliveryFeedback(
    projectId: string,
    user: User,
    versionId: string,
    kind: DeliveryFeedbackKind,
    expectedVersion: number,
    body: string,
    consent = false
  ) {
    const project = await this.getOwnedProject(projectId, user);
    const version = await this.store.getDeliveryVersion(versionId);
    if (!version || version.projectId !== projectId || !isClientVisibleDelivery(version)) {
      throw new NotFoundError("Delivery version not found.");
    }
    if (version.version !== expectedVersion) {
      throw new ConflictError(
        "This action applies to a different design or build version. Reload and respond to the version on screen.",
        version.version
      );
    }
    if (version.status === "superseded") {
      throw new ConflictError("This version was replaced. Review the current published version.", version.version);
    }
    if (kind !== "comment" && version.status !== "awaiting_review") {
      throw new ForbiddenError("Only the currently published version can be approved or sent back.");
    }
    if (kind === "approve" && !consent) {
      throw new ForbiddenError("Approving a version requires explicit agreement to that exact version.");
    }
    if ((kind === "request_changes" || kind === "comment") && !body.trim()) {
      throw new ForbiddenError("Add a note so this version keeps a written record.");
    }
    const stamp = now();
    const feedback = await this.store.addDeliveryFeedback({
      id: createId("dfb"),
      deliveryVersionId: versionId,
      projectId,
      authorId: user.id,
      authorKind: "client",
      kind,
      body: kind === "approve" ? body.trim() || DELIVERY_APPROVAL_TEXT : body.trim(),
      expectedVersion,
      createdAt: stamp
    });
    if (kind === "approve") {
      await this.store.updateDeliveryVersion({
        ...version,
        status: "approved",
        updatedAt: stamp
      });
      await this.advanceMilestone(projectId, version.kind === "design" ? "Design review" : "Build review");
    } else if (kind === "request_changes") {
      await this.store.updateDeliveryVersion({
        ...version,
        status: "changes_requested",
        updatedAt: stamp
      });
      await this.store.updateProject({
        ...project,
        status: "delivery_review",
        updatedAt: stamp
      });
    }
    return feedback;
  }

  async addContentRequest(projectId: string, founder: User, title: string, detail: string) {
    assertFounder(founder);
    await this.requireSubmittedProject(projectId);
    if (!title.trim() || !detail.trim()) {
      throw new ForbiddenError("A content request needs a title and a description of what is missing.");
    }
    return this.store.addContentRequest({
      id: createId("crq"),
      projectId,
      founderId: founder.id,
      title: title.trim(),
      detail: detail.trim(),
      status: "requested",
      createdAt: now()
    });
  }

  async respondToContentRequest(projectId: string, user: User, requestId: string, body: string) {
    await this.getOwnedProject(projectId, user);
    const request = await this.store.getContentRequest(requestId);
    if (!request || request.projectId !== projectId) {
      throw new NotFoundError("Content request not found.");
    }
    if (request.status !== "requested") {
      throw new ForbiddenError("This content request is already closed.");
    }
    if (!body.trim()) {
      throw new ForbiddenError("Add the missing material or a note about where it lives.");
    }
    return this.store.updateContentRequest({
      ...request,
      status: "provided",
      response: body.trim(),
      resolvedAt: now()
    });
  }

  async resolveContentRequest(
    projectId: string,
    founder: User,
    requestId: string,
    status: Extract<ContentRequest["status"], "provided" | "waived">
  ) {
    assertFounder(founder);
    const request = await this.store.getContentRequest(requestId);
    if (!request || request.projectId !== projectId) {
      throw new NotFoundError("Content request not found.");
    }
    return this.store.updateContentRequest({
      ...request,
      status,
      resolvedAt: now()
    });
  }

  async updateMilestoneStatus(projectId: string, founder: User, milestoneId: string, status: MilestoneStatus) {
    assertFounder(founder);
    const milestones = await this.store.listDeliveryMilestones(projectId);
    const milestone = milestones.find((item) => item.id === milestoneId);
    if (!milestone) throw new NotFoundError("Milestone not found.");
    const stamp = now();
    const updated = await this.store.updateDeliveryMilestone({
      ...milestone,
      status,
      updatedAt: stamp
    });
    if (status === "current") {
      for (const other of milestones) {
        if (other.id !== milestone.id && other.status === "current") {
          await this.store.updateDeliveryMilestone({
            ...other,
            status: "upcoming",
            updatedAt: stamp
          });
        }
      }
    }
    return updated;
  }

  async deliveryHandoff(projectId: string, founder: User) {
    const view = await this.founderView(projectId, founder);
    return view.handoff;
  }

  private async requireSubmittedProject(projectId: string) {
    const project = await this.store.getProject(projectId);
    if (!project) throw new NotFoundError("Project not found.");
    if (!project.latestSubmissionId && project.status === "draft") {
      throw new ForbiddenError("A proposal can be written only after a submitted snapshot exists.");
    }
    return project;
  }

  private async materializeMilestones(proposal: Proposal) {
    const existing = await this.store.listDeliveryMilestones(proposal.projectId);
    if (existing.length) {
      for (const item of existing) {
        const complete = item.title.toLowerCase().includes("confirm scope") || item.sortOrder === 0;
        await this.store.updateDeliveryMilestone({
          ...item,
          status: complete ? "complete" : item.sortOrder === 1 ? "current" : item.status === "complete" ? "complete" : "upcoming",
          updatedAt: now()
        });
      }
      return;
    }
    const stamp = now();
    const rows = proposal.scope.milestones.length
      ? proposal.scope.milestones
      : [{ title: "Confirm scope", description: "Agreed proposal version.", timing: undefined }];
    for (const [index, item] of rows.entries()) {
      await this.store.addDeliveryMilestone({
        id: createId("mln"),
        projectId: proposal.projectId,
        proposalId: proposal.id,
        title: item.title,
        description: item.description,
        timing: item.timing,
        sortOrder: index,
        status: index === 0 ? "complete" : index === 1 ? "current" : "upcoming",
        createdAt: stamp,
        updatedAt: stamp
      });
    }
  }

  private async advanceMilestone(projectId: string, titleMatch: string) {
    const milestones = await this.store.listDeliveryMilestones(projectId);
    const match = milestones.find((item) => item.title.toLowerCase() === titleMatch.toLowerCase());
    if (!match || match.status === "complete") return;
    const stamp = now();
    await this.store.updateDeliveryMilestone({ ...match, status: "complete", updatedAt: stamp });
    const next = milestones.find((item) => item.sortOrder === match.sortOrder + 1);
    if (next && next.status !== "complete") {
      await this.store.updateDeliveryMilestone({ ...next, status: "current", updatedAt: stamp });
    }
  }

  private async founderAttention(projectId: string, reviewStartedAt: string | null): Promise<FounderAttentionItem[]> {
    const [updates, responses, proposals, versions, content, milestones] = await Promise.all([
      this.store.listClientUpdates(projectId),
      this.store.listClarificationResponses(projectId),
      this.store.listProposals(projectId),
      this.store.listDeliveryVersions(projectId),
      this.store.listContentRequests(projectId),
      this.store.listDeliveryMilestones(projectId)
    ]);
    const attention: FounderAttentionItem[] = [];
    if (!reviewStartedAt) {
      attention.push({
        code: "awaiting_review_start",
        label: "Start review",
        detail: "A submitted snapshot is waiting for a deliberate founder review."
      });
    }
    const openClarification = updates.some(
      (update) =>
        update.kind === "clarification" &&
        update.requiresResponse &&
        !responses.some((response) => response.updateId === update.id)
    );
    if (openClarification) {
      attention.push({
        code: "open_clarification",
        label: "Clarification unanswered",
        detail: "The owner has not answered a published question."
      });
    }
    const liveProposal = currentClientProposal(proposals);
    if (liveProposal?.status === "published") {
      attention.push({
        code: "awaiting_proposal_response",
        label: `Proposal v${liveProposal.version} awaiting response`,
        detail: "The client can request changes or agree to this exact version."
      });
    }
    if (liveProposal?.status === "changes_requested") {
      attention.push({
        code: "requested_revision",
        label: `Proposal v${liveProposal.version} needs a new version`,
        detail: "Publish a new proposal version instead of editing the requested text."
      });
    }
    const revision = versions.find((item) => item.status === "changes_requested");
    if (revision) {
      attention.push({
        code: "requested_revision",
        label: `${revision.kind} v${revision.version} needs a new version`,
        detail: "The client requested changes on this exact version."
      });
    }
    const awaitingDelivery = versions.find((item) => item.status === "awaiting_review");
    if (awaitingDelivery) {
      attention.push({
        code: "awaiting_delivery_review",
        label: `${awaitingDelivery.kind} v${awaitingDelivery.version} with the client`,
        detail: "Waiting for feedback or approval of this published version."
      });
    }
    const missing = content.filter((item) => item.status === "requested");
    if (missing.length) {
      attention.push({
        code: "missing_client_content",
        label: `${missing.length} content request${missing.length === 1 ? "" : "s"} open`,
        detail: missing.map((item) => item.title).join(", ")
      });
    }
    const nextMilestone =
      milestones.find((item) => item.status === "current" || item.status === "waiting_on_client") ??
      milestones.find((item) => item.status === "upcoming");
    if (nextMilestone && confirmedProposal(proposals)) {
      attention.push({
        code: "next_milestone",
        label: `Next: ${nextMilestone.title}`,
        detail: nextMilestone.description
      });
    }
    return attention;
  }

  private handoffFromView(view: ClientProjectView) {
    const proposal = confirmedProposal(view.proposals);
    if (!proposal) return null;
    return buildDeliveryHandoff({
      projectId: view.project.id,
      title: view.project.title,
      brief: view.submission?.snapshot ?? view.project.brief,
      proposal,
      decisions: view.proposalDecisions,
      deliveryVersions: view.deliveryVersions,
      contentRequests: view.contentRequests,
      milestones: view.milestones
    });
  }

  private async buildClientView(
    project: Project,
    auth: AuthContext | null,
    includeDrafts = false
  ): Promise<ClientProjectView> {
    const submission = project.latestSubmissionId
      ? await this.store.getSubmission(project.latestSubmissionId)
      : (await this.store.listSubmissions(project.id)).at(-1) ?? null;
    const reviews = await this.store.listReviewEvents(project.id);
    const proposals = await this.store.listProposals(project.id);
    const deliveryVersions = await this.store.listDeliveryVersions(project.id);
    return toClientView(
      {
        project,
        suggestions: await this.store.listSuggestions(project.id),
        messages: await this.store.listMessages(project.id),
        updates: await this.store.listClientUpdates(project.id),
        clarificationResponses: await this.store.listClarificationResponses(project.id),
        submission,
        reviewStartedAt: reviews[0]?.createdAt ?? null,
        proposals: includeDrafts ? proposals : proposals.filter(isClientVisibleProposal),
        proposalDecisions: await this.store.listProposalDecisions(project.id),
        deliveryVersions: includeDrafts ? deliveryVersions : deliveryVersions.filter(isClientVisibleDelivery),
        deliveryFeedback: await this.store.listDeliveryFeedback(project.id),
        contentRequests: await this.store.listContentRequests(project.id),
        milestones: await this.store.listDeliveryMilestones(project.id)
      },
      auth
    );
  }

  assertNoPrivateLeak(payload: unknown) {
    const text = JSON.stringify(payload);
    if (text.includes("privateNotes") || text.includes("internal_proposal")) {
      throw new ForbiddenError("Private founder material cannot be included in a client payload.");
    }
    return stripPrivate(payload as { privateNotes?: FounderNote[] });
  }
}
