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

export type PersistenceAdapter = {
  readonly kind: "sqlite_local" | "memory";
  readonly labeled: true;
  ready(): boolean;
  resetForTests(): void;

  upsertUser(user: User): User;
  getUserById(id: string): User | null;
  getUserByEmail(email: string): User | null;
  listUsers(): User[];

  createSession(session: Session): Session;
  getSession(id: string): Session | null;
  deleteSession(id: string): void;

  createProject(project: Project): Project;
  getProject(id: string): Project | null;
  listProjectsByOwner(ownerId: string): Project[];
  listSubmittedProjects(): Project[];
  updateProject(project: Project): Project;

  createSubmission(submission: Submission): Submission;
  getSubmission(id: string): Submission | null;
  getSubmissionByIdempotency(projectId: string, key: string): Submission | null;
  listSubmissions(projectId: string): Submission[];

  addMessage(message: ChatMessage): ChatMessage;
  listMessages(projectId: string): ChatMessage[];

  addSuggestion(suggestion: Suggestion): Suggestion;
  getSuggestion(id: string): Suggestion | null;
  listSuggestions(projectId: string): Suggestion[];
  updateSuggestion(suggestion: Suggestion): Suggestion;

  addFounderNote(note: FounderNote): FounderNote;
  listFounderNotes(projectId: string): FounderNote[];
  updateFounderNote(note: FounderNote): FounderNote;

  addClientUpdate(update: ClientUpdate): ClientUpdate;
  listClientUpdates(projectId: string): ClientUpdate[];

  addClarificationResponse(response: ClarificationResponse): ClarificationResponse;
  listClarificationResponses(projectId: string): ClarificationResponse[];

  addReviewEvent(event: ReviewEvent): ReviewEvent;
  listReviewEvents(projectId: string): ReviewEvent[];

  putLedger(entry: RequestLedgerEntry): RequestLedgerEntry;
  getLedger(id: string): RequestLedgerEntry | null;

  countAssistantMessagesSince(projectId: string, isoSince: string): number;
};
