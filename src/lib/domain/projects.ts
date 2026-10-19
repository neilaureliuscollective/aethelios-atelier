import "server-only";
import { briefTitle, createEmptyBrief, normalizeBrief } from "@/lib/brief";
import { CONSENT_TEXT } from "@/lib/copy";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/domain/errors";
import { toClientView } from "@/lib/domain/next-step";
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
  FounderNote,
  FounderProjectView,
  GuestDraft,
  Project,
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

  createProject(owner: User, brief?: Brief, guestDraftId?: string) {
    const normalized = normalizeBrief(brief ?? createEmptyBrief());
    const stamp = now();
    const project: Project = {
      id: createId("prj"),
      ownerId: owner.id,
      title: briefTitle(normalized),
      status: "draft",
      brief: normalized,
      version: 1,
      createdAt: stamp,
      updatedAt: stamp,
      adoptedFromGuestId: guestDraftId
    };
    return this.store.createProject(project);
  }

  adoptGuestDraft(owner: User, draft: GuestDraft, confirmed: boolean) {
    if (!confirmed) {
      throw new ForbiddenError("Guest drafts are not adopted until you confirm the review.");
    }
    if (draft.kind !== "guest_draft") {
      throw new ForbiddenError("Only labeled guest drafts can be adopted.");
    }
    const existing = this.store.getProjectByOwnerAndGuestDraft(owner.id, draft.draftId);
    if (existing) return existing;
    const project = this.createProject(owner, draft.brief, draft.draftId);
    for (const message of draft.messages) {
      this.store.addMessage({
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
  }

  listForOwner(user: User) {
    return this.store.listProjectsByOwner(user.id);
  }

  getOwnedProject(id: string, user: User) {
    const project = this.store.getProject(id);
    if (!project) throw new NotFoundError("Project not found.");
    assertOwner(project, user);
    return project;
  }

  clientView(id: string, user: User): ClientProjectView {
    const project = this.getOwnedProject(id, user);
    return this.buildClientView(project, { user, session: { id: "", userId: user.id, createdAt: "", expiresAt: "" }, adapter: "simulated" });
  }

  founderView(id: string, founder: User): FounderProjectView {
    assertFounder(founder);
    const project = this.store.getProject(id);
    if (!project) throw new NotFoundError("Project not found.");
    const owner = this.store.getUserById(project.ownerId);
    if (!owner) throw new NotFoundError("Owner not found.");
    const base = this.buildClientView(project, null);
    return {
      ...base,
      privateNotes: this.store.listFounderNotes(project.id),
      owner: {
        id: owner.id,
        email: owner.email,
        displayName: owner.displayName,
        adapter: owner.adapter
      }
    };
  }

  founderQueue(founder: User) {
    assertFounder(founder);
    return this.store.listSubmittedProjects().map((project) => {
      const owner = this.store.getUserById(project.ownerId);
      const reviews = this.store.listReviewEvents(project.id);
      return {
        id: project.id,
        title: briefTitle(project.brief),
        status: project.status,
        updatedAt: project.updatedAt,
        reviewStartedAt: reviews[0]?.createdAt ?? null,
        owner: owner
          ? { id: owner.id, email: owner.email, displayName: owner.displayName, adapter: owner.adapter }
          : null
      };
    });
  }

  saveBrief(
    projectId: string,
    user: User,
    brief: Brief,
    expectedVersion: number,
    localGeneration?: number
  ) {
    const project = this.getOwnedProject(projectId, user);
    if (project.version !== expectedVersion) {
      throw new ConflictError(
        "The saved brief is newer than this edit. Your latest typing was not overwritten.",
        project.version
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
    const saved = this.store.updateProject(next);
    return { project: saved, appliedLocalGeneration: localGeneration ?? null };
  }

  submit(
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
    const project = this.getOwnedProject(projectId, user);
    const ledgerId = `${user.id}:${idempotencyKey}`;
    const prior = this.store.getLedger(ledgerId);
    if (prior?.ownerId && prior.ownerId !== user.id) {
      throw new ForbiddenError("This retry belongs to another account.");
    }
    if (prior?.projectId && prior.projectId !== projectId) {
      throw new ConflictError("This retry key is bound to a different commission.");
    }

    const existing =
      this.store.getSubmissionByIdempotency(projectId, idempotencyKey) ??
      this.store.getSubmissionByIdempotencyKey(idempotencyKey);
    if (existing) {
      if (existing.ownerId !== user.id) {
        throw new ForbiddenError("This retry belongs to another account.");
      }
      if (existing.projectId !== projectId) {
        throw new ConflictError("This retry key is bound to a different commission.");
      }
      const readBack = this.store.getSubmission(existing.id);
      if (!readBack?.receiptId) {
        throw new ConflictError("A receipt could not be independently read back.");
      }
      return { submission: readBack, duplicate: true as const };
    }

    if (project.version !== expectedVersion) {
      throw new ConflictError(
        "This consent applies to a different saved revision. Save the brief, review it, and send that exact version.",
        project.version
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

    return this.store.runInTransaction(() => {
      const insideExisting = this.store.getSubmissionByIdempotency(projectId, idempotencyKey);
      if (insideExisting) {
        return { submission: insideExisting, duplicate: true as const };
      }
      const current = this.getOwnedProject(projectId, user);
      if (current.version !== expectedVersion) {
        throw new ConflictError(
          "This consent applies to a different saved revision. Save the brief, review it, and send that exact version.",
          current.version
        );
      }
      this.store.putLedger({
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
      const created = this.store.createSubmission({
        id: createId("sub"),
        projectId: current.id,
        ownerId: user.id,
        snapshot,
        title: current.title,
        consentText: CONSENT_TEXT,
        consentedAt: stamp,
        receiptId: createReceiptId(),
        idempotencyKey,
        createdAt: stamp
      });
      this.store.updateProject({
        ...current,
        status: current.status === "draft" ? "submitted" : current.status,
        latestSubmissionId: created.id,
        updatedAt: stamp
      });
      const readBack = this.store.getSubmission(created.id);
      if (!readBack?.receiptId) {
        throw new ConflictError("Submission stored but the receipt could not be independently confirmed.");
      }
      this.store.putLedger({
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

  markUncertain(ownerId: string, idempotencyKey: string, projectId: string, operation: string) {
    const ledgerId = `${ownerId}:${idempotencyKey}`;
    const prior = this.store.getLedger(ledgerId);
    this.store.putLedger({
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

  addClientMessage(projectId: string, user: User, body: string) {
    this.getOwnedProject(projectId, user);
    return this.store.addMessage({
      id: createId("msg"),
      projectId,
      authorKind: "client",
      body,
      liveAi: false,
      createdAt: now()
    });
  }

  addSystemMessage(projectId: string, body: string, liveAi = false, metadata?: ChatMessage["metadata"]) {
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

  proposeSuggestion(
    projectId: string,
    fieldKey: BriefFieldKey,
    proposedValue: string,
    rationale?: string
  ) {
    const project = this.store.getProject(projectId);
    if (!project) throw new NotFoundError();
    const suggestion = this.store.addSuggestion({
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
    this.store.updateProject({ ...project, brief, updatedAt: now() });
    return suggestion;
  }

  resolveSuggestion(
    projectId: string,
    suggestionId: string,
    user: User,
    action: "accept" | "reject" | "edit",
    editedValue?: string
  ) {
    const project = this.getOwnedProject(projectId, user);
    const suggestion = this.store.getSuggestion(suggestionId);
    if (!suggestion || suggestion.projectId !== projectId) {
      throw new NotFoundError("Suggestion not found.");
    }
    const stamp = now();
    const nextStatus = action === "accept" ? "accepted" : action === "reject" ? "rejected" : "edited";
    const updated: Suggestion = { ...suggestion, status: nextStatus, resolvedAt: stamp };
    this.store.updateSuggestion(updated);
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
    this.store.updateProject({
      ...project,
      brief,
      title: briefTitle(brief),
      version: project.version + 1,
      updatedAt: stamp
    });
    return updated;
  }

  startReview(projectId: string, founder: User) {
    assertFounder(founder);
    const project = this.store.getProject(projectId);
    if (!project) throw new NotFoundError();
    if (!project.latestSubmissionId) {
      throw new ForbiddenError("Review can begin only after a submitted snapshot exists.");
    }
    const existing = this.store.listReviewEvents(projectId);
    if (existing.length) return existing[0]!;
    const event = this.store.addReviewEvent({
      id: createId("rev"),
      projectId,
      founderId: founder.id,
      kind: "review_started",
      createdAt: now()
    });
    this.store.updateProject({
      ...project,
      status: "founder_reviewing",
      updatedAt: now()
    });
    return event;
  }

  addPrivateNote(
    projectId: string,
    founder: User,
    body: string,
    kind: FounderNote["kind"] = "private_note"
  ) {
    assertFounder(founder);
    const project = this.store.getProject(projectId);
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

  publishUpdate(
    projectId: string,
    founder: User,
    kind: ClientUpdateKind,
    body: string,
    requiresResponse?: boolean
  ) {
    assertFounder(founder);
    const project = this.store.getProject(projectId);
    if (!project) throw new NotFoundError();
    const update = this.store.addClientUpdate({
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
    this.store.updateProject({ ...project, status, updatedAt: now() });
    return update;
  }

  respondToClarification(projectId: string, user: User, updateId: string, body: string) {
    const project = this.getOwnedProject(projectId, user);
    const update = this.store.listClientUpdates(projectId).find((item) => item.id === updateId);
    if (!update || update.kind !== "clarification") {
      throw new NotFoundError("Clarification not found.");
    }
    const response = this.store.addClarificationResponse({
      id: createId("clr"),
      updateId,
      projectId,
      authorId: user.id,
      body,
      createdAt: now()
    });
    if (project.status === "clarification_requested") {
      const reviews = this.store.listReviewEvents(projectId);
      this.store.updateProject({
        ...project,
        status: reviews.length ? "founder_reviewing" : "submitted",
        updatedAt: now()
      });
    }
    return response;
  }

  private buildClientView(project: Project, auth: AuthContext | null): ClientProjectView {
    const submission = project.latestSubmissionId
      ? this.store.getSubmission(project.latestSubmissionId)
      : this.store.listSubmissions(project.id).at(-1) ?? null;
    const reviews = this.store.listReviewEvents(project.id);
    return toClientView(
      {
        project,
        suggestions: this.store.listSuggestions(project.id),
        messages: this.store.listMessages(project.id),
        updates: this.store.listClientUpdates(project.id),
        clarificationResponses: this.store.listClarificationResponses(project.id),
        submission,
        reviewStartedAt: reviews[0]?.createdAt ?? null
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
