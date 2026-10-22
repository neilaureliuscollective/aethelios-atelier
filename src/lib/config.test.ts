import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, publicRuntimeConfig } from "@/lib/config";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
});

describe("fail-closed configuration", () => {
  it("does not claim persistence or auth success when adapters are missing", () => {
    process.env.ATELIER_PERSISTENCE_ADAPTER = "unconfigured";
    process.env.ATELIER_AUTH_ADAPTER = "unconfigured";
    process.env.ATELIER_OPENAI_ENABLED = "false";
    const config = loadConfig();
    expect(config.persistence.ready).toBe(false);
    expect(config.auth.ready).toBe(false);
    expect(config.aurelius.ready).toBe(false);
    expect(config.billing.ready).toBe(false);
  });

  it("keeps OpenAI off even when a key is present unless explicitly enabled", () => {
    process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
    process.env.ATELIER_OPENAI_ENABLED = "false";
    process.env.OPENAI_API_KEY = "sk-test-not-used";
    const config = loadConfig();
    expect(config.aurelius.ready).toBe(false);
    expect(config.aurelius.missing).toMatch(/ATELIER_OPENAI_ENABLED/);
    const pub = publicRuntimeConfig();
    expect(pub.aurelius.ready).toBe(false);
    expect(JSON.stringify(pub)).not.toContain("sk-test");
    expect(JSON.stringify(pub)).not.toContain("299");
    expect(JSON.stringify(pub)).not.toContain("249");
    expect(pub.companion.billingActivated).toBe(false);
    expect(pub.inquiry).toBeDefined();
    expect(JSON.stringify(pub.inquiry)).not.toContain("@");
  });

  it("refuses simulated auth when hosted environment flags are present", () => {
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
    process.env.ATELIER_ALLOW_SIMULATED_AUTH = "true";
    process.env.VERCEL = "1";
    delete process.env.ATELIER_ISOLATED_LOCAL;
    const config = loadConfig();
    expect(config.auth.ready).toBe(false);
    expect(config.auth.missing).toMatch(/hosted platform/i);
  });

  it("refuses hosted simulated auth even if ATELIER_ISOLATED_LOCAL is copied", () => {
    process.env.ATELIER_AUTH_ADAPTER = "simulated";
    process.env.ATELIER_ALLOW_SIMULATED_AUTH = "true";
    process.env.ATELIER_ISOLATED_LOCAL = "true";
    process.env.VERCEL = "1";
    const config = loadConfig();
    expect(config.auth.ready).toBe(false);
    expect(config.auth.missing).toMatch(/even if ATELIER_ISOLATED_LOCAL/i);
  });

  it("does not treat sqlite or memory as ready on Vercel", () => {
    process.env.VERCEL = "1";
    process.env.ATELIER_PERSISTENCE_ADAPTER = "sqlite_local";
    const sqlite = loadConfig();
    expect(sqlite.persistence.ready).toBe(false);
    expect(sqlite.persistence.ready === false && sqlite.persistence.missing).toMatch(/postgres/i);

    process.env.ATELIER_PERSISTENCE_ADAPTER = "memory";
    const memory = loadConfig();
    expect(memory.persistence.ready).toBe(false);
    expect(memory.persistence.ready === false && memory.persistence.missing).toMatch(/ephemeral/i);
  });

  it("keeps postgres unready until a dedicated database URL is present", () => {
    process.env.VERCEL = "1";
    process.env.ATELIER_PERSISTENCE_ADAPTER = "postgres";
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    delete process.env.ATELIER_DATABASE_URL;
    const missing = loadConfig();
    expect(missing.persistence.ready).toBe(false);
    expect(missing.persistence.ready === false && missing.persistence.missing).toMatch(/DATABASE_URL/);

    process.env.POSTGRES_URL = "postgres://atelier:atelier@localhost/atelier";
    const ready = loadConfig();
    expect(ready.persistence.ready).toBe(true);
    expect(ready.persistence.adapter).toBe("postgres");
    expect(JSON.stringify(publicRuntimeConfig())).not.toContain("postgres://atelier");
  });
});
