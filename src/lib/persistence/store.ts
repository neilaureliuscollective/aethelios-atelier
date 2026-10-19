import "server-only";
import { loadConfig } from "@/lib/config";
import { UnconfiguredError } from "@/lib/domain/errors";
import type { PersistenceAdapter } from "@/lib/persistence/adapter";
import { MemoryPersistence } from "@/lib/persistence/memory";
import { SqlitePersistence } from "@/lib/persistence/sqlite";
import { seedSimulatedUsers } from "@/lib/auth/identities";

let adapter: PersistenceAdapter | null = null;

export function getStore(): PersistenceAdapter {
  if (adapter) return adapter;
  const config = loadConfig();
  if (!config.persistence.ready) {
    throw new UnconfiguredError(
      "Persistence is not configured. Set ATELIER_PERSISTENCE_ADAPTER to sqlite_local or memory. No hosted database is connected."
    );
  }
  const next: PersistenceAdapter =
    config.persistence.adapter === "memory"
      ? new MemoryPersistence()
      : new SqlitePersistence(config.persistence.sqlitePath ?? ".data/atelier.sqlite");
  seedSimulatedUsers(next, config.founderEmailList);
  adapter = next;
  return next;
}

export function setStoreForTests(next: PersistenceAdapter | null) {
  adapter = next;
}
