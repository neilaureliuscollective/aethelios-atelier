import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("hosted postgres schema", () => {
  it("declares the Atelier tables without sharing an Aethelios production name", () => {
    const sql = readFileSync(path.resolve("src/lib/persistence/schema.postgres.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS users/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS projects/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS submissions/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS proposals/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS delivery_versions/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS delivery_milestones/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS businesses/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS user_initial_business/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS guest_work_claims/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS business_confirmations/);
    expect(sql).toMatch(/projects_guest_draft_idx/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS work_items/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS studio_assets/);
    expect(sql).toMatch(/reviewed_version/);
    expect(sql).toMatch(/payload_hash/);
    expect(sql.toLowerCase()).not.toContain("aethelios_production");
    expect(sql).toMatch(/Never apply this to the Aethelios production database/i);
  });
});
