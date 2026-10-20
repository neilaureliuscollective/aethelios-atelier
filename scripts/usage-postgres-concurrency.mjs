#!/usr/bin/env node
/**
 * Two independent PostgreSQL connections compete for the last image allowance.
 * SQLite/memory cannot establish this gate. Skips when no isolated local URL is set.
 */
import postgres from "postgres";

const url = process.env.ATELIER_LOCAL_POSTGRES_URL || process.env.ATELIER_DATABASE_URL || "";
if (!url || /neon|vercel|supabase|amazonaws|railway|render/i.test(url)) {
  console.log(
    "SKIP usage-postgres-concurrency: no isolated local Postgres URL. Set ATELIER_LOCAL_POSTGRES_URL to a local database to run this gate."
  );
  process.exit(2);
}

const schema = `
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  units INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  operation_id TEXT,
  status TEXT,
  expires_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_operation_idx
  ON usage_events (business_id, operation_id)
  WHERE operation_id IS NOT NULL;
`;

async function reserve(sql, operationId) {
  let providerCalls = 0;
  try {
    return await sql.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${"biz_1:image:period"}))`;
      const rows = await tx`SELECT units, status FROM usage_events WHERE business_id = ${"biz_1"} AND kind = ${"image"}`;
      const used = rows
        .filter((row) => row.status === "held" || row.status === "settled")
        .reduce((sum, row) => sum + Number(row.units), 0);
      if (used + 1 > 1) {
        return { rejected: true, providerCalls: 0 };
      }
      await tx`
        INSERT INTO usage_events(id,business_id,user_id,kind,units,created_at,operation_id,status)
        VALUES (${`use_${operationId}`}, ${"biz_1"}, ${"user_1"}, ${"image"}, ${1}, ${new Date().toISOString()}, ${operationId}, ${"held"})
      `;
      providerCalls = 1;
      return { reserved: true, providerCalls };
    });
  } catch (error) {
    return { rejected: true, providerCalls: 0, error: String(error) };
  }
}

const a = postgres(url, { max: 1, prepare: false, ssl: false });
const b = postgres(url, { max: 1, prepare: false, ssl: false });
try {
  await a.unsafe(schema);
  await a`DELETE FROM usage_events WHERE business_id = ${"biz_1"}`;
  const [first, second] = await Promise.all([reserve(a, "op-a"), reserve(b, "op-b")]);
  const reserved = [first, second].filter((item) => item.reserved);
  const rejected = [first, second].filter((item) => item.rejected);
  const ok = reserved.length === 1 && rejected.length === 1 && rejected[0].providerCalls === 0;
  if (!ok) {
    console.error("FAIL usage-postgres-concurrency", { first, second });
    process.exit(1);
  }
  console.log("PASS usage-postgres-concurrency 1/1 last allowance serialized; rejected request made zero provider calls");
} finally {
  await a.end();
  await b.end();
}
