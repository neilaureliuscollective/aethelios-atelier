import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import postgres, { type Sql, type TransactionSql } from "postgres";
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
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import {
  mapContentRequest,
  mapDeliveryFeedback,
  mapDeliveryMilestone,
  mapDeliveryVersion,
  mapLedger,
  mapMessage,
  mapNote,
  mapProject,
  mapProposal,
  mapProposalDecision,
  mapResponse,
  mapReview,
  mapSession,
  mapSubmission,
  mapSuggestion,
  mapAuthAccount,
  mapUpdate,
  mapUser,
  type Row
} from "@/lib/persistence/map";
import { PostgresCompanionStore } from "@/lib/persistence/companionPostgres";
import { throwIfUnique } from "@/lib/persistence/unique";

const txSql = new AsyncLocalStorage<Sql | TransactionSql>();

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    adapter TEXT NOT NULL,
    created_at TEXT NOT NULL,
    email_verified_at TEXT
  )`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT`,
  `CREATE TABLE IF NOT EXISTS auth_accounts (
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    PRIMARY KEY (provider, provider_account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires TEXT NOT NULL,
    PRIMARY KEY (identifier, token)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    brief_json TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    adopted_from_guest_id TEXT,
    latest_submission_id TEXT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS projects_guest_draft_idx
    ON projects (adopted_from_guest_id)
    WHERE adopted_from_guest_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    owner_id TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    title TEXT NOT NULL,
    consent_text TEXT NOT NULL,
    consented_at TEXT NOT NULL,
    receipt_id TEXT NOT NULL UNIQUE,
    idempotency_key TEXT NOT NULL,
    created_at TEXT NOT NULL,
    reviewed_version INTEGER NOT NULL DEFAULT 0,
    payload_hash TEXT NOT NULL DEFAULT '',
    UNIQUE(project_id, idempotency_key)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    author_kind TEXT NOT NULL,
    body TEXT NOT NULL,
    live_ai INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    metadata_json TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS suggestions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    field_key TEXT NOT NULL,
    proposed_value TEXT NOT NULL,
    rationale TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS founder_notes (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    founder_id TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS client_updates (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    founder_id TEXT NOT NULL,
    body TEXT NOT NULL,
    kind TEXT NOT NULL,
    requires_response INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS clarification_responses (
    id TEXT PRIMARY KEY,
    update_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS review_events (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    founder_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS request_ledger (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    project_id TEXT,
    operation TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    result_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS proposals (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    founder_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    scope_json TEXT NOT NULL,
    change_summary TEXT,
    based_on_submission_id TEXT,
    supersedes_proposal_id TEXT,
    payload_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT,
    UNIQUE(project_id, version)
  )`,
  `CREATE TABLE IF NOT EXISTS proposal_decisions (
    id TEXT PRIMARY KEY,
    proposal_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    agreement_text TEXT,
    agreed_version INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS delivery_versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    founder_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    preview_url TEXT,
    notes TEXT,
    status TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT,
    UNIQUE(project_id, kind, version)
  )`,
  `CREATE TABLE IF NOT EXISTS delivery_feedback (
    id TEXT PRIMARY KEY,
    delivery_version_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    author_kind TEXT NOT NULL,
    kind TEXT NOT NULL,
    body TEXT NOT NULL,
    expected_version INTEGER NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS content_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    founder_id TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL,
    status TEXT NOT NULL,
    response TEXT,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS delivery_milestones (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    proposal_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    timing TEXT,
    sort_order INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects (owner_id)`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS proposals_project_id_idx ON proposals (project_id)`,
  `CREATE INDEX IF NOT EXISTS delivery_versions_project_id_idx ON delivery_versions (project_id)`,
  `CREATE INDEX IF NOT EXISTS content_requests_project_id_idx ON content_requests (project_id)`,
  `CREATE INDEX IF NOT EXISTS delivery_milestones_project_id_idx ON delivery_milestones (project_id)`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS reviewed_version INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS payload_hash TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_id TEXT`
];

