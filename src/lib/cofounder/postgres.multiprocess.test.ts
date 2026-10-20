import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { CompanionWorkspace } from "@/lib/cofounder/workspace";
import { PostgresPersistence } from "@/lib/persistence/postgres";
import type { User } from "@/lib/types";

const url = process.env.ATELIER_LOCAL_POSTGRES_URL || "";
const isolated = Boolean(url) && !/neon|vercel|supabase|amazonaws|railway|render/i.test(url);

async function waitForFile(file: string, timeoutMs = 20_000) {
  const started = Date.now();
  while (!existsSync(file)) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${file}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

function runWorker(env: Record<string, string>) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const child = spawn(
      "pnpm",
      ["exec", "vitest", "run", "--no-file-parallelism", "src/lib/cofounder/postgres.worker.test.ts"],
      {
        cwd: process.cwd(),
        env: { ...process.env, ...env, VITEST: "true" },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("exit", (code) => {
      const match = stdout.split("\n").reverse().find((line) => line.startsWith("WORKER_RESULT:"));
      if (match) {
        resolve(JSON.parse(match.slice("WORKER_RESULT:".length)) as Record<string, unknown>);
        return;
      }
      const file = `${env.ATELIER_PG_BARRIER}/result-${env.ATELIER_PG_ROLE}.json`;
      if (existsSync(file)) {
        resolve(JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>);
        return;
      }
      reject(new Error(`worker ${env.ATELIER_PG_ROLE} exited ${code}\n${stdout}\n${stderr}`));
    });
  });
}

