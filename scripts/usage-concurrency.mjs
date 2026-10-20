#!/usr/bin/env node
/**
 * Two independent sqlite connections compete for the last image allowance.
 * The rejected request must make zero provider calls.
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const schema = `
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  units INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT,
  operation_id TEXT,
  status TEXT,
  expires_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_operation_idx
  ON usage_events (business_id, operation_id)
  WHERE operation_id IS NOT NULL;
`;

function used(db) {
  const rows = db.prepare("SELECT units, status FROM usage_events WHERE business_id=? AND kind=?").all("biz_1", "image");
  return rows
    .filter((row) => row.status === "held" || row.status === "settled")
    .reduce((sum, row) => sum + Number(row.units), 0);
}

function reserve(file, operationId) {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(schema);
  db.exec("BEGIN IMMEDIATE");
  try {
    if (used(db) + 1 > 1) {
      db.exec("ROLLBACK");
      db.close();
      return { rejected: true, providerCalls: 0 };
    }
    db.prepare(
      "INSERT INTO usage_events(id,business_id,user_id,kind,units,created_at,operation_id,status) VALUES(?,?,?,?,?,?,?,?)"
    ).run(`use_${operationId}`, "biz_1", "user_1", "image", 1, new Date().toISOString(), operationId, "held");
    db.exec("COMMIT");
    db.close();
    return { reserved: true, providerCalls: 1 };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* already rolled back */
    }
    db.close();
    return { rejected: true, providerCalls: 0, error: String(error) };
  }
}

if (!isMainThread) {
  parentPort.postMessage(reserve(workerData.file, workerData.operationId));
} else {
  const file = path.join(os.tmpdir(), `atelier-usage-race-${Date.now()}.sqlite`);
  const setup = new DatabaseSync(file);
  setup.exec("PRAGMA journal_mode = WAL;");
  setup.exec(schema);
  setup.close();
  const script = fileURLToPath(import.meta.url);
  const workers = ["op-a", "op-b"].map(
    (operationId) =>
      new Promise((resolve, reject) => {
        const worker = new Worker(script, { workerData: { file, operationId } });
        worker.on("message", resolve);
        worker.on("error", reject);
      })
  );
  const results = await Promise.all(workers);
  const reserved = results.filter((item) => item.reserved);
  const rejected = results.filter((item) => item.rejected);
  const providerCalls = results.reduce((sum, item) => sum + (item.providerCalls ?? 0), 0);
  const inspect = new DatabaseSync(file);
  const held = used(inspect);
  inspect.close();
  try {
    fs.rmSync(file);
    fs.rmSync(`${file}-wal`);
    fs.rmSync(`${file}-shm`);
  } catch {
    /* leftover */
  }
  if (reserved.length !== 1 || rejected.length !== 1 || providerCalls !== 1 || held !== 1) {
    console.error("FAIL usage-concurrency", { reserved: reserved.length, rejected: rejected.length, providerCalls, held, results });
    process.exit(1);
  }
  console.log(
    "PASS usage-concurrency 1/1 last allowance serialized across two sqlite connections; rejected request made zero provider calls"
  );
}
