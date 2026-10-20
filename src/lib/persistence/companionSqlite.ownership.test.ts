import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
import { describe, expect, it } from "vitest";
import { SqliteCompanionStore } from "./companionSqlite";

describe("sqlite guest work ownership", () => {
  it("inserts selection ownership once and refuses a second owner", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY)");
    const store = new SqliteCompanionStore(db);
    const first = store.claimGuestWorkOwner({
      guestWorkId: "dsel_sqlite",
      ownerId: "user_a",
      createdAt: "2026-10-20T00:00:00.000Z"
    });
    const second = store.claimGuestWorkOwner({
      guestWorkId: "dsel_sqlite",
      ownerId: "user_b",
      createdAt: "2026-10-20T00:00:01.000Z"
    });
    expect(first.ownerId).toBe("user_a");
    expect(second.ownerId).toBe("user_a");
    expect(store.getGuestWorkOwner("dsel_sqlite")?.ownerId).toBe("user_a");
    const other = store.claimGuestWorkOwner({
      guestWorkId: "dsel_sqlite_other",
      ownerId: "user_b",
      createdAt: "2026-10-20T00:00:02.000Z"
    });
    expect(other.ownerId).toBe("user_b");
    db.close();
  });
});