function sslFor(url: string): boolean | "require" {
  const lowered = url.toLowerCase();
  if (lowered.includes("sslmode=disable") || lowered.includes("ssl=false")) return false;
  if (lowered.includes("localhost") || lowered.includes("127.0.0.1") || lowered.includes("[::1]")) {
    return false;
  }
  return "require";
}

function createClient(url: string) {
  return postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    ssl: sslFor(url),
    transform: { undefined: null }
  });
}

export class PostgresPersistence implements PersistenceAdapter {
  readonly kind = "postgres" as const;
  readonly labeled = true as const;
  readonly companion: PostgresCompanionStore;
  private readonly sql: Sql;
  private initialized = false;

  constructor(url: string) {
    this.sql = createClient(url);
    this.companion = new PostgresCompanionStore(() => this.client());
  }

  private client(): Sql | TransactionSql {
    return txSql.getStore() ?? this.sql;
  }

  ready() {
    return this.initialized;
  }

  async initialize() {
    if (this.initialized) return;
    for (const statement of SCHEMA_STATEMENTS) {
      await this.sql.unsafe(statement);
    }
    await this.companion.initialize();
    this.initialized = true;
  }

  async ping() {
    await this.client()`SELECT 1`;
  }

  async runInTransaction<T>(fn: () => T | Promise<T>): Promise<T> {
    if (txSql.getStore()) return await fn();
    let result!: T;
    await this.sql.begin(async (sql) => {
      result = await txSql.run(sql, () => fn());
    });
    return result;
  }

  async resetForTests() {
    await this.client().unsafe(`
      DELETE FROM request_ledger;
      DELETE FROM delivery_feedback;
      DELETE FROM delivery_versions;
      DELETE FROM proposal_decisions;
      DELETE FROM proposals;
      DELETE FROM content_requests;
      DELETE FROM delivery_milestones;
      DELETE FROM clarification_responses;
      DELETE FROM client_updates;
      DELETE FROM founder_notes;
      DELETE FROM suggestions;
      DELETE FROM messages;
      DELETE FROM review_events;
      DELETE FROM submissions;
      DELETE FROM projects;
      DELETE FROM sessions;
      DELETE FROM auth_accounts;
      DELETE FROM auth_verification_tokens;
      DELETE FROM users;
    `);
    await this.companion.reset();
  }

  async listProjectsByBusiness(businessId: string) {
    const rows =
      await this.client()`SELECT * FROM projects WHERE business_id = ${businessId} ORDER BY updated_at DESC`;
    return rows.map((row) => mapProject(row as Row));
  }

  async upsertUser(user: User) {
    await this.client()`
      INSERT INTO users(id,email,display_name,role,adapter,created_at,email_verified_at)
      VALUES (${user.id}, ${user.email}, ${user.displayName}, ${user.role}, ${user.adapter}, ${user.createdAt}, ${user.emailVerifiedAt ?? null})
      ON CONFLICT (id) DO UPDATE SET
        email = excluded.email,
        display_name = excluded.display_name,
        role = excluded.role,
        adapter = excluded.adapter,
        email_verified_at = excluded.email_verified_at
    `;
    return user;
  }

  async getUserById(id: string) {
    const rows = await this.client()`SELECT * FROM users WHERE id = ${id}`;
    return rows[0] ? mapUser(rows[0] as Row) : null;
  }

  async getUserByEmail(email: string) {
    const rows = await this.client()`SELECT * FROM users WHERE lower(email) = lower(${email})`;
    return rows[0] ? mapUser(rows[0] as Row) : null;
  }

  async listUsers() {
    const rows = await this.client()`SELECT * FROM users`;
    return rows.map((row) => mapUser(row as Row));
  }

  async createSession(session: Session) {
    await this.client()`
      INSERT INTO sessions(id,user_id,created_at,expires_at)
      VALUES (${session.id}, ${session.userId}, ${session.createdAt}, ${session.expiresAt})
    `;
    return session;
  }

  async getSession(id: string) {
    const rows = await this.client()`SELECT * FROM sessions WHERE id = ${id}`;
    return rows[0] ? mapSession(rows[0] as Row) : null;
  }

  async deleteSession(id: string) {
    await this.client()`DELETE FROM sessions WHERE id = ${id}`;
  }

