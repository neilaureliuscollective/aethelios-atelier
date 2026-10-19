import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("hosted postgres schema", () => {
  it("declares the Atelier tables without sharing an Aethelios production name", () => {
    const sql = readFileSync(path.resolve("src/lib/persistence/schema.postgres.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS users/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS projects/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS submissions/);
    expect(sql).toMatch(/reviewed_version/);
    expect(sql).toMatch(/payload_hash/);
    expect(sql.toLowerCase()).not.toContain("aethelios_production");
    expect(sql).toMatch(/Never apply this to the Aethelios production database/i);
  });
});
