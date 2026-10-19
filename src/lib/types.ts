export const PROJECT_TYPES = [
  "website",
  "booking_connected_website",
  "digital_infrastructure",
  "undecided"
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const BRIEF_FIELD_KEYS = [
  "vision",
  "projectType",
  "audience",
  "existingWebsite",
  "bookingProvider",
  "goals",
  "references",
  "priorities",
  "timing",
  "budget",
  "constraints"
] as const;

export type BriefFieldKey = (typeof BRIEF_FIELD_KEYS)[number];

export const FIELD_PROVENANCE = [
  "empty",
  "client_statement",
  "ai_suggestion_pending",
  "ai_suggestion_accepted",
  "ai_suggestion_edited",
  "unresolved",
  "founder_decision"
] as const;

export type FieldProvenance = (typeof FIELD_PROVENANCE)[number];

export type BriefField = {
  key: BriefFieldKey;
  value: string;
  provenance: FieldProvenance;
  unresolvedQuestion?: string;
  pendingSuggestionId?: string;
};

export type Brief = Record<BriefFieldKey, BriefField>;

export const PROJECT_STATUSES = [
  "draft",
  "submitted",
  "clarification_requested",
  "founder_reviewing",
  "decision_published"
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type Role = "client" | "founder";

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  adapter: "simulated";
  createdAt: string;
};

export type Session = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type AuthContext = {
  user: User;
  session: Session;
  adapter: "simulated";
};

export type SuggestionStatus = "pending" | "accepted" | "rejected" | "edited";

export type Suggestion = {
  id: string;
  projectId: string;
  fieldKey: BriefFieldKey;
  proposedValue: string;
  rationale?: string;
  status: SuggestionStatus;
  createdAt: string;
  resolvedAt?: string;
};

export type MessageAuthor = "client" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  projectId: string;
  authorKind: MessageAuthor;
  body: string;
  liveAi: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type Submission = {
  id: string;
  projectId: string;
  ownerId: string;
  snapshot: Brief;
  title: string;
  consentText: string;
  consentedAt: string;
  receiptId: string;
  idempotencyKey: string;
  createdAt: string;
};

export type FounderNote = {
  id: string;
  projectId: string;
  founderId: string;
  body: string;
  kind: "private_note" | "internal_proposal";
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ClientUpdateKind = "clarification" | "progress_note" | "decision";

export type ClientUpdate = {
  id: string;
  projectId: string;
  founderId: string;
  kind: ClientUpdateKind;
  body: string;
  requiresResponse: boolean;
  createdAt: string;
};

export type ClarificationResponse = {
  id: string;
  updateId: string;
  projectId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type ReviewEvent = {
  id: string;
  projectId: string;
  founderId: string;
  kind: "review_started";
  createdAt: string;
};

export type Project = {
  id: string;
  ownerId: string;
  title: string;
  status: ProjectStatus;
  brief: Brief;
  version: number;
  createdAt: string;
  updatedAt: string;
  adoptedFromGuestId?: string;
  latestSubmissionId?: string;
};

export type ClientProjectView = {
  project: Project;
  suggestions: Suggestion[];
  messages: ChatMessage[];
  updates: ClientUpdate[];
  clarificationResponses: ClarificationResponse[];
  submission: Submission | null;
  reviewStartedAt: string | null;
  nextStep: NextStep;
};

export type FounderProjectView = ClientProjectView & {
  privateNotes: FounderNote[];
  owner: Pick<User, "id" | "email" | "displayName" | "adapter">;
};

export type NextStep = {
  code:
    | "continue_draft"
    | "sign_in_to_submit"
    | "awaiting_founder_receipt"
    | "respond_to_clarification"
    | "founder_is_reviewing"
    | "read_founder_update";
  label: string;
  detail: string;
};

export type RequestLedgerEntry = {
  id: string;
  ownerId: string;
  projectId?: string;
  operation: string;
  payloadHash: string;
  status: "in_flight" | "confirmed" | "failed" | "uncertain";
  resultJson?: string;
  createdAt: string;
  updatedAt: string;
};

export type GuestDraft = {
  version: 1;
  kind: "guest_draft";
  labeled: true;
  limitations: string[];
  draftId: string;
  title: string;
  brief: Brief;
  messages: Array<Pick<ChatMessage, "id" | "authorKind" | "body" | "liveAi" | "createdAt">>;
  updatedAt: string;
  retainedAfterAdoption?: {
    serverProjectId: string;
    savedAt: string;
  };
};

export type ServiceOfferStatus = "offered" | "exploratory";

export type ServiceOffer = {
  id: ProjectType;
  status: ServiceOfferStatus;
  title: string;
  summary: string;
  includes: string[];
  excludes: string[];
};

export type ConnectionState =
  | { ready: true; adapter: string }
  | { ready: false; missing: string; message: string };
