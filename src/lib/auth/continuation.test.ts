import { describe, expect, it } from "vitest";
import { accountLink, afterAdoption, signInDestination } from "./continuation";

describe("account to saved-work continuity", () => {
  const exact = "/companion/studio?workItemId=work_123&draftId=draft_456#composition";

  it("restores the exact Studio item with its complete query and fragment", () => {
    const signIn = new URL(accountLink(exact), "https://atelier.test");
    expect(signIn.searchParams.get("next")).toBe(exact);
    expect(signInDestination(signIn.searchParams.get("next"), false)).toBe(exact);
  });

  it("carries an exact destination through explicit guest review and adoption", () => {
    const review = new URL(signInDestination(exact, true), "https://atelier.test");
    expect(review.pathname).toBe("/account/adopt");
    expect(afterAdoption(review.searchParams.get("next"), "project_new")).toBe(exact);
  });

  it("keeps a public commission adoption in its actual project", () => {
    expect(afterAdoption(null, "project_new")).toBe("/workspace/project_new");
    expect(afterAdoption("/account", "project_new")).toBe("/workspace/project_new");
    expect(signInDestination("/account/adopt?next=%2Fcompanion", true)).toBe("/account/adopt?next=%2Fcompanion");
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/\n/evil.test", "/\t/evil.test"])("rejects external destination %s", (next) => {
    expect(signInDestination(next, false)).toBe("/account");
    expect(afterAdoption(next, "project_new")).toBe("/workspace/project_new");
  });
});