describe.skipIf(!isolated)("PostgreSQL multiprocess companion integration", () => {
  afterEach(() => {
    delete process.env.ATELIER_PLAN_IMAGE_LIMIT;
    delete process.env.ATELIER_MAX_CONCURRENT_GENERATIONS;
  });

  async function prepare() {
    const barrier = mkdtempSync(path.join(tmpdir(), "atelier-pg-"));
    const store = new PostgresPersistence(url);
    await store.initialize();
    await store.resetForTests();
    await seedSimulatedUsers(store, ["neil.local@atelier.invalid"]);
    const owner = (await store.getUserByEmail("owner.local@atelier.invalid")) as User;
    const ctx = await new CompanionWorkspace(store).ensureForUser(owner);
    const studio = new CompanionStudio(store);
    const first = await studio.createFromCopy(ctx.business.id, owner, { headline: "Process A" });
    const second = await studio.createFromCopy(ctx.business.id, owner, { headline: "Process B" });
    writeFileSync(
      path.join(barrier, "context.json"),
      JSON.stringify({
        businessId: ctx.business.id,
        draftA: first.draft.id,
        draftB: second.draft.id,
        ownerEmail: owner.email
      })
    );
    return { barrier, store, owner, ctx, draftA: first.draft.id, draftB: second.draft.id };
  }

  it("lets only one separate process take the last pending slot", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "1";
    const { barrier } = await prepare();
    const pendingA = runWorker({
      ATELIER_LOCAL_POSTGRES_URL: url,
      ATELIER_PG_BARRIER: barrier,
      ATELIER_PG_TASK: "generate-slot",
      ATELIER_PG_ROLE: "a",
      ATELIER_PG_HOLD: "1",
      ATELIER_PG_OP: "mp-slot-a",
      ATELIER_PLAN_IMAGE_LIMIT: "20",
      ATELIER_MAX_CONCURRENT_GENERATIONS: "1"
    });
    await waitForFile(path.join(barrier, "a-started"));
    const lost = await runWorker({
      ATELIER_LOCAL_POSTGRES_URL: url,
      ATELIER_PG_BARRIER: barrier,
      ATELIER_PG_TASK: "generate-slot",
      ATELIER_PG_ROLE: "b",
      ATELIER_PG_DRAFT: "b",
      ATELIER_PG_OP: "mp-slot-b",
      ATELIER_PLAN_IMAGE_LIMIT: "20",
      ATELIER_MAX_CONCURRENT_GENERATIONS: "1"
    });
    expect(lost.ok).toBe(false);
    expect(lost.name).toBe("LimitError");
    writeFileSync(path.join(barrier, "continue"), "1");
    const won = await pendingA;
    expect(won.ok).toBe(true);
    const calls = readFileSync(path.join(barrier, "calls.log"), "utf8").trim().split("\n").length;
    expect(calls).toBe(1);
  }, 60_000);

  it("lets only one separate process consume the last allowance and reuses one operation id", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "1";
    process.env.ATELIER_MAX_CONCURRENT_GENERATIONS = "2";
    const { barrier } = await prepare();
    const shared = {
      ATELIER_LOCAL_POSTGRES_URL: url,
      ATELIER_PG_BARRIER: barrier,
      ATELIER_PG_TASK: "reserve",
      ATELIER_PLAN_IMAGE_LIMIT: "1",
      ATELIER_MAX_CONCURRENT_GENERATIONS: "2"
    };
    const [one, two] = await Promise.all([
      runWorker({ ...shared, ATELIER_PG_ROLE: "a", ATELIER_PG_OP: "mp-last-a" }),
      runWorker({ ...shared, ATELIER_PG_ROLE: "b", ATELIER_PG_OP: "mp-last-b" })
    ]);
    expect([one, two].filter((item) => item.ok).length).toBe(1);
    expect([one, two].some((item) => item.name === "LimitError")).toBe(true);
  }, 60_000);

  it("reuses one operation id across separate processes without a second hold", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "20";
    const { barrier } = await prepare();
    const shared = {
      ATELIER_LOCAL_POSTGRES_URL: url,
      ATELIER_PG_BARRIER: barrier,
      ATELIER_PG_TASK: "reserve",
      ATELIER_PLAN_IMAGE_LIMIT: "20"
    };
    const first = await runWorker({ ...shared, ATELIER_PG_ROLE: "c", ATELIER_PG_OP: "mp-dup" });
    const again = await runWorker({ ...shared, ATELIER_PG_ROLE: "d", ATELIER_PG_OP: "mp-dup" });
    expect(first.ok).toBe(true);
    expect(again.ok).toBe(true);
    expect(again.id).toBe(first.id);
    expect(again.reused).toBe(true);
  }, 60_000);

  it("refuses a retry in another process after the last allowance is taken", async () => {
    process.env.ATELIER_PLAN_IMAGE_LIMIT = "1";
    const { barrier, store, owner, ctx, draftA } = await prepare();
    const usage = new CompanionUsage(store);
    const held = await usage.reserve(ctx.business.id, owner, "image", 1, { draftId: draftA }, "mp-retry-a");
    await usage.release(held);
    const consumed = await usage.reserve(ctx.business.id, owner, "image", 1, { draftId: "other" }, "mp-retry-b");
    await usage.settle(consumed);
    const retry = await runWorker({
      ATELIER_LOCAL_POSTGRES_URL: url,
      ATELIER_PG_BARRIER: barrier,
      ATELIER_PG_TASK: "reserve",
      ATELIER_PG_ROLE: "retry",
      ATELIER_PG_OP: "mp-retry-a",
      ATELIER_PG_META_DRAFT: draftA,
      ATELIER_PLAN_IMAGE_LIMIT: "1"
    });
    expect(retry.ok).toBe(false);
    expect(retry.name).toBe("LimitError");
  }, 60_000);

  it("keeps a stale settle from another process off a newer attempt", async () => {
    const { barrier, store, owner, ctx } = await prepare();
    const usage = new CompanionUsage(store);
    const first = await usage.reserve(ctx.business.id, owner, "image", 1, { draftId: "d1" }, "mp-fence");
    await usage.release(first);
    const retry = await usage.reserve(ctx.business.id, owner, "image", 1, { draftId: "d1" }, "mp-fence");
    writeFileSync(path.join(barrier, "stale-reservation.json"), JSON.stringify(first.event));
    const stale = await runWorker({
      ATELIER_LOCAL_POSTGRES_URL: url,
      ATELIER_PG_BARRIER: barrier,
      ATELIER_PG_TASK: "settle-stale",
      ATELIER_PG_ROLE: "stale"
    });
    expect(stale.status).toBe("held");
    expect(stale.attempt).toBe(2);
    expect((await store.companion.getUsageEvent(retry.event.id))?.status).toBe("held");
  }, 60_000);
});