  async updateSession(session: Session) {
    const rows = await this.client()`
      UPDATE sessions
      SET user_id = ${session.userId}, created_at = ${session.createdAt}, expires_at = ${session.expiresAt}
      WHERE id = ${session.id}
      RETURNING *
    `;
    return rows[0] ? session : null;
  }

  async createAuthAccount(account: AuthAccountRecord) {
    await this.client()`
      INSERT INTO auth_accounts(
        provider, provider_account_id, user_id, type, refresh_token, access_token,
        expires_at, token_type, scope, id_token, session_state
      ) VALUES (
        ${account.provider}, ${account.providerAccountId}, ${account.userId}, ${account.type},
        ${account.refresh_token ?? null}, ${account.access_token ?? null}, ${account.expires_at ?? null},
        ${account.token_type ?? null}, ${account.scope ?? null}, ${account.id_token ?? null}, ${account.session_state ?? null}
      )
      ON CONFLICT (provider, provider_account_id) DO UPDATE SET
        user_id = excluded.user_id,
        type = excluded.type,
        refresh_token = excluded.refresh_token,
        access_token = excluded.access_token,
        expires_at = excluded.expires_at,
        token_type = excluded.token_type,
        scope = excluded.scope,
        id_token = excluded.id_token,
        session_state = excluded.session_state
    `;
    return account;
  }

  async getAuthAccount(provider: string, providerAccountId: string) {
    const rows =
      await this.client()`SELECT * FROM auth_accounts WHERE provider = ${provider} AND provider_account_id = ${providerAccountId}`;
    return rows[0] ? mapAuthAccount(rows[0] as Row) : null;
  }

  async deleteAuthAccount(provider: string, providerAccountId: string) {
    await this.client()`DELETE FROM auth_accounts WHERE provider = ${provider} AND provider_account_id = ${providerAccountId}`;
  }

  async createVerificationToken(token: VerificationTokenRecord) {
    const identifier = token.identifier.toLowerCase();
    await this.client()`
      INSERT INTO auth_verification_tokens(identifier, token, expires)
      VALUES (${identifier}, ${token.token}, ${token.expires})
      ON CONFLICT (identifier, token) DO UPDATE SET expires = excluded.expires
    `;
    return { ...token, identifier };
  }

  async useVerificationToken(identifier: string, token: string) {
    const rows =
      await this.client()`SELECT * FROM auth_verification_tokens WHERE identifier = ${identifier.toLowerCase()} AND token = ${token}`;
    if (!rows[0]) return null;
    await this.client()`DELETE FROM auth_verification_tokens WHERE identifier = ${identifier.toLowerCase()} AND token = ${token}`;
    return {
      identifier: String(rows[0].identifier),
      token: String(rows[0].token),
      expires: String(rows[0].expires)
    };
  }

  async createProject(project: Project) {
    try {
      await this.client()`
        INSERT INTO projects(id,owner_id,title,status,brief_json,version,created_at,updated_at,adopted_from_guest_id,latest_submission_id,business_id)
        VALUES (
          ${project.id},
          ${project.ownerId},
          ${project.title},
          ${project.status},
          ${JSON.stringify(project.brief)},
          ${project.version},
          ${project.createdAt},
          ${project.updatedAt},
          ${project.adoptedFromGuestId ?? null},
          ${project.latestSubmissionId ?? null},
          ${project.businessId ?? null}
        )
      `;
      return project;
    } catch (error) {
      throwIfUnique(error, "This guest work has already been claimed.");
    }
  }

  async getProject(id: string) {
    const rows = await this.client()`SELECT * FROM projects WHERE id = ${id}`;
    return rows[0] ? mapProject(rows[0] as Row) : null;
  }

  async listProjectsByOwner(ownerId: string) {
    const rows =
      await this.client()`SELECT * FROM projects WHERE owner_id = ${ownerId} ORDER BY updated_at DESC`;
    return rows.map((row) => mapProject(row as Row));
  }

  async listSubmittedProjects() {
    const rows =
      await this.client()`SELECT * FROM projects WHERE status != 'draft' ORDER BY updated_at DESC`;
    return rows.map((row) => mapProject(row as Row));
  }

