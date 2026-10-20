#!/usr/bin/env node
/**
 * Runs the real CompanionUsage / CompanionStudio PostgreSQL integration suite.
 * SQLite, memory, and copied SQL are not substitutes for this gate.
 */
import { spawn } from "node:child_process";

const url = process.env.ATELIER_LOCAL_POSTGRES_URL || "";
if (!url || /neon|vercel|supabase|amazonaws|railway|render/i.test(url)) {
  console.log(
    "BLOCKED usage-postgres-concurrency: no isolated local Postgres URL. Set ATELIER_LOCAL_POSTGRES_URL to a local database, then run: ATELIER_LOCAL_POSTGRES_URL=… node scripts/usage-postgres-concurrency.mjs"
  );
  process.exit(2);
}

const child = spawn(
  "pnpm",
  ["exec", "vitest", "run", "src/lib/cofounder/postgres.integration.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, ATELIER_LOCAL_POSTGRES_URL: url }
  }
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
