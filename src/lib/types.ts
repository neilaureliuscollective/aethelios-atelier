export const PROJECT_TYPES = [
  "website",
  "custom_apps_platforms",
  "ecommerce_storefronts",
  "digital_infrastructure",
  "undecided",
  "booking_connected_website"
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
  "decision_published",
  "proposal_ready",
  "proposal_changes_requested",
  "scope_confirmed",
  "delivery_review"
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type Role = "client" | "founder";

export type AuthAdapterKind = "simulated" | "authjs";

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  adapter: AuthAdapterKind;
  createdAt: string;
  emailVerifiedAt?: string;
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
  adapter: AuthAdapterKind;
};

export type AuthAccountRecord = {
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string | null;
  access_token?: string | null;
  expires_at?: number | null;
  token_type?: string | null;
  scope?: string | null;
  id_token?: string | null;
  session_state?: string | null;
};

export type VerificationTokenRecord = {
  identifier: string;
  token: string;
  expires: string;
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
  reviewedVersion: number;
  payloadHash: string;
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
  businessId?: string;
};

export const PROPOSAL_STATUSES = [
  "draft",
  "published",
  "superseded",
  "changes_requested",
  "approved"
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type ProposalMilestone = {
  title: string;
  description: string;
  timing?: string;
};

export type ProposalPrice = {
  amount: string;
  currency: "USD";
  terms: string;
  paymentStatus: "not_collected";
};

export type ProposalScope = {
  summary: string;
  deliverables: string[];
  includedPages: string[];
  includedFeatures: string[];
  exclusions: string[];
  clientResponsibilities: string[];
  milestones: ProposalMilestone[];
  price: ProposalPrice;
  brandDirection: string;
};

export type Proposal = {
  id: string;
  projectId: string;
  founderId: string;
  version: number;
  status: ProposalStatus;
  scope: ProposalScope;
  changeSummary: string;
  basedOnSubmissionId?: string;
  supersedesProposalId?: string;
  payloadHash: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type ProposalDecisionKind = "approve" | "request_changes";

export type ProposalDecision = {
  id: string;
  proposalId: string;
  projectId: string;
  authorId: string;
  kind: ProposalDecisionKind;
  body: string;
  agreementText?: string;
  agreedVersion: number;
  createdAt: string;
};

export const DELIVERY_VERSION_KINDS = ["design", "build"] as const;
export type DeliveryVersionKind = (typeof DELIVERY_VERSION_KINDS)[number];

export const DELIVERY_VERSION_STATUSES = [
  "draft",
  "awaiting_review",
  "changes_requested",
  "approved",
  "superseded"
] as const;
export type DeliveryVersionStatus = (typeof DELIVERY_VERSION_STATUSES)[number];

export type DeliveryVersion = {
  id: string;
  projectId: string;
  founderId: string;
  kind: DeliveryVersionKind;
  version: number;
  title: string;
  summary: string;
  previewUrl?: string;
  notes: string;
  status: DeliveryVersionStatus;
  payloadHash: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
};

export type DeliveryFeedbackKind = "comment" | "request_changes" | "approve";

export type DeliveryFeedback = {
  id: string;
  deliveryVersionId: string;
  projectId: string;
  authorId: string;
  authorKind: "client" | "founder";
  kind: DeliveryFeedbackKind;
  body: string;
  expectedVersion: number;
  createdAt: string;
};

export const CONTENT_REQUEST_STATUSES = ["requested", "provided", "waived"] as const;
export type ContentRequestStatus = (typeof CONTENT_REQUEST_STATUSES)[number];

export type ContentRequest = {
  id: string;
  projectId: string;
  founderId: string;
  title: string;
  detail: string;
  status: ContentRequestStatus;
  response?: string;
  createdAt: string;
  resolvedAt?: string;
};

export const MILESTONE_STATUSES = ["upcoming", "current", "waiting_on_client", "complete"] as const;
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export type DeliveryMilestone = {
  id: string;
  projectId: string;
  proposalId: string;
  title: string;
  description: string;
  timing?: string;
  sortOrder: number;
  status: MilestoneStatus;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryHandoff = {
  generatedAt: string;
  projectId: string;
  title: string;
  confirmedProposalId: string | null;
  confirmedProposalVersion: number | null;
  markdown: string;
};

export type FounderAttentionCode =
  | "awaiting_review_start"
  | "open_clarification"
  | "awaiting_proposal_response"
  | "requested_revision"
  | "missing_client_content"
  | "awaiting_delivery_review"
  | "next_milestone";

export type FounderAttentionItem = {
  code: FounderAttentionCode;
  label: string;
  detail: string;
};

export type FounderQueueItem = {
  id: string;
  title: string;
  status: ProjectStatus;
  updatedAt: string;
  reviewStartedAt: string | null;
  owner: Pick<User, "id" | "email" | "displayName" | "adapter"> | null;
  attention: FounderAttentionItem[];
  currentProposalVersion: number | null;
  confirmedProposalVersion: number | null;
  nextMilestone: string | null;
};

export type ClientProjectView = {
  project: Project;
  suggestions: Suggestion[];
  messages: ChatMessage[];
  updates: ClientUpdate[];
  clarificationResponses: ClarificationResponse[];
  submission: Submission | null;
  reviewStartedAt: string | null;
  proposals: Proposal[];
  proposalDecisions: ProposalDecision[];
  deliveryVersions: DeliveryVersion[];
  deliveryFeedback: DeliveryFeedback[];
  contentRequests: ContentRequest[];
  milestones: DeliveryMilestone[];
  nextStep: NextStep;
};

export type FounderProjectView = ClientProjectView & {
  privateNotes: FounderNote[];
  owner: Pick<User, "id" | "email" | "displayName" | "adapter">;
  handoff: DeliveryHandoff | null;
};

export type NextStep = {
  code:
    | "continue_draft"
    | "sign_in_to_submit"
    | "awaiting_founder_receipt"
    | "respond_to_clarification"
    | "founder_is_reviewing"
    | "read_founder_update"
    | "review_proposal"
    | "proposal_revision_in_progress"
    | "provide_client_content"
    | "review_delivery_version"
    | "read_confirmed_scope";
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
