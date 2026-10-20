-- Additive hosted schema for a dedicated Aethelios Atelier database.
-- Canonical runtime implementation: src/lib/persistence/postgres.ts
-- Never apply this to the Aethelios production database.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  adapter TEXT NOT NULL,
  created_at TEXT NOT NULL,
  email_verified_at TEXT
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
CREATE INDEX IF NOT EXISTS projects_owner_id_idx ON projects (owner_id);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS proposals_project_id_idx ON proposals (project_id);
CREATE INDEX IF NOT EXISTS delivery_versions_project_id_idx ON delivery_versions (project_id);
CREATE INDEX IF NOT EXISTS content_requests_project_id_idx ON content_requests (project_id);
CREATE INDEX IF NOT EXISTS delivery_milestones_project_id_idx ON delivery_milestones (project_id);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS business_id TEXT;

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS business_members (
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (business_id, user_id)
);
CREATE TABLE IF NOT EXISTS business_profiles (
  business_id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);
CREATE TABLE IF NOT EXISTS business_memory_proposals (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  field_key TEXT NOT NULL,
  proposed_value TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE TABLE IF NOT EXISTS business_documents (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  title TEXT NOT NULL,
  mime TEXT NOT NULL,
  status TEXT NOT NULL,
  blob_id TEXT,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT,
  provider_file_id TEXT,
  index_status TEXT
);
CREATE TABLE IF NOT EXISTS business_conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  project_id TEXT,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS business_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  business_id TEXT NOT NULL,
  project_id TEXT,
  author_kind TEXT NOT NULL,
  body TEXT NOT NULL,
  live_ai INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT
);
CREATE TABLE IF NOT EXISTS work_items (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  project_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE TABLE IF NOT EXISTS studio_drafts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  work_item_id TEXT NOT NULL,
  layout TEXT NOT NULL,
  layers_json TEXT NOT NULL,
  selected_asset_id TEXT,
  source_work_item_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  save_revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS studio_assets (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  work_item_id TEXT,
  draft_id TEXT,
  status TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model TEXT,
  blob_id TEXT,
  revision INTEGER NOT NULL,
  parent_id TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  units INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  attempt INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  result_json TEXT,
  error TEXT,
  attempt INTEGER NOT NULL DEFAULT 1,
  UNIQUE (business_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS companion_blobs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_accounts (
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
);
CREATE TABLE IF NOT EXISTS auth_verification_tokens (
  identifier TEXT NOT NULL,
  token TEXT NOT NULL,
  expires TEXT NOT NULL,
  PRIMARY KEY (identifier, token)
);
CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts (user_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TEXT;
CREATE TABLE IF NOT EXISTS studio_composition_revisions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  work_item_id TEXT,
  version INTEGER NOT NULL,
  layout TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  layers_json TEXT NOT NULL,
  palette_json TEXT NOT NULL,
  composition_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  UNIQUE (draft_id, version)
);
