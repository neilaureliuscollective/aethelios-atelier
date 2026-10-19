import type {
  Brief,
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
import { normalizeBrief } from "@/lib/brief";
import { normalizeProposalScope } from "@/lib/domain/proposal";

export type Row = Record<string, unknown>;

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function asString(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

export function asOptionalString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  return String(value);
}

export function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

export function asFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "t" || value === "true";
}

export function mapUser(row: Row): User {
  return {
    id: asString(row.id),
    email: asString(row.email),
    displayName: asString(row.display_name),
    role: row.role as User["role"],
    adapter: "simulated",
    createdAt: asString(row.created_at)
  };
}

export function mapSession(row: Row): Session | null {
  if (!row.id || !row.user_id || !row.created_at || !row.expires_at) return null;
  return {
    id: asString(row.id),
    userId: asString(row.user_id),
    createdAt: asString(row.created_at),
    expiresAt: asString(row.expires_at)
  };
}

export function mapProject(row: Row): Project {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    title: asString(row.title),
    status: row.status as Project["status"],
    brief: normalizeBrief(parseJson<Brief>(asString(row.brief_json))),
    version: asNumber(row.version),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    adoptedFromGuestId: asOptionalString(row.adopted_from_guest_id),
    latestSubmissionId: asOptionalString(row.latest_submission_id)
  };
}

export function mapSubmission(row: Row): Submission {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    ownerId: asString(row.owner_id),
    snapshot: normalizeBrief(parseJson<Brief>(asString(row.snapshot_json))),
    title: asString(row.title),
    consentText: asString(row.consent_text),
    consentedAt: asString(row.consented_at),
    receiptId: asString(row.receipt_id),
    idempotencyKey: asString(row.idempotency_key),
    createdAt: asString(row.created_at),
    reviewedVersion: asNumber(row.reviewed_version),
    payloadHash: asString(row.payload_hash)
  };
}

export function mapMessage(row: Row): ChatMessage {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    authorKind: row.author_kind as ChatMessage["authorKind"],
    body: asString(row.body),
    liveAi: asFlag(row.live_ai),
    createdAt: asString(row.created_at),
    metadata: row.metadata_json ? parseJson(asString(row.metadata_json)) : undefined
  };
}

export function mapSuggestion(row: Row): Suggestion {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    fieldKey: row.field_key as Suggestion["fieldKey"],
    proposedValue: asString(row.proposed_value),
    rationale: asOptionalString(row.rationale),
    status: row.status as Suggestion["status"],
    createdAt: asString(row.created_at),
    resolvedAt: asOptionalString(row.resolved_at)
  };
}

export function mapNote(row: Row): FounderNote {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    founderId: asString(row.founder_id),
    body: asString(row.body),
    kind: row.kind as FounderNote["kind"],
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    version: asNumber(row.version)
  };
}

export function mapUpdate(row: Row): ClientUpdate {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    founderId: asString(row.founder_id),
    kind: row.kind as ClientUpdate["kind"],
    body: asString(row.body),
    requiresResponse: asFlag(row.requires_response),
    createdAt: asString(row.created_at)
  };
}

export function mapResponse(row: Row): ClarificationResponse {
  return {
    id: asString(row.id),
    updateId: asString(row.update_id),
    projectId: asString(row.project_id),
    authorId: asString(row.author_id),
    body: asString(row.body),
    createdAt: asString(row.created_at)
  };
}

export function mapReview(row: Row): ReviewEvent {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    founderId: asString(row.founder_id),
    kind: "review_started",
    createdAt: asString(row.created_at)
  };
}

export function mapLedger(row: Row): RequestLedgerEntry {
  return {
    id: asString(row.id),
    ownerId: asString(row.owner_id),
    projectId: asOptionalString(row.project_id),
    operation: asString(row.operation),
    payloadHash: asString(row.payload_hash),
    status: row.status as RequestLedgerEntry["status"],
    resultJson: asOptionalString(row.result_json),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };
}

export function mapProposal(row: Row): Proposal {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    founderId: asString(row.founder_id),
    version: asNumber(row.version),
    status: row.status as Proposal["status"],
    scope: normalizeProposalScope(parseJson(asString(row.scope_json, "{}"))),
    changeSummary: asString(row.change_summary),
    basedOnSubmissionId: asOptionalString(row.based_on_submission_id),
    supersedesProposalId: asOptionalString(row.supersedes_proposal_id),
    payloadHash: asString(row.payload_hash),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    publishedAt: asOptionalString(row.published_at)
  };
}

export function mapProposalDecision(row: Row): ProposalDecision {
  return {
    id: asString(row.id),
    proposalId: asString(row.proposal_id),
    projectId: asString(row.project_id),
    authorId: asString(row.author_id),
    kind: row.kind as ProposalDecision["kind"],
    body: asString(row.body),
    agreementText: asOptionalString(row.agreement_text),
    agreedVersion: asNumber(row.agreed_version),
    createdAt: asString(row.created_at)
  };
}

export function mapDeliveryVersion(row: Row): DeliveryVersion {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    founderId: asString(row.founder_id),
    kind: row.kind as DeliveryVersion["kind"],
    version: asNumber(row.version),
    title: asString(row.title),
    summary: asString(row.summary),
    previewUrl: asOptionalString(row.preview_url),
    notes: asString(row.notes),
    status: row.status as DeliveryVersion["status"],
    payloadHash: asString(row.payload_hash),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    publishedAt: asOptionalString(row.published_at)
  };
}

export function mapDeliveryFeedback(row: Row): DeliveryFeedback {
  return {
    id: asString(row.id),
    deliveryVersionId: asString(row.delivery_version_id),
    projectId: asString(row.project_id),
    authorId: asString(row.author_id),
    authorKind: row.author_kind as DeliveryFeedback["authorKind"],
    kind: row.kind as DeliveryFeedback["kind"],
    body: asString(row.body),
    expectedVersion: asNumber(row.expected_version),
    createdAt: asString(row.created_at)
  };
}

export function mapContentRequest(row: Row): ContentRequest {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    founderId: asString(row.founder_id),
    title: asString(row.title),
    detail: asString(row.detail),
    status: row.status as ContentRequest["status"],
    response: asOptionalString(row.response),
    createdAt: asString(row.created_at),
    resolvedAt: asOptionalString(row.resolved_at)
  };
}

export function mapDeliveryMilestone(row: Row): DeliveryMilestone {
  return {
    id: asString(row.id),
    projectId: asString(row.project_id),
    proposalId: asString(row.proposal_id),
    title: asString(row.title),
    description: asString(row.description),
    timing: asOptionalString(row.timing),
    sortOrder: asNumber(row.sort_order),
    status: row.status as DeliveryMilestone["status"],
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at)
  };
}
