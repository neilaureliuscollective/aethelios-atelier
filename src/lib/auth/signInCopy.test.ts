import { describe, expect, it } from "vitest";
import { authSurfaceState, signInProviderSentence } from "./signInCopy";

describe("sign-in copy", () => {
  it("names only the providers that are actually enabled", () => {
    expect(signInProviderSentence([])).toMatch(/will appear here when they are available/i);
    expect(signInProviderSentence([{ id: "google", label: "Google" }])).toMatch(/^Sign in with Google\./);
    expect(signInProviderSentence([{ id: "google", label: "Google" }])).toMatch(/Signing in is free/);
    expect(signInProviderSentence([{ id: "google", label: "Google" }])).not.toMatch(/email/i);
    expect(
      signInProviderSentence([
        { id: "google", label: "Google" },
        { id: "email", label: "Email" }
      ])
    ).toMatch(/^Sign in with Google or Email\./);
  });

  it("distinguishes loading from unavailable authentication", () => {
    expect(authSurfaceState({ config: null, error: "" })).toBe("loading");
    expect(authSurfaceState({ config: null, error: "Sign-in options could not load." })).toBe("unavailable");
    expect(authSurfaceState({ config: { auth: { ready: false } }, error: "" })).toBe("unavailable");
    expect(authSurfaceState({ config: { auth: { ready: true } }, error: "" })).toBe("ready");
  });
});
