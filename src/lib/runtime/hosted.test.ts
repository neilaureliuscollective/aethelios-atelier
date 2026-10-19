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

  it("refuses hosted execution even when ATELIER_ISOLATED_LOCAL was accidentally copied", () => {
    const result = simulatedAuthAllowed({
      ATELIER_AUTH_ADAPTER: "simulated",
      ATELIER_ALLOW_SIMULATED_AUTH: "true",
      ATELIER_ISOLATED_LOCAL: "true",
      VERCEL: "1"
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/even if ATELIER_ISOLATED_LOCAL/);
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

  it("allows production-mode loopback tests without a hosted flag", () => {
    const result = simulatedAuthAllowed({
      NODE_ENV: "production",
      ATELIER_AUTH_ADAPTER: "simulated",
      ATELIER_ALLOW_SIMULATED_AUTH: "true",
      ATELIER_PUBLIC_ORIGIN: "http://127.0.0.1:3000"
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

  it("covers conflicting flags and missing configuration", () => {
    expect(
      simulatedAuthAllowed({
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_HOSTED: "true"
      }).allowed
    ).toBe(false);
    expect(
      simulatedAuthAllowed({
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        NETLIFY: "true"
      }).allowed
    ).toBe(false);
    expect(simulatedAuthAllowed({ ATELIER_AUTH_ADAPTER: "simulated" }).allowed).toBe(false);
    expect(
      simulatedAuthAllowed({
        ATELIER_ALLOW_SIMULATED_AUTH: "true"
      }).reason
    ).toMatch(/not simulated/);
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true"
      }).allowed
    ).toBe(false);
  });
});
