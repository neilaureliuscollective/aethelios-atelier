import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
import { describe, expect, it } from "vitest";
import { SqliteCompanionStore } from "./companionSqlite";
import { brandKitFromSelection } from "@/lib/cofounder/brandKit";
import { confirmSelection, createDraft } from "@/lib/discovery/selection";
import type { StudioDraft } from "@/lib/cofounder/types";
import { COMPANION_SQL } from "./companionStore";

describe("Studio identity SQLite persistence", () => {
  it("migrates legacy drafts then preserves identity through reopen, update and CAS", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("CREATE TABLE projects(id TEXT PRIMARY KEY)");
    db.exec(COMPANION_SQL.replace("  direction TEXT,\n  brand_kit_json TEXT,\n  palette_json TEXT,\n  layout_version INTEGER", "  legacy_placeholder TEXT"));
    const store = new SqliteCompanionStore(db);
    const kit = brandKitFromSelection(confirmSelection(createDraft({ businessName: "Cedar" }), null), { mode: "new_brand", locked: true, retainedAssets: [] })!;
    const draft: StudioDraft = { id: "d", businessId: "b", workItemId: "w", layout: "square_announcement", layoutVersion: 2, layers: [], direction: "Exact selected direction", brandKit: kit, palette: {canvas: "#ffffff", ink: "#000000", muted: "#333333", accent: "#555555"}, saveRevision: 1, createdAt: "now", updatedAt: "now" };
    db.prepare("INSERT INTO studio_drafts(id,business_id,work_item_id,layout,layers_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").run("legacy", "legacy-business", "w", "square_announcement", "[]", "now", "now");
    expect(store.getStudioDraft("legacy")?.layoutVersion).toBe(1);
    store.addStudioDraft(draft);
    const reopened = new SqliteCompanionStore(db);
    expect(reopened.getStudioDraft("d")).toEqual(draft);
    expect(reopened.listStudioDrafts("b")[0]?.brandKit).toEqual(kit);
    const revised = { ...draft, direction: "Refined direction", saveRevision: 2, updatedAt: "later" };
    expect(reopened.compareAndSwapStudioDraft(revised, 1)).toEqual(revised);
    expect(reopened.compareAndSwapStudioDraft({ ...draft, direction: "Stale" }, 1)).toBeNull();
    expect(reopened.getStudioDraft("d")).toEqual(revised);
    reopened.updateStudioDraft({ ...revised, selectedAssetId: "asset", saveRevision: 3 });
    expect(reopened.getStudioDraft("d")).toEqual({ ...revised, selectedAssetId: "asset", saveRevision: 3 });
    db.close();
  });
});

// This checks query serialization only; hosted Postgres execution is covered by
// the opt-in integration suite and is not claimed by this local regression.
describe("Studio identity Postgres query contract", () => {
  it("includes snapshot columns in insert/update/CAS and retains the CAS predicate", async () => {
    const { PostgresCompanionStore } = await import("./companionPostgres");
    const calls: { sql: string; values: unknown[] }[] = [];
    const query = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: strings.join("?"), values }); return [];
    };
    const store = new PostgresCompanionStore(() => query as unknown as import("postgres").Sql);
    const kit = brandKitFromSelection(confirmSelection(createDraft(), null), { mode: "existing_brand", locked: true, retainedAssets: [] })!;
    const draft: StudioDraft = { id: "d", businessId: "b", workItemId: "w", layout: "square_announcement", layoutVersion: 2, layers: [], direction: "Preserved", brandKit: kit, palette: {canvas: "#fff", ink: "#000", muted: "#333", accent: "#555"}, saveRevision: 2, createdAt: "now", updatedAt: "now" };
    await store.addStudioDraft(draft);
    await store.updateStudioDraft(draft);
    await store.compareAndSwapStudioDraft(draft, 1);
    for (const call of calls) {
      expect(call.sql).toContain("brand_kit_json"); expect(call.sql).toContain("palette_json");
      expect(call.values).toContain(JSON.stringify(kit)); expect(call.values).toContain("Preserved");
    }
    expect(calls[2]?.sql).toContain("AND save_revision = ?");
    expect(calls[2]?.values.at(-1)).toBe(1);
  });
});