  async getProjectByOwnerAndGuestDraft(ownerId: string, guestDraftId: string) {
    const rows = await this.client()`
      SELECT * FROM projects WHERE owner_id = ${ownerId} AND adopted_from_guest_id = ${guestDraftId} LIMIT 1
    `;
    return rows[0] ? mapProject(rows[0] as Row) : null;
  }

  async getProjectByGuestDraft(guestDraftId: string) {
    const rows =
      await this.client()`SELECT * FROM projects WHERE adopted_from_guest_id = ${guestDraftId} LIMIT 1`;
    return rows[0] ? mapProject(rows[0] as Row) : null;
  }

  async getSubmissionByIdempotencyKey(key: string) {
    const rows = await this.client()`SELECT * FROM submissions WHERE idempotency_key = ${key} LIMIT 1`;
    return rows[0] ? mapSubmission(rows[0] as Row) : null;
  }

  async updateProject(project: Project) {
    await this.client()`
      UPDATE projects SET
        title = ${project.title},
        status = ${project.status},
        brief_json = ${JSON.stringify(project.brief)},
        version = ${project.version},
        updated_at = ${project.updatedAt},
        adopted_from_guest_id = ${project.adoptedFromGuestId ?? null},
        latest_submission_id = ${project.latestSubmissionId ?? null},
        business_id = ${project.businessId ?? null}
      WHERE id = ${project.id}
    `;
    return project;
  }

  async createSubmission(submission: Submission) {
    await this.client()`
      INSERT INTO submissions(
        id,project_id,owner_id,snapshot_json,title,consent_text,consented_at,receipt_id,idempotency_key,created_at,reviewed_version,payload_hash
      )
      VALUES (
        ${submission.id},
        ${submission.projectId},
        ${submission.ownerId},
        ${JSON.stringify(submission.snapshot)},
        ${submission.title},
        ${submission.consentText},
        ${submission.consentedAt},
        ${submission.receiptId},
        ${submission.idempotencyKey},
        ${submission.createdAt},
        ${submission.reviewedVersion},
        ${submission.payloadHash}
      )
    `;
    return submission;
  }

  async getSubmission(id: string) {
    const rows = await this.client()`SELECT * FROM submissions WHERE id = ${id}`;
    return rows[0] ? mapSubmission(rows[0] as Row) : null;
  }

  async getSubmissionByIdempotency(projectId: string, key: string) {
    const rows = await this.client()`
      SELECT * FROM submissions WHERE project_id = ${projectId} AND idempotency_key = ${key}
    `;
    return rows[0] ? mapSubmission(rows[0] as Row) : null;
  }

  async listSubmissions(projectId: string) {
    const rows =
      await this.client()`SELECT * FROM submissions WHERE project_id = ${projectId} ORDER BY created_at ASC`;
    return rows.map((row) => mapSubmission(row as Row));
  }

  async addMessage(message: ChatMessage) {
    await this.client()`
      INSERT INTO messages(id,project_id,author_kind,body,live_ai,created_at,metadata_json)
      VALUES (
        ${message.id},
        ${message.projectId},
        ${message.authorKind},
        ${message.body},
        ${message.liveAi ? 1 : 0},
        ${message.createdAt},
        ${message.metadata ? JSON.stringify(message.metadata) : null}
      )
    `;
    return message;
  }

  async listMessages(projectId: string) {
    const rows =
      await this.client()`SELECT * FROM messages WHERE project_id = ${projectId} ORDER BY created_at ASC`;
    return rows.map((row) => mapMessage(row as Row));
  }

  async addSuggestion(suggestion: Suggestion) {
    await this.client()`
      INSERT INTO suggestions(id,project_id,field_key,proposed_value,rationale,status,created_at,resolved_at)
      VALUES (
        ${suggestion.id},
        ${suggestion.projectId},
        ${suggestion.fieldKey},
        ${suggestion.proposedValue},
        ${suggestion.rationale ?? null},
        ${suggestion.status},
        ${suggestion.createdAt},
        ${suggestion.resolvedAt ?? null}
      )
    `;
    return suggestion;
  }

