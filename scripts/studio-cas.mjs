#!/usr/bin/env node
/**
 * Two sqlite connections compete to save the same Studio draft revision.
 * Exactly one write must succeed.
 */
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const file = path.join(os.tmpdir(), `atelier-cas-${Date.now()}.sqlite`);
const setup = new DatabaseSync(file);
setup.exec("PRAGMA journal_mode = WAL;");
setup.exec(`
CREATE TABLE studio_drafts (
  id TEXT PRIMARY KEY,
  layout TEXT,
  layers_json TEXT,
  updated_at TEXT
);
INSERT INTO studio_drafts VALUES ('draft_1', 'square_announcement', '[]', 'v1');
`);
setup.close();

function save(expected, next) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = db
      .prepare("UPDATE studio_drafts SET layers_json=?, updated_at=? WHERE id=? AND updated_at=?")
      .run(next, next, "draft_1", expected);
    db.exec("COMMIT");
    db.close();
    return { written: result.changes === 1 };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    db.close();
    return { written: false, error: String(error) };
  }
}

const a = save("v1", "newer");
const b = save("v1", "stale");
const check = new DatabaseSync(file);
const row = check.prepare("SELECT layers_json, updated_at FROM studio_drafts WHERE id='draft_1'").get();
check.close();
fs.unlinkSync(file);

const ok = (a.written !== b.written) && (a.written || b.written) && row.updated_at === "newer" && row.layers_json === "newer";
if (!ok) {
  console.error("FAIL studio-cas", { a, b, row });
  process.exit(1);
}
console.log("PASS studio-cas exactly one of two same-revision saves succeeded; newer text preserved");
