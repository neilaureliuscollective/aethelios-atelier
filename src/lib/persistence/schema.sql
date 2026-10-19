-- Additive local schema candidate for Aethelios Atelier.
-- Canonical local runtime: src/lib/persistence/sqlite.ts
-- Hosted Postgres: src/lib/persistence/schema.postgres.sql and src/lib/persistence/postgres.ts
-- Do not apply this to the Aethelios production database.

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
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS proposals (
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
);
CREATE TABLE IF NOT EXISTS proposal_decisions (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  agreement_text TEXT,
  agreed_version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivery_versions (
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
);
CREATE TABLE IF NOT EXISTS delivery_feedback (
  id TEXT PRIMARY KEY,
  delivery_version_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_kind TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  expected_version INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS content_requests (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  founder_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL,
  response TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS delivery_milestones (
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
);