  async getSuggestion(id: string) {
    const rows = await this.client()`SELECT * FROM suggestions WHERE id = ${id}`;
    return rows[0] ? mapSuggestion(rows[0] as Row) : null;
  }

  async listSuggestions(projectId: string) {
    const rows =
      await this.client()`SELECT * FROM suggestions WHERE project_id = ${projectId} ORDER BY created_at ASC`;
    return rows.map((row) => mapSuggestion(row as Row));
  }

  async updateSuggestion(suggestion: Suggestion) {
    await this.client()`
      UPDATE suggestions SET status = ${suggestion.status}, resolved_at = ${suggestion.resolvedAt ?? null}
      WHERE id = ${suggestion.id}
    `;
    return suggestion;
  }

  async addFounderNote(note: FounderNote) {
    await this.client()`
      INSERT INTO founder_notes(id,project_id,founder_id,body,kind,created_at,updated_at,version)
      VALUES (
        ${note.id},
        ${note.projectId},
        ${note.founderId},
        ${note.body},
        ${note.kind},
        ${note.createdAt},
        ${note.updatedAt},
        ${note.version}
      )
    `;
    return note;
  }

  async listFounderNotes(projectId: string) {
    const rows =
      await this.client()`SELECT * FROM founder_notes WHERE project_id = ${projectId} ORDER BY created_at ASC`;
    return rows.map((row) => mapNote(row as Row));
  }

  async updateFounderNote(note: FounderNote) {
    await this.client()`
      UPDATE founder_notes SET body = ${note.body}, updated_at = ${note.updatedAt}, version = ${note.version}
      WHERE id = ${note.id}
    `;
    return note;
  }

  async addClientUpdate(update: ClientUpdate) {
    await this.client()`
      INSERT INTO client_updates(id,project_id,founder_id,kind,body,requires_response,created_at)
      VALUES (
        ${update.id},
        ${update.projectId},
        ${update.founderId},
        ${update.kind},
        ${update.body},
        ${update.requiresResponse ? 1 : 0},
        ${update.createdAt}
      )
    `;
    return update;
  }

  async listClientUpdates(projectId: string) {
    const rows =
      await this.client()`SELECT * FROM client_updates WHERE project_id = ${projectId} ORDER BY created_at ASC`;
    return rows.map((row) => mapUpdate(row as Row));
  }

  async addClarificationResponse(response: ClarificationResponse) {
    await this.client()`
      INSERT INTO clarification_responses(id,update_id,project_id,author_id,body,created_at)
      VALUES (
        ${response.id},
        ${response.updateId},
        ${response.projectId},
        ${response.authorId},
        ${response.body},
        ${response.createdAt}
      )
    `;
    return response;
  }

  async listClarificationResponses(projectId: string) {
    const rows = await this.client()`
      SELECT * FROM clarification_responses WHERE project_id = ${projectId} ORDER BY created_at ASC
    `;
    return rows.map((row) => mapResponse(row as Row));
  }

  async addReviewEvent(event: ReviewEvent) {
    await this.client()`
      INSERT INTO review_events(id,project_id,founder_id,kind,created_at)
      VALUES (${event.id}, ${event.projectId}, ${event.founderId}, ${event.kind}, ${event.createdAt})
    `;
    return event;
  }

  async listReviewEvents(projectId: string) {
    const rows =
      await this.client()`SELECT * FROM review_events WHERE project_id = ${projectId} ORDER BY created_at ASC`;
    return rows.map((row) => mapReview(row as Row));
  }

  async putLedger(entry: RequestLedgerEntry) {
    await this.client()`
      INSERT INTO request_ledger(id,owner_id,project_id,operation,payload_hash,status,result_json,created_at,updated_at)
      VALUES (
        ${entry.id},
        ${entry.ownerId},
        ${entry.projectId ?? null},
        ${entry.operation},
        ${entry.payloadHash},
        ${entry.status},
        ${entry.resultJson ?? null},
        ${entry.createdAt},
        ${entry.updatedAt}
      )
      ON CONFLICT (id) DO UPDATE SET
        status = excluded.status,
        result_json = excluded.result_json,
        updated_at = excluded.updated_at
    `;
    return entry;
  }

