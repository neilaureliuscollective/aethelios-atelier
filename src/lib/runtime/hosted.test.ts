import { describe, expect, it } from "vitest";
import { simulatedAuthAllowed } from "@/lib/runtime/hosted";

describe("isolated-local simulator gate", () => {
  it("refuses simulated auth on a hosted platform even if adapter settings are copied", () => {
    const result = simulatedAuthAllowed({
      ATELIER_AUTH_ADAPTER: "simulated",
      ATELIER_ALLOW_SIMULATED_AUTH: "true",
      VERCEL: "1"
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/hosted platform/);
  });

  it("allows local production-mode testing when the isolated-local gate is explicit", () => {
    const result = simulatedAuthAllowed({
      NODE_ENV: "production",
      ATELIER_AUTH_ADAPTER: "simulated",
      ATELIER_ALLOW_SIMULATED_AUTH: "true",
      ATELIER_ISOLATED_LOCAL: "true"
    });
    expect(result.allowed).toBe(true);
  });

  it("does not treat the founder email list as production authentication", () => {
    const result = simulatedAuthAllowed({
      ATELIER_AUTH_ADAPTER: "simulated",
      ATELIER_FOUNDER_EMAILS: "neil.local@atelier.invalid",
      VERCEL: "1"
    });
    expect(result.allowed).toBe(false);
  });
});
