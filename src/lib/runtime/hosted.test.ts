import { describe, expect, it } from "vitest";
import { parseOriginHostname, simulatedAuthAllowed } from "@/lib/runtime/hosted";

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
      ATELIER_PUBLIC_ORIGIN: "http://localhost:3000",
      VERCEL: "1"
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/even if ATELIER_ISOLATED_LOCAL/);
  });

  it("requires both isolated-local and an exact loopback hostname in production", () => {
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true"
      }).allowed
    ).toBe(false);
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_PUBLIC_ORIGIN: "http://127.0.0.1:3000"
      }).allowed
    ).toBe(false);
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "http://127.0.0.1:3000"
      }).allowed
    ).toBe(true);
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "http://localhost:3000"
      }).allowed
    ).toBe(true);
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "http://[::1]:3000"
      }).allowed
    ).toBe(true);
  });

  it("does not treat substring localhost hosts or malformed origins as loopback", () => {
    expect(parseOriginHostname("http://localhost.example.com")).toBe("localhost.example.com");
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "http://localhost.example.com"
      }).allowed
    ).toBe(false);
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "not a url"
      }).allowed
    ).toBe(false);
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "http://"
      }).allowed
    ).toBe(false);
  });

  it("does not treat the founder email list as production authentication", () => {
    const result = simulatedAuthAllowed({
      ATELIER_AUTH_ADAPTER: "simulated",
      ATELIER_FOUNDER_EMAILS: "neil.local@atelier.invalid",
      VERCEL: "1"
    });
    expect(result.allowed).toBe(false);
  });

  it("covers conflicting flags, missing configuration, and non-loopback origins", () => {
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
    expect(
      simulatedAuthAllowed({
        NODE_ENV: "production",
        ATELIER_AUTH_ADAPTER: "simulated",
        ATELIER_ALLOW_SIMULATED_AUTH: "true",
        ATELIER_ISOLATED_LOCAL: "true",
        ATELIER_PUBLIC_ORIGIN: "https://atelier.example.com"
      }).allowed
    ).toBe(false);
  });
});
