import type {
  ChatMessage,
  ClarificationResponse,
  ClientUpdate,
  FounderNote,
  Project,
  RequestLedgerEntry,
  ReviewEvent,
  Session,
  Submission,
  Suggestion,
  User
} from "@/lib/types";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryPersistence implements PersistenceAdapter {
  readonly kind = "memory" as const;
  readonly labeled = true as const;

  private users = new Map<string, User>();
  private usersByEmail = new Map<string, string>();
  private sessions = new Map<string, Session>();
  private projects = new Map<string, Project>();
  private submissions = new Map<string, Submission>();
  private messages = new Map<string, ChatMessage[]>();
  private suggestions = new Map<string, Suggestion[]>();
  private notes = new Map<string, FounderNote[]>();
  private updates = new Map<string, ClientUpdate[]>();
  private responses = new Map<string, ClarificationResponse[]>();
  private reviews = new Map<string, ReviewEvent[]>();
  private ledger = new Map<string, RequestLedgerEntry>();

  ready() {
    return true;
  }

  runInTransaction<T>(fn: () => T): T {
    return fn();
  }

  resetForTests() {
    this.users.clear();
    this.usersByEmail.clear();
    this.sessions.clear();
    this.projects.clear();
    this.submissions.clear();
    this.messages.clear();
    this.suggestions.clear();
    this.notes.clear();
    this.updates.clear();
    this.responses.clear();
    this.reviews.clear();
    this.ledger.clear();
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
}
