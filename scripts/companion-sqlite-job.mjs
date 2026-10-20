#!/usr/bin/env node
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync(":memory:");
db.exec(`
  CREATE TABLE generation_jobs (
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
    error TEXT
  );
`);
db.prepare(
  `INSERT INTO generation_jobs(id,business_id,owner_id,session_id,kind,status,idempotency_key,created_at,updated_at,result_json,error)
   VALUES(?,?,?,?,?,?,?,?,?,?,?)`
).run("job_1", "biz_1", "user_1", "sess_old", "talk", "failed", "talk-retry", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", null, null);
db.prepare("UPDATE generation_jobs SET status=?, session_id=?, updated_at=?, result_json=?, error=? WHERE id=?").run(
  "pending",
  "sess_new",
  "2026-01-01T00:01:00.000Z",
  null,
  null,
  "job_1"
);
const row = db.prepare("SELECT session_id, status FROM generation_jobs WHERE id=?").get("job_1");
if (row.session_id !== "sess_new" || row.status !== "pending") {
  console.error("FAIL sqlite updateJob session_id", row);
  process.exit(1);
}
console.log("PASS sqlite updateJob persists session_id");