  async getLedger(id: string) {
    const rows = await this.client()`SELECT * FROM request_ledger WHERE id = ${id}`;
    return rows[0] ? mapLedger(rows[0] as Row) : null;
  }

  async countAssistantMessagesSince(projectId: string, isoSince: string) {
    const rows = await this.client()`
      SELECT COUNT(*)::int AS c
      FROM messages
      WHERE project_id = ${projectId}
        AND author_kind = 'assistant'
        AND live_ai = 1
        AND created_at >= ${isoSince}
    `;
    return Number((rows[0] as { c?: number } | undefined)?.c ?? 0);
  }

  async addProposal(proposal: Proposal) {
    await this.client()`
      INSERT INTO proposals(
        id,project_id,founder_id,version,status,scope_json,change_summary,based_on_submission_id,supersedes_proposal_id,payload_hash,created_at,updated_at,published_at
      )
      VALUES (
        ${proposal.id},
        ${proposal.projectId},
        ${proposal.founderId},
        ${proposal.version},
        ${proposal.status},
        ${JSON.stringify(proposal.scope)},
        ${proposal.changeSummary},
        ${proposal.basedOnSubmissionId ?? null},
        ${proposal.supersedesProposalId ?? null},
        ${proposal.payloadHash},
        ${proposal.createdAt},
        ${proposal.updatedAt},
        ${proposal.publishedAt ?? null}
      )
    `;
    return proposal;
  }

  async getProposal(id: string) {
    const rows = await this.client()`SELECT * FROM proposals WHERE id = ${id}`;
    return rows[0] ? mapProposal(rows[0] as Row) : null;
  }

  async listProposals(projectId: string) {
    const rows =
      await this.client()`SELECT * FROM proposals WHERE project_id = ${projectId} ORDER BY version ASC`;
    return rows.map((row) => mapProposal(row as Row));
  }

  async updateProposal(proposal: Proposal) {
    await this.client()`
      UPDATE proposals SET
        status = ${proposal.status},
        scope_json = ${JSON.stringify(proposal.scope)},
        change_summary = ${proposal.changeSummary},
        based_on_submission_id = ${proposal.basedOnSubmissionId ?? null},
        supersedes_proposal_id = ${proposal.supersedesProposalId ?? null},
        payload_hash = ${proposal.payloadHash},
        updated_at = ${proposal.updatedAt},
        published_at = ${proposal.publishedAt ?? null}
      WHERE id = ${proposal.id}
    `;
    return proposal;
  }

  async addProposalDecision(decision: ProposalDecision) {
    await this.client()`
      INSERT INTO proposal_decisions(
        id,proposal_id,project_id,author_id,kind,body,agreement_text,agreed_version,created_at
      )
      VALUES (
        ${decision.id},
        ${decision.proposalId},
        ${decision.projectId},
        ${decision.authorId},
        ${decision.kind},
        ${decision.body},
        ${decision.agreementText ?? null},
        ${decision.agreedVersion},
        ${decision.createdAt}
      )
    `;
    return decision;
  }

  async listProposalDecisions(projectId: string) {
    const rows = await this.client()`
      SELECT * FROM proposal_decisions WHERE project_id = ${projectId} ORDER BY created_at ASC
    `;
    return rows.map((row) => mapProposalDecision(row as Row));
  }

  async addDeliveryVersion(version: DeliveryVersion) {
    await this.client()`
      INSERT INTO delivery_versions(
        id,project_id,founder_id,kind,version,title,summary,preview_url,notes,status,payload_hash,created_at,updated_at,published_at
      )
      VALUES (
        ${version.id},
        ${version.projectId},
        ${version.founderId},
        ${version.kind},
        ${version.version},
        ${version.title},
        ${version.summary},
        ${version.previewUrl ?? null},
        ${version.notes},
        ${version.status},
        ${version.payloadHash},
        ${version.createdAt},
        ${version.updatedAt},
        ${version.publishedAt ?? null}
      )
    `;
    return version;
  }

  async getDeliveryVersion(id: string) {
    const rows = await this.client()`SELECT * FROM delivery_versions WHERE id = ${id}`;
    return rows[0] ? mapDeliveryVersion(rows[0] as Row) : null;
  }

