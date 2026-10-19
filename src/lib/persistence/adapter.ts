import type {
  AuthAccountRecord,
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
  User,
  VerificationTokenRecord
} from "@/lib/types";

export type PersistenceKind = "sqlite_local" | "memory" | "postgres";

export type MaybePromise<T> = T | Promise<T>;

export type PersistenceAdapter = {
  readonly kind: PersistenceKind;
  readonly labeled: true;
  ready(): boolean;
  ping(): MaybePromise<void>;
  resetForTests(): MaybePromise<void>;
  runInTransaction<T>(fn: () => MaybePromise<T>): Promise<T>;

  upsertUser(user: User): MaybePromise<User>;
  getUserById(id: string): MaybePromise<User | null>;
  getUserByEmail(email: string): MaybePromise<User | null>;
  listUsers(): MaybePromise<User[]>;

  createSession(session: Session): MaybePromise<Session>;
  getSession(id: string): MaybePromise<Session | null>;
  updateSession(session: Session): MaybePromise<Session | null>;
  deleteSession(id: string): MaybePromise<void>;

  createAuthAccount(account: AuthAccountRecord): MaybePromise<AuthAccountRecord>;
  getAuthAccount(provider: string, providerAccountId: string): MaybePromise<AuthAccountRecord | null>;
  deleteAuthAccount(provider: string, providerAccountId: string): MaybePromise<void>;

  createVerificationToken(token: VerificationTokenRecord): MaybePromise<VerificationTokenRecord>;
  useVerificationToken(identifier: string, token: string): MaybePromise<VerificationTokenRecord | null>;

  createProject(project: Project): MaybePromise<Project>;
  getProject(id: string): MaybePromise<Project | null>;
  listProjectsByOwner(ownerId: string): MaybePromise<Project[]>;
  listSubmittedProjects(): MaybePromise<Project[]>;
  getProjectByOwnerAndGuestDraft(ownerId: string, guestDraftId: string): MaybePromise<Project | null>;
  updateProject(project: Project): MaybePromise<Project>;
  getSubmissionByIdempotencyKey(key: string): MaybePromise<Submission | null>;

  createSubmission(submission: Submission): MaybePromise<Submission>;
  getSubmission(id: string): MaybePromise<Submission | null>;
  getSubmissionByIdempotency(projectId: string, key: string): MaybePromise<Submission | null>;
  listSubmissions(projectId: string): MaybePromise<Submission[]>;

  addMessage(message: ChatMessage): MaybePromise<ChatMessage>;
  listMessages(projectId: string): MaybePromise<ChatMessage[]>;

  addSuggestion(suggestion: Suggestion): MaybePromise<Suggestion>;
  getSuggestion(id: string): MaybePromise<Suggestion | null>;
  listSuggestions(projectId: string): MaybePromise<Suggestion[]>;
  updateSuggestion(suggestion: Suggestion): MaybePromise<Suggestion>;

  addFounderNote(note: FounderNote): MaybePromise<FounderNote>;
  listFounderNotes(projectId: string): MaybePromise<FounderNote[]>;
  updateFounderNote(note: FounderNote): MaybePromise<FounderNote>;

  addClientUpdate(update: ClientUpdate): MaybePromise<ClientUpdate>;
  listClientUpdates(projectId: string): MaybePromise<ClientUpdate[]>;

  addClarificationResponse(response: ClarificationResponse): MaybePromise<ClarificationResponse>;
  listClarificationResponses(projectId: string): MaybePromise<ClarificationResponse[]>;

  addReviewEvent(event: ReviewEvent): MaybePromise<ReviewEvent>;
  listReviewEvents(projectId: string): MaybePromise<ReviewEvent[]>;

  putLedger(entry: RequestLedgerEntry): MaybePromise<RequestLedgerEntry>;
  getLedger(id: string): MaybePromise<RequestLedgerEntry | null>;

  countAssistantMessagesSince(projectId: string, isoSince: string): MaybePromise<number>;
};
