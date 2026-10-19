import { describe, expect, it } from "vitest";
import {
  authjsAuthAllowed,
  emailCaptureAllowed,
  hostedEphemeralPersistenceReason,
  parseOriginHostname,
  readDatabaseUrl,
  simulatedAuthAllowed
} from "@/lib/runtime/hosted";

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

  it("refuses Auth.js email capture on hosted platforms and without a secret or provider", () => {
    expect(
      emailCaptureAllowed({
        ATELIER_AUTH_EMAIL_CAPTURE: "true",
        VERCEL: "1"
      }).allowed
    ).toBe(false);
    expect(
      authjsAuthAllowed({
        ATELIER_AUTH_ADAPTER: "authjs",
        VERCEL: "1"
      }).allowed
    ).toBe(false);
    expect(
      authjsAuthAllowed({
        ATELIER_AUTH_ADAPTER: "authjs",
        AUTH_SECRET: "short",
        AUTH_GOOGLE_ID: "id",
        AUTH_GOOGLE_SECRET: "secret"
      }).reason
    ).toMatch(/32\+/);
    expect(
      authjsAuthAllowed({
        ATELIER_AUTH_ADAPTER: "authjs",
        AUTH_SECRET: "x".repeat(32),
        VERCEL: "1"
      }).allowed
    ).toBe(false);
    const google = authjsAuthAllowed({
      ATELIER_AUTH_ADAPTER: "authjs",
      AUTH_SECRET: "x".repeat(32),
      AUTH_GOOGLE_ID: "google-id",
      AUTH_GOOGLE_SECRET: "google-secret",
      VERCEL: "1"
    });
    expect(google.allowed).toBe(true);
    expect(google.providers.map((provider) => provider.id)).toEqual(["google"]);
    const capture = authjsAuthAllowed({
      ATELIER_AUTH_ADAPTER: "authjs",
      AUTH_SECRET: "x".repeat(32),
      ATELIER_AUTH_EMAIL_CAPTURE: "true",
      ATELIER_ISOLATED_LOCAL: "true",
      ATELIER_PUBLIC_ORIGIN: "http://127.0.0.1:3000"
    });
    expect(capture.allowed).toBe(true);
    expect(capture.providers.some((provider) => provider.capture)).toBe(true);
  });

  it("refuses sqlite and memory on Vercel and prefers dedicated postgres URLs", () => {
    expect(hostedEphemeralPersistenceReason("sqlite_local", { VERCEL: "1" })).toMatch(/postgres/i);
    expect(hostedEphemeralPersistenceReason("memory", { VERCEL: "1" })).toMatch(/ephemeral/i);
    expect(hostedEphemeralPersistenceReason("postgres", { VERCEL: "1" })).toBeNull();
    expect(hostedEphemeralPersistenceReason("sqlite_local", {})).toBeNull();
    expect(
      readDatabaseUrl({
        ATELIER_DATABASE_URL: "postgres://dedicated",
        POSTGRES_URL: "postgres://vercel",
        DATABASE_URL: "postgres://generic"
      })
    ).toBe("postgres://dedicated");
    expect(readDatabaseUrl({ POSTGRES_URL: "postgres://vercel", DATABASE_URL: "postgres://generic" })).toBe(
      "postgres://vercel"
    );
  });
});