  async listDeliveryVersions(projectId: string) {
    const rows = await this.client()`
      SELECT * FROM delivery_versions WHERE project_id = ${projectId} ORDER BY kind ASC, version ASC
    `;
    return rows.map((row) => mapDeliveryVersion(row as Row));
  }

  async updateDeliveryVersion(version: DeliveryVersion) {
    await this.client()`
      UPDATE delivery_versions SET
        title = ${version.title},
        summary = ${version.summary},
        preview_url = ${version.previewUrl ?? null},
        notes = ${version.notes},
        status = ${version.status},
        payload_hash = ${version.payloadHash},
        updated_at = ${version.updatedAt},
        published_at = ${version.publishedAt ?? null}
      WHERE id = ${version.id}
    `;
    return version;
  }

  async addDeliveryFeedback(feedback: DeliveryFeedback) {
    await this.client()`
      INSERT INTO delivery_feedback(
        id,delivery_version_id,project_id,author_id,author_kind,kind,body,expected_version,created_at
      )
      VALUES (
        ${feedback.id},
        ${feedback.deliveryVersionId},
        ${feedback.projectId},
        ${feedback.authorId},
        ${feedback.authorKind},
        ${feedback.kind},
        ${feedback.body},
        ${feedback.expectedVersion},
        ${feedback.createdAt}
      )
    `;
    return feedback;
  }

  async listDeliveryFeedback(projectId: string) {
    const rows = await this.client()`
      SELECT * FROM delivery_feedback WHERE project_id = ${projectId} ORDER BY created_at ASC
    `;
    return rows.map((row) => mapDeliveryFeedback(row as Row));
  }

  async addContentRequest(request: ContentRequest) {
    await this.client()`
      INSERT INTO content_requests(
        id,project_id,founder_id,title,detail,status,response,created_at,resolved_at
      )
      VALUES (
        ${request.id},
        ${request.projectId},
        ${request.founderId},
        ${request.title},
        ${request.detail},
        ${request.status},
        ${request.response ?? null},
        ${request.createdAt},
        ${request.resolvedAt ?? null}
      )
    `;
    return request;
  }

  async getContentRequest(id: string) {
    const rows = await this.client()`SELECT * FROM content_requests WHERE id = ${id}`;
    return rows[0] ? mapContentRequest(rows[0] as Row) : null;
  }

  async listContentRequests(projectId: string) {
    const rows = await this.client()`
      SELECT * FROM content_requests WHERE project_id = ${projectId} ORDER BY created_at ASC
    `;
    return rows.map((row) => mapContentRequest(row as Row));
  }

  async updateContentRequest(request: ContentRequest) {
    await this.client()`
      UPDATE content_requests SET
        status = ${request.status},
        response = ${request.response ?? null},
        resolved_at = ${request.resolvedAt ?? null}
      WHERE id = ${request.id}
    `;
    return request;
  }

  async addDeliveryMilestone(milestone: DeliveryMilestone) {
    await this.client()`
      INSERT INTO delivery_milestones(
        id,project_id,proposal_id,title,description,timing,sort_order,status,created_at,updated_at
      )
      VALUES (
        ${milestone.id},
        ${milestone.projectId},
        ${milestone.proposalId},
        ${milestone.title},
        ${milestone.description},
        ${milestone.timing ?? null},
        ${milestone.sortOrder},
        ${milestone.status},
        ${milestone.createdAt},
        ${milestone.updatedAt}
      )
    `;
    return milestone;
  }

  async listDeliveryMilestones(projectId: string) {
    const rows = await this.client()`
      SELECT * FROM delivery_milestones WHERE project_id = ${projectId} ORDER BY sort_order ASC
    `;
    return rows.map((row) => mapDeliveryMilestone(row as Row));
  }

  async updateDeliveryMilestone(milestone: DeliveryMilestone) {
    await this.client()`
      UPDATE delivery_milestones SET status = ${milestone.status}, updated_at = ${milestone.updatedAt}
      WHERE id = ${milestone.id}
    `;
    return milestone;
  }
}
