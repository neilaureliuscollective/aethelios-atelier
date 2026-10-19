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
  });
});
