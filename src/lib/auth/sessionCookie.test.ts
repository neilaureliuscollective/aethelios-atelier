import { describe, expect, it } from "vitest";
import { isLoopbackRehearsalOrigin, sessionCookieSecure } from "@/lib/auth/sessionCookie";

describe("session cookie Secure flag", () => {
  it("keeps Secure cookies on production HTTPS and nonlocal HTTP", () => {
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "https://atelier.example" })).toBe(true);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "https://localhost:3010" })).toBe(true);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "http://example.com" })).toBe(true);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "http://192.168.1.20:3010" })).toBe(true);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "http://localhost.evil.example" })).toBe(true);
    expect(sessionCookieSecure({ nodeEnv: "production" })).toBe(true);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "not-a-url" })).toBe(true);
  });

  it("disables Secure only for verified local loopback rehearsal origins", () => {
    expect(isLoopbackRehearsalOrigin("http://127.0.0.1:3010")).toBe(true);
    expect(isLoopbackRehearsalOrigin("http://localhost:3010")).toBe(true);
    expect(isLoopbackRehearsalOrigin("http://[::1]:3010")).toBe(true);
    expect(isLoopbackRehearsalOrigin("http://example.com")).toBe(false);
    expect(isLoopbackRehearsalOrigin("https://localhost")).toBe(false);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "http://127.0.0.1:3010" })).toBe(false);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "http://localhost" })).toBe(false);
    expect(sessionCookieSecure({ nodeEnv: "production", publicOrigin: "http://[::1]" })).toBe(false);
    expect(sessionCookieSecure({ nodeEnv: "development", publicOrigin: "https://atelier.example" })).toBe(false);
  });
});
