import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import type {
  Brief,
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
import { normalizeBrief } from "@/lib/brief";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  adapter TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
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
);
CREATE TABLE IF NOT EXISTS submissions (
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
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  author_kind TEXT NOT NULL,
  body TEXT NOT NULL,
  live_ai INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS founder_notes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  founder_id TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS client_updates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  founder_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  requires_response INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clarification_responses (
  id TEXT PRIMARY KEY,
  update_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  founder_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS request_ledger (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  operation TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export class SqlitePersistence implements PersistenceAdapter {
  readonly kind = "sqlite_local" as const;
  readonly labeled = true as const;
  private db: DatabaseSync;

  constructor(filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.db = new DatabaseSync(filePath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(SCHEMA);
    this.ensureSubmissionRequestColumns();
  }

  private ensureSubmissionRequestColumns() {
    const columns = this.db.prepare("PRAGMA table_info(submissions)").all() as Array<{ name: string }>;
    const names = new Set(columns.map((column) => column.name));
    if (!names.has("reviewed_version")) {
      this.db.exec("ALTER TABLE submissions ADD COLUMN reviewed_version INTEGER NOT NULL DEFAULT 0");
    }
    if (!names.has("payload_hash")) {
      this.db.exec("ALTER TABLE submissions ADD COLUMN payload_hash TEXT NOT NULL DEFAULT ''");
    }
  }

  ready() {
    return true;
  }

  runInTransaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        /* already rolled back */
      }
      throw error;
    }
  }

  resetForTests() {
    this.db.exec(`
      DELETE FROM request_ledger;
      DELETE FROM clarification_responses;
      DELETE FROM client_updates;
      DELETE FROM founder_notes;
      DELETE FROM suggestions;
      DELETE FROM messages;
      DELETE FROM review_events;
      DELETE FROM submissions;
      DELETE FROM projects;
      DELETE FROM sessions;
      DELETE FROM users;
    `);
  }

  upsertUser(user: User) {
    this.db
      .prepare(
        `INSERT INTO users(id,email,display_name,role,adapter,created_at)
         VALUES(?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET email=excluded.email, display_name=excluded.display_name, role=excluded.role`
      )
      .run(user.id, user.email, user.displayName, user.role, user.adapter, user.createdAt);
    return user;
  }

  getUserById(id: string) {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | Record<string, string>
      | undefined;
    return row ? this.mapUser(row) : null;
  }

  getUserByEmail(email: string) {
    const row = this.db.prepare("SELECT * FROM users WHERE lower(email) = lower(?)").get(email) as
      | Record<string, string>
      | undefined;
    return row ? this.mapUser(row) : null;
  }

  listUsers() {
    const rows = this.db.prepare("SELECT * FROM users").all() as Record<string, string>[];
    return rows.map((row) => this.mapUser(row));
  }

  createSession(session: Session) {
    this.db
      .prepare("INSERT INTO sessions(id,user_id,created_at,expires_at) VALUES(?,?,?,?)")
      .run(session.id, session.userId, session.createdAt, session.expiresAt);
    return session;
  }

  getSession(id: string) {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
      | Record<string, string>
      | undefined;
    if (!row?.id || !row.user_id || !row.created_at || !row.expires_at) return null;
    return {
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    };
  }

  deleteSession(id: string) {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  }

  createProject(project: Project) {
    this.db
      .prepare(
        `INSERT INTO projects(id,owner_id,title,status,brief_json,version,created_at,updated_at,adopted_from_guest_id,latest_submission_id)
         VALUES(?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        project.id,
        project.ownerId,
        project.title,
        project.status,
        JSON.stringify(project.brief),
        project.version,
        project.createdAt,
        project.updatedAt,
        project.adoptedFromGuestId ?? null,
        project.latestSubmissionId ?? null
      );
    return project;
  }

  getProject(id: string) {
    const row = this.db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapProject(row) : null;
  }

  listProjectsByOwner(ownerId: string) {
    const rows = this.db
      .prepare("SELECT * FROM projects WHERE owner_id = ? ORDER BY updated_at DESC")
      .all(ownerId) as Record<string, unknown>[];
    return rows.map((row) => this.mapProject(row));
  }

  listSubmittedProjects() {
    const rows = this.db
      .prepare("SELECT * FROM projects WHERE status != 'draft' ORDER BY updated_at DESC")
      .all() as Record<string, unknown>[];
    return rows.map((row) => this.mapProject(row));
  }

  getProjectByOwnerAndGuestDraft(ownerId: string, guestDraftId: string) {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE owner_id = ? AND adopted_from_guest_id = ? LIMIT 1")
      .get(ownerId, guestDraftId) as Record<string, unknown> | undefined;
    return row ? this.mapProject(row) : null;
  }

  getSubmissionByIdempotencyKey(key: string) {
    const row = this.db.prepare("SELECT * FROM submissions WHERE idempotency_key = ? LIMIT 1").get(key) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapSubmission(row) : null;
  }

  updateProject(project: Project) {
    this.db
      .prepare(
        `UPDATE projects SET title=?, status=?, brief_json=?, version=?, updated_at=?, adopted_from_guest_id=?, latest_submission_id=?
         WHERE id=?`
      )
      .run(
        project.title,
        project.status,
        JSON.stringify(project.brief),
        project.version,
        project.updatedAt,
        project.adoptedFromGuestId ?? null,
        project.latestSubmissionId ?? null,
        project.id
      );
    return project;
  }

  createSubmission(submission: Submission) {
    this.db
      .prepare(
        `INSERT INTO submissions(id,project_id,owner_id,snapshot_json,title,consent_text,consented_at,receipt_id,idempotency_key,created_at,reviewed_version,payload_hash)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        submission.id,
        submission.projectId,
        submission.ownerId,
        JSON.stringify(submission.snapshot),
        submission.title,
        submission.consentText,
        submission.consentedAt,
        submission.receiptId,
        submission.idempotencyKey,
        submission.createdAt,
        submission.reviewedVersion,
        submission.payloadHash
      );
    return submission;
  }

  getSubmission(id: string) {
    const row = this.db.prepare("SELECT * FROM submissions WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapSubmission(row) : null;
  }

  getSubmissionByIdempotency(projectId: string, key: string) {
    const row = this.db
      .prepare("SELECT * FROM submissions WHERE project_id = ? AND idempotency_key = ?")
      .get(projectId, key) as Record<string, unknown> | undefined;
    return row ? this.mapSubmission(row) : null;
  }

  listSubmissions(projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM submissions WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.mapSubmission(row));
  }

  addMessage(message: ChatMessage) {
    this.db
      .prepare(
        `INSERT INTO messages(id,project_id,author_kind,body,live_ai,created_at,metadata_json)
         VALUES(?,?,?,?,?,?,?)`
      )
      .run(
        message.id,
        message.projectId,
        message.authorKind,
        message.body,
        message.liveAi ? 1 : 0,
        message.createdAt,
        message.metadata ? JSON.stringify(message.metadata) : null
      );
    return message;
  }

  listMessages(projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM messages WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.mapMessage(row));
  }

  addSuggestion(suggestion: Suggestion) {
    this.db
      .prepare(
        `INSERT INTO suggestions(id,project_id,field_key,proposed_value,rationale,status,created_at,resolved_at)
         VALUES(?,?,?,?,?,?,?,?)`
      )
      .run(
        suggestion.id,
        suggestion.projectId,
        suggestion.fieldKey,
        suggestion.proposedValue,
        suggestion.rationale ?? null,
        suggestion.status,
        suggestion.createdAt,
        suggestion.resolvedAt ?? null
      );
    return suggestion;
  }

  getSuggestion(id: string) {
    const row = this.db.prepare("SELECT * FROM suggestions WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapSuggestion(row) : null;
  }

  listSuggestions(projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM suggestions WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.mapSuggestion(row));
  }

  updateSuggestion(suggestion: Suggestion) {
    this.db
      .prepare("UPDATE suggestions SET status=?, resolved_at=? WHERE id=?")
      .run(suggestion.status, suggestion.resolvedAt ?? null, suggestion.id);
    return suggestion;
  }

  addFounderNote(note: FounderNote) {
    this.db
      .prepare(
        `INSERT INTO founder_notes(id,project_id,founder_id,body,kind,created_at,updated_at,version)
         VALUES(?,?,?,?,?,?,?,?)`
      )
      .run(
        note.id,
        note.projectId,
        note.founderId,
        note.body,
        note.kind,
        note.createdAt,
        note.updatedAt,
        note.version
      );
    return note;
  }

  listFounderNotes(projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM founder_notes WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.mapNote(row));
  }

  updateFounderNote(note: FounderNote) {
    this.db
      .prepare("UPDATE founder_notes SET body=?, updated_at=?, version=? WHERE id=?")
      .run(note.body, note.updatedAt, note.version, note.id);
    return note;
  }

  addClientUpdate(update: ClientUpdate) {
    this.db
      .prepare(
        `INSERT INTO client_updates(id,project_id,founder_id,kind,body,requires_response,created_at)
         VALUES(?,?,?,?,?,?,?)`
      )
      .run(
        update.id,
        update.projectId,
        update.founderId,
        update.kind,
        update.body,
        update.requiresResponse ? 1 : 0,
        update.createdAt
      );
    return update;
  }

  listClientUpdates(projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM client_updates WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.mapUpdate(row));
  }

  addClarificationResponse(response: ClarificationResponse) {
    this.db
      .prepare(
        `INSERT INTO clarification_responses(id,update_id,project_id,author_id,body,created_at)
         VALUES(?,?,?,?,?,?)`
      )
      .run(
        response.id,
        response.updateId,
        response.projectId,
        response.authorId,
        response.body,
        response.createdAt
      );
    return response;
  }

  listClarificationResponses(projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM clarification_responses WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => this.mapResponse(row));
  }

  addReviewEvent(event: ReviewEvent) {
    this.db
      .prepare(
        "INSERT INTO review_events(id,project_id,founder_id,kind,created_at) VALUES(?,?,?,?,?)"
      )
      .run(event.id, event.projectId, event.founderId, event.kind, event.createdAt);
    return event;
  }

  listReviewEvents(projectId: string) {
    const rows = this.db
      .prepare("SELECT * FROM review_events WHERE project_id = ? ORDER BY created_at ASC")
      .all(projectId) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      projectId: String(row.project_id),
      founderId: String(row.founder_id),
      kind: "review_started" as const,
      createdAt: String(row.created_at)
    }));
  }

  putLedger(entry: RequestLedgerEntry) {
    this.db
      .prepare(
        `INSERT INTO request_ledger(id,owner_id,project_id,operation,payload_hash,status,result_json,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET status=excluded.status, result_json=excluded.result_json, updated_at=excluded.updated_at`
      )
      .run(
        entry.id,
        entry.ownerId,
        entry.projectId ?? null,
        entry.operation,
        entry.payloadHash,
        entry.status,
        entry.resultJson ?? null,
        entry.createdAt,
        entry.updatedAt
      );
    return entry;
  }

  getLedger(id: string) {
    const row = this.db.prepare("SELECT * FROM request_ledger WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      projectId: row.project_id ? String(row.project_id) : undefined,
      operation: String(row.operation),
      payloadHash: String(row.payload_hash),
      status: row.status as RequestLedgerEntry["status"],
      resultJson: row.result_json ? String(row.result_json) : undefined,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  countAssistantMessagesSince(projectId: string, isoSince: string) {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as c FROM messages WHERE project_id = ? AND author_kind = 'assistant' AND live_ai = 1 AND created_at >= ?"
      )
      .get(projectId, isoSince) as { c: number };
    return Number(row.c);
  }

  private mapUser(row: Record<string, string>): User {
    return {
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
      role: row.role as User["role"],
      adapter: "simulated",
      createdAt: String(row.created_at)
    };
  }

  private mapProject(row: Record<string, unknown>): Project {
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      title: String(row.title),
      status: row.status as Project["status"],
      brief: normalizeBrief(parseJson<Brief>(String(row.brief_json))),
      version: Number(row.version),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      adoptedFromGuestId: row.adopted_from_guest_id ? String(row.adopted_from_guest_id) : undefined,
      latestSubmissionId: row.latest_submission_id ? String(row.latest_submission_id) : undefined
    };
  }

  private mapSubmission(row: Record<string, unknown>): Submission {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      ownerId: String(row.owner_id),
      snapshot: normalizeBrief(parseJson<Brief>(String(row.snapshot_json))),
      title: String(row.title),
      consentText: String(row.consent_text),
      consentedAt: String(row.consented_at),
      receiptId: String(row.receipt_id),
      idempotencyKey: String(row.idempotency_key),
      createdAt: String(row.created_at),
      reviewedVersion: Number(row.reviewed_version ?? 0),
      payloadHash: String(row.payload_hash ?? "")
    };
  }

  private mapMessage(row: Record<string, unknown>): ChatMessage {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      authorKind: row.author_kind as ChatMessage["authorKind"],
      body: String(row.body),
      liveAi: Number(row.live_ai) === 1,
      createdAt: String(row.created_at),
      metadata: row.metadata_json ? parseJson(String(row.metadata_json)) : undefined
    };
  }

  private mapSuggestion(row: Record<string, unknown>): Suggestion {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      fieldKey: row.field_key as Suggestion["fieldKey"],
      proposedValue: String(row.proposed_value),
      rationale: row.rationale ? String(row.rationale) : undefined,
      status: row.status as Suggestion["status"],
      createdAt: String(row.created_at),
      resolvedAt: row.resolved_at ? String(row.resolved_at) : undefined
    };
  }

  private mapNote(row: Record<string, unknown>): FounderNote {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      founderId: String(row.founder_id),
      body: String(row.body),
      kind: row.kind as FounderNote["kind"],
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      version: Number(row.version)
    };
  }

  private mapUpdate(row: Record<string, unknown>): ClientUpdate {
    return {
      id: String(row.id),
      projectId: String(row.project_id),
      founderId: String(row.founder_id),
      kind: row.kind as ClientUpdate["kind"],
      body: String(row.body),
      requiresResponse: Number(row.requires_response) === 1,
      createdAt: String(row.created_at)
    };
  }

  private mapResponse(row: Record<string, unknown>): ClarificationResponse {
    return {
      id: String(row.id),
      updateId: String(row.update_id),
      projectId: String(row.project_id),
      authorId: String(row.author_id),
      body: String(row.body),
      createdAt: String(row.created_at)
    };
  }
}
