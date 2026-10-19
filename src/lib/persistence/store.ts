import "server-only";
import { loadConfig } from "@/lib/config";
import { UnconfiguredError } from "@/lib/domain/errors";
import { seedSimulatedUsers } from "@/lib/auth/identities";
import { simulatedAuthAllowed } from "@/lib/runtime/hosted";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";

let adapter: PersistenceAdapter | null = null;
let initializing: Promise<PersistenceAdapter> | null = null;

async function createStore(): Promise<PersistenceAdapter> {
  const config = loadConfig();
  if (!config.persistence.ready) {
    throw new UnconfiguredError(
      config.persistence.missing
        ? `Persistence is not configured. ${config.persistence.missing}`
        : "Persistence is not configured. Set ATELIER_PERSISTENCE_ADAPTER to sqlite_local, memory, or postgres. No hosted database is connected."
    );
  }

  if (config.persistence.adapter === "memory") {
    const { MemoryPersistence } = await import("@/lib/persistence/memory");
    const next = new MemoryPersistence();
    if (simulatedAuthAllowed().allowed) {
      await seedSimulatedUsers(next, config.founderEmailList);
    }
    return next;
  }

  if (config.persistence.adapter === "postgres") {
    const { PostgresPersistence } = await import("@/lib/persistence/postgres");
    if (!("databaseUrl" in config.persistence) || !config.persistence.databaseUrl) {
      throw new UnconfiguredError(
        "Postgres persistence requires DATABASE_URL, POSTGRES_URL, or ATELIER_DATABASE_URL."
      );
    }
    const next = new PostgresPersistence(config.persistence.databaseUrl);
    await next.initialize();
    return next;
  }

  const { SqlitePersistence } = await import("@/lib/persistence/sqlite");
  const sqlitePath =
    "sqlitePath" in config.persistence && config.persistence.sqlitePath
      ? config.persistence.sqlitePath
      : ".data/atelier.sqlite";
  const next = new SqlitePersistence(sqlitePath);
  if (simulatedAuthAllowed().allowed) {
    await seedSimulatedUsers(next, config.founderEmailList);
  }
  return next;
}

export async function getStore(): Promise<PersistenceAdapter> {
  if (adapter) return adapter;
  if (initializing) return initializing;
  initializing = createStore();
  try {
    adapter = await initializing;
    return adapter;
  } finally {
    initializing = null;
  }
}

export function setStoreForTests(next: PersistenceAdapter | null) {
  adapter = next;
  initializing = null;
}
