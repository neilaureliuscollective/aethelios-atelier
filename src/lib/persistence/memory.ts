import type {
  AuthAccountRecord,
  ChatMessage,
  ClarificationResponse,
  ClientUpdate,
  ContentRequest,
  DeliveryFeedback,
  DeliveryMilestone,
  DeliveryVersion,
  FounderNote,
  Project,
  Proposal,
  ProposalDecision,
  RequestLedgerEntry,
  ReviewEvent,
  Session,
  Submission,
  Suggestion,
  User,
  VerificationTokenRecord
} from "@/lib/types";
import { MemoryCompanionStore } from "@/lib/persistence/companionMemory";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryPersistence implements PersistenceAdapter {
  readonly kind = "memory" as const;
  readonly labeled = true as const;
  readonly companion = new MemoryCompanionStore();

  private users = new Map<string, User>();
  private usersByEmail = new Map<string, string>();
  private sessions = new Map<string, Session>();
  private authAccounts = new Map<string, AuthAccountRecord>();
  private verificationTokens = new Map<string, VerificationTokenRecord>();
  private txChain: Promise<unknown> = Promise.resolve();
  private txDepth = 0;
  private projects = new Map<string, Project>();
  private submissions = new Map<string, Submission>();
  private messages = new Map<string, ChatMessage[]>();
  private suggestions = new Map<string, Suggestion[]>();
  private notes = new Map<string, FounderNote[]>();
  private updates = new Map<string, ClientUpdate[]>();
  private responses = new Map<string, ClarificationResponse[]>();
  private reviews = new Map<string, ReviewEvent[]>();
  private ledger = new Map<string, RequestLedgerEntry>();
  private proposals = new Map<string, Proposal[]>();
  private proposalDecisions = new Map<string, ProposalDecision[]>();
  private deliveryVersions = new Map<string, DeliveryVersion[]>();
  private deliveryFeedback = new Map<string, DeliveryFeedback[]>();
  private contentRequests = new Map<string, ContentRequest[]>();
  private milestones = new Map<string, DeliveryMilestone[]>();

  ready() {
    return true;
  }

  async ping() {}

  async runInTransaction<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.txDepth > 0) return await fn();
    let release!: (value?: unknown) => void;
    const next = new Promise((resolve) => {
      release = resolve;
    });
    const previous = this.txChain;
    this.txChain = next;
    await previous.catch(() => undefined);
    this.txDepth += 1;
    try {
      return await fn();
    } finally {
      this.txDepth -= 1;
      release();
    }
  }

  resetForTests() {
    this.users.clear();
    this.usersByEmail.clear();
    this.sessions.clear();
    this.authAccounts.clear();
    this.verificationTokens.clear();
    this.projects.clear();
    this.submissions.clear();
    this.messages.clear();
    this.suggestions.clear();
    this.notes.clear();
    this.updates.clear();
    this.responses.clear();
    this.reviews.clear();
    this.ledger.clear();
    this.proposals.clear();
    this.proposalDecisions.clear();
    this.deliveryVersions.clear();
    this.deliveryFeedback.clear();
    this.contentRequests.clear();
    this.milestones.clear();
    this.companion.reset();
  }

  listProjectsByBusiness(businessId: string) {
    return [...this.projects.values()].filter((project) => project.businessId === businessId).map(clone);
  }

  upsertUser(user: User) {
    this.users.set(user.id, clone(user));
    this.usersByEmail.set(user.email.toLowerCase(), user.id);
    return clone(user);
  }

  getUserById(id: string) {
    const user = this.users.get(id);
    return user ? clone(user) : null;
  }

  getUserByEmail(email: string) {
    const id = this.usersByEmail.get(email.toLowerCase());
    return id ? this.getUserById(id) : null;
  }

  listUsers() {
    return [...this.users.values()].map(clone);
  }

  createSession(session: Session) {
    this.sessions.set(session.id, clone(session));
    return clone(session);
  }

  getSession(id: string) {
    const session = this.sessions.get(id);
    return session ? clone(session) : null;
  }

  deleteSession(id: string) {
    this.sessions.delete(id);
  }

  updateSession(session: Session) {
    if (!this.sessions.has(session.id)) return null;
    this.sessions.set(session.id, clone(session));
    return clone(session);
  }

  createAuthAccount(account: AuthAccountRecord) {
    this.authAccounts.set(`${account.provider}:${account.providerAccountId}`, clone(account));
    return clone(account);
  }

  getAuthAccount(provider: string, providerAccountId: string) {
    const account = this.authAccounts.get(`${provider}:${providerAccountId}`);
    return account ? clone(account) : null;
  }

  deleteAuthAccount(provider: string, providerAccountId: string) {
    this.authAccounts.delete(`${provider}:${providerAccountId}`);
  }

  createVerificationToken(token: VerificationTokenRecord) {
    const next = { ...token, identifier: token.identifier.toLowerCase() };
    this.verificationTokens.set(`${next.identifier}:${next.token}`, clone(next));
    return clone(next);
  }

  useVerificationToken(identifier: string, token: string) {
    const key = `${identifier.toLowerCase()}:${token}`;
    const existing = this.verificationTokens.get(key);
    if (!existing) return null;
    this.verificationTokens.delete(key);
    return clone(existing);
  }

  createProject(project: Project) {
    this.projects.set(project.id, clone(project));
    return clone(project);
  }

  getProject(id: string) {
    const project = this.projects.get(id);
    return project ? clone(project) : null;
  }

  listProjectsByOwner(ownerId: string) {
    return [...this.projects.values()].filter((project) => project.ownerId === ownerId).map(clone);
  }

  listSubmittedProjects() {
    return [...this.projects.values()]
      .filter((project) => project.status !== "draft")
      .map(clone)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  getProjectByOwnerAndGuestDraft(ownerId: string, guestDraftId: string) {
    const project = [...this.projects.values()].find(
      (item) => item.ownerId === ownerId && item.adoptedFromGuestId === guestDraftId
    );
    return project ? clone(project) : null;
  }

  getSubmissionByIdempotencyKey(key: string) {
    const submission = [...this.submissions.values()].find((item) => item.idempotencyKey === key);
    return submission ? clone(submission) : null;
  }

  updateProject(project: Project) {
    this.projects.set(project.id, clone(project));
    return clone(project);
  }

  createSubmission(submission: Submission) {
    this.submissions.set(submission.id, clone(submission));
    return clone(submission);
  }

  getSubmission(id: string) {
    const submission = this.submissions.get(id);
    return submission ? clone(submission) : null;
  }

  getSubmissionByIdempotency(projectId: string, key: string) {
    return (
      [...this.submissions.values()].find(
        (item) => item.projectId === projectId && item.idempotencyKey === key
      ) ?? null
    );
  }

  listSubmissions(projectId: string) {
    return [...this.submissions.values()]
      .filter((item) => item.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map(clone);
  }

  addMessage(message: ChatMessage) {
    const list = this.messages.get(message.projectId) ?? [];
    list.push(clone(message));
    this.messages.set(message.projectId, list);
    return clone(message);
  }

  listMessages(projectId: string) {
    return (this.messages.get(projectId) ?? []).map(clone);
  }

  addSuggestion(suggestion: Suggestion) {
    const list = this.suggestions.get(suggestion.projectId) ?? [];
    list.push(clone(suggestion));
    this.suggestions.set(suggestion.projectId, list);
    return clone(suggestion);
  }

  getSuggestion(id: string) {
    for (const list of this.suggestions.values()) {
      const found = list.find((item) => item.id === id);
      if (found) return clone(found);
    }
    return null;
  }

  listSuggestions(projectId: string) {
    return (this.suggestions.get(projectId) ?? []).map(clone);
  }

  updateSuggestion(suggestion: Suggestion) {
    const list = this.suggestions.get(suggestion.projectId) ?? [];
    const index = list.findIndex((item) => item.id === suggestion.id);
    if (index >= 0) list[index] = clone(suggestion);
    this.suggestions.set(suggestion.projectId, list);
    return clone(suggestion);
  }

  addFounderNote(note: FounderNote) {
    const list = this.notes.get(note.projectId) ?? [];
    list.push(clone(note));
    this.notes.set(note.projectId, list);
    return clone(note);
  }

  listFounderNotes(projectId: string) {
    return (this.notes.get(projectId) ?? []).map(clone);
  }

  updateFounderNote(note: FounderNote) {
    const list = this.notes.get(note.projectId) ?? [];
    const index = list.findIndex((item) => item.id === note.id);
    if (index >= 0) list[index] = clone(note);
    this.notes.set(note.projectId, list);
    return clone(note);
  }

  addClientUpdate(update: ClientUpdate) {
    const list = this.updates.get(update.projectId) ?? [];
    list.push(clone(update));
    this.updates.set(update.projectId, list);
    return clone(update);
  }

  listClientUpdates(projectId: string) {
    return (this.updates.get(projectId) ?? []).map(clone);
  }

  addClarificationResponse(response: ClarificationResponse) {
    const list = this.responses.get(response.projectId) ?? [];
    list.push(clone(response));
    this.responses.set(response.projectId, list);
    return clone(response);
  }

  listClarificationResponses(projectId: string) {
    return (this.responses.get(projectId) ?? []).map(clone);
  }

  addReviewEvent(event: ReviewEvent) {
    const list = this.reviews.get(event.projectId) ?? [];
    list.push(clone(event));
    this.reviews.set(event.projectId, list);
    return clone(event);
  }

  listReviewEvents(projectId: string) {
    return (this.reviews.get(projectId) ?? []).map(clone);
  }

  putLedger(entry: RequestLedgerEntry) {
    this.ledger.set(entry.id, clone(entry));
    return clone(entry);
  }

  getLedger(id: string) {
    const entry = this.ledger.get(id);
    return entry ? clone(entry) : null;
  }

  countAssistantMessagesSince(projectId: string, isoSince: string) {
    return (this.messages.get(projectId) ?? []).filter(
      (message) => message.authorKind === "assistant" && message.liveAi && message.createdAt >= isoSince
    ).length;
  }

  addProposal(proposal: Proposal) {
    const list = this.proposals.get(proposal.projectId) ?? [];
    list.push(clone(proposal));
    this.proposals.set(proposal.projectId, list);
    return clone(proposal);
  }

  getProposal(id: string) {
    for (const list of this.proposals.values()) {
      const found = list.find((item) => item.id === id);
      if (found) return clone(found);
    }
    return null;
  }

  listProposals(projectId: string) {
    return (this.proposals.get(projectId) ?? [])
      .slice()
      .sort((a, b) => a.version - b.version)
      .map(clone);
  }

  updateProposal(proposal: Proposal) {
    const list = this.proposals.get(proposal.projectId) ?? [];
    const index = list.findIndex((item) => item.id === proposal.id);
    if (index >= 0) list[index] = clone(proposal);
    this.proposals.set(proposal.projectId, list);
    return clone(proposal);
  }

  addProposalDecision(decision: ProposalDecision) {
    const list = this.proposalDecisions.get(decision.projectId) ?? [];
    list.push(clone(decision));
    this.proposalDecisions.set(decision.projectId, list);
    return clone(decision);
  }

  listProposalDecisions(projectId: string) {
    return (this.proposalDecisions.get(projectId) ?? []).map(clone);
  }

  addDeliveryVersion(version: DeliveryVersion) {
    const list = this.deliveryVersions.get(version.projectId) ?? [];
    list.push(clone(version));
    this.deliveryVersions.set(version.projectId, list);
    return clone(version);
  }

  getDeliveryVersion(id: string) {
    for (const list of this.deliveryVersions.values()) {
      const found = list.find((item) => item.id === id);
      if (found) return clone(found);
    }
    return null;
  }

  listDeliveryVersions(projectId: string) {
    return (this.deliveryVersions.get(projectId) ?? [])
      .slice()
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.version - b.version)
      .map(clone);
  }

  updateDeliveryVersion(version: DeliveryVersion) {
    const list = this.deliveryVersions.get(version.projectId) ?? [];
    const index = list.findIndex((item) => item.id === version.id);
    if (index >= 0) list[index] = clone(version);
    this.deliveryVersions.set(version.projectId, list);
    return clone(version);
  }

  addDeliveryFeedback(feedback: DeliveryFeedback) {
    const list = this.deliveryFeedback.get(feedback.projectId) ?? [];
    list.push(clone(feedback));
    this.deliveryFeedback.set(feedback.projectId, list);
    return clone(feedback);
  }

  listDeliveryFeedback(projectId: string) {
    return (this.deliveryFeedback.get(projectId) ?? []).map(clone);
  }

  addContentRequest(request: ContentRequest) {
    const list = this.contentRequests.get(request.projectId) ?? [];
    list.push(clone(request));
    this.contentRequests.set(request.projectId, list);
    return clone(request);
  }

  getContentRequest(id: string) {
    for (const list of this.contentRequests.values()) {
      const found = list.find((item) => item.id === id);
      if (found) return clone(found);
    }
    return null;
  }

  listContentRequests(projectId: string) {
    return (this.contentRequests.get(projectId) ?? []).map(clone);
  }

  updateContentRequest(request: ContentRequest) {
    const list = this.contentRequests.get(request.projectId) ?? [];
    const index = list.findIndex((item) => item.id === request.id);
    if (index >= 0) list[index] = clone(request);
    this.contentRequests.set(request.projectId, list);
    return clone(request);
  }

  addDeliveryMilestone(milestone: DeliveryMilestone) {
    const list = this.milestones.get(milestone.projectId) ?? [];
    list.push(clone(milestone));
    this.milestones.set(milestone.projectId, list);
    return clone(milestone);
  }

  listDeliveryMilestones(projectId: string) {
    return (this.milestones.get(projectId) ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(clone);
  }

  updateDeliveryMilestone(milestone: DeliveryMilestone) {
    const list = this.milestones.get(milestone.projectId) ?? [];
    const index = list.findIndex((item) => item.id === milestone.id);
    if (index >= 0) list[index] = clone(milestone);
    this.milestones.set(milestone.projectId, list);
    return clone(milestone);
  }
}
