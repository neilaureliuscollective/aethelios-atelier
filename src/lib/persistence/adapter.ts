import type { CompanionStore } from "@/lib/persistence/companionStore";
import type {
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
  User
} from "@/lib/types";

export type PersistenceKind = "sqlite_local" | "memory" | "postgres";

export type MaybePromise<T> = T | Promise<T>;

export type PersistenceAdapter = {
  readonly kind: PersistenceKind;
  readonly labeled: true;
  readonly companion: CompanionStore;
  ready(): boolean;
  ping(): MaybePromise<void>;
  resetForTests(): MaybePromise<void>;
  runInTransaction<T>(fn: () => MaybePromise<T>): Promise<T>;
  listProjectsByBusiness(businessId: string): MaybePromise<Project[]>;

  upsertUser(user: User): MaybePromise<User>;
  getUserById(id: string): MaybePromise<User | null>;
  getUserByEmail(email: string): MaybePromise<User | null>;
  listUsers(): MaybePromise<User[]>;

  createSession(session: Session): MaybePromise<Session>;
  getSession(id: string): MaybePromise<Session | null>;
  deleteSession(id: string): MaybePromise<void>;

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

  addProposal(proposal: Proposal): MaybePromise<Proposal>;
  getProposal(id: string): MaybePromise<Proposal | null>;
  listProposals(projectId: string): MaybePromise<Proposal[]>;
  updateProposal(proposal: Proposal): MaybePromise<Proposal>;

  addProposalDecision(decision: ProposalDecision): MaybePromise<ProposalDecision>;
  listProposalDecisions(projectId: string): MaybePromise<ProposalDecision[]>;

  addDeliveryVersion(version: DeliveryVersion): MaybePromise<DeliveryVersion>;
  getDeliveryVersion(id: string): MaybePromise<DeliveryVersion | null>;
  listDeliveryVersions(projectId: string): MaybePromise<DeliveryVersion[]>;
  updateDeliveryVersion(version: DeliveryVersion): MaybePromise<DeliveryVersion>;

  addDeliveryFeedback(feedback: DeliveryFeedback): MaybePromise<DeliveryFeedback>;
  listDeliveryFeedback(projectId: string): MaybePromise<DeliveryFeedback[]>;

  addContentRequest(request: ContentRequest): MaybePromise<ContentRequest>;
  getContentRequest(id: string): MaybePromise<ContentRequest | null>;
  listContentRequests(projectId: string): MaybePromise<ContentRequest[]>;
  updateContentRequest(request: ContentRequest): MaybePromise<ContentRequest>;

  addDeliveryMilestone(milestone: DeliveryMilestone): MaybePromise<DeliveryMilestone>;
  listDeliveryMilestones(projectId: string): MaybePromise<DeliveryMilestone[]>;
  updateDeliveryMilestone(milestone: DeliveryMilestone): MaybePromise<DeliveryMilestone>;

  countAssistantMessagesSince(projectId: string, isoSince: string): MaybePromise<number>;
};
