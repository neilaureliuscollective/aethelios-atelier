import { appendFileSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { it } from "vitest";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { encodeSolidPng } from "@/lib/cofounder/png";
import { PostgresPersistence } from "@/lib/persistence/postgres";
import type { AuthContext, User } from "@/lib/types";

function barrierDir() {
  return process.env.ATELIER_PG_BARRIER || "";
}

function writeStarted(name: string) {
  writeFileSync(`${barrierDir()}/${name}`, "1");
}

async function waitFor(name: string, timeoutMs = 20_000) {
  const started = Date.now();
  while (!existsSync(`${barrierDir()}/${name}`)) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${name}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function recordCall() {
  appendFileSync(`${barrierDir()}/calls.log`, "1\n");
}

function emit(result: Record<string, unknown>) {
  writeFileSync(`${barrierDir()}/result-${process.env.ATELIER_PG_ROLE}.json`, JSON.stringify(result));
  console.log(`WORKER_RESULT:${JSON.stringify(result)}`);
}

function context() {
  return JSON.parse(readFileSync(`${barrierDir()}/context.json`, "utf8")) as {
    businessId: string;
    draftA: string;
    draftB: string;
    ownerEmail: string;
  };
}

function authFor(user: User): AuthContext {
  return {
    user,
    session: {
      id: `sess_${user.id}_${process.env.ATELIER_PG_ROLE}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60_000).toISOString()
    },
    adapter: "simulated"
  };
}

it.skipIf(!process.env.ATELIER_PG_TASK)("runs one isolated PostgreSQL worker task", async () => {
  const task = process.env.ATELIER_PG_TASK || "";
  const url = process.env.ATELIER_LOCAL_POSTGRES_URL || "";
  const store = new PostgresPersistence(url);
  await store.initialize();
  const ctx = context();
  const owner = (await store.getUserByEmail(ctx.ownerEmail)) as User;
  const auth = authFor(owner);
  await store.createSession(auth.session);
  const usage = new CompanionUsage(store);
  const provider = {
    async generate() {
      recordCall();
      writeStarted(`${process.env.ATELIER_PG_ROLE}-started`);
      if (process.env.ATELIER_PG_HOLD === "1") {
        await waitFor("continue");
      }
      return { bytes: encodeSolidPng(32, 32), mime: "image/png", model: "pg-worker" };
    },
    async edit() {
      return this.generate({ prompt: "edit" });
    }
  };
  const studio = new CompanionStudio(store).withImageProvider(provider);
  try {
    if (task === "generate-slot") {
      const result = await studio.generate(ctx.businessId, owner, auth, {
        draftId: process.env.ATELIER_PG_DRAFT === "b" ? ctx.draftB : ctx.draftA,
        prompt: String(process.env.ATELIER_PG_ROLE),
        idempotencyKey: process.env.ATELIER_PG_OP || `slot-${process.env.ATELIER_PG_ROLE}`
      });
      emit({ ok: true, status: result.asset.status, applied: result.applied });
    } else if (task === "reserve") {
      const reservation = await usage.reserve(
        ctx.businessId,
        owner,
        "image",
        1,
        { draftId: process.env.ATELIER_PG_META_DRAFT || ctx.draftA },
        process.env.ATELIER_PG_OP || `op-${process.env.ATELIER_PG_ROLE}`
      );
      emit({ ok: true, id: reservation.event.id, reused: Boolean(reservation.reused), attempt: reservation.event.attempt });
    } else if (task === "settle-stale") {
      const payload = JSON.parse(readFileSync(`${barrierDir()}/stale-reservation.json`, "utf8"));
      const latest = await usage.settle({ event: payload });
      emit({ ok: true, status: latest.status, attempt: latest.attempt });
    } else {
      emit({ ok: false, error: `unknown task ${task}` });
    }
  } catch (error) {
    emit({
      ok: false,
      name: error instanceof Error ? error.constructor.name : "Error",
      message: error instanceof Error ? error.message : String(error)
    });
  }
}, 30_000);
