import { describe, expect, it } from "vitest";
import { firstLoginDestination, firstLoginState } from "@/lib/account/firstLogin";
import { INSTALL_COPY } from "@/lib/account/installCopy";
import { createEmptyBrief } from "@/lib/brief";
import type { Project } from "@/lib/types";

function project(partial: Partial<Project> & Pick<Project, "id" | "status" | "updatedAt">): Project {
  return {
    ownerId: "user_1",
    title: "Brief",
    brief: createEmptyBrief(),
    version: 1,
    createdAt: partial.updatedAt,
    ...partial
  };
}

describe("first-login landing", () => {
  it("preserves the intended destination through sign-in and guest review", () => {
    expect(firstLoginDestination("/project/new", false)).toBe("/project/new");
    expect(firstLoginDestination("/account", false)).toBe("/account/continue");
    expect(firstLoginDestination(null, true)).toBe("/account/adopt?next=%2Faccount%2Fcontinue");
    expect(firstLoginDestination("https://evil.example", false)).toBe("/account/continue");
  });

  it("offers useful next actions instead of an empty dashboard", () => {
    const empty = firstLoginState({ role: "client", projects: [], hasGuestDraft: false });
    expect(empty.title).toMatch(/ready/i);
    expect(empty.lede).toMatch(/does not start a subscription/i);
    expect(empty.actions[0]).toMatchObject({ href: "/project/new", kind: "primary" });
    expect(empty.actions.some((action) => action.href === "/install")).toBe(true);
    expect(empty.actions.some((action) => action.href === "/founder")).toBe(false);

    const returning = firstLoginState({
      role: "client",
      hasGuestDraft: false,
      projects: [
        project({
          id: "prj_draft",
          status: "draft",
          updatedAt: "2026-01-02T00:00:00.000Z"
        }),
        project({
          id: "prj_sent",
          status: "submitted",
          updatedAt: "2026-01-01T00:00:00.000Z"
        })
      ]
    });
    expect(returning.title).toMatch(/welcome back/i);
    expect(returning.actions[0]).toMatchObject({ href: "/project/prj_draft", kind: "primary" });
    expect(returning.actions.some((action) => action.href === "/workspace/prj_sent")).toBe(true);
  });

  it("keeps phone installation guidance practical and honest", () => {
    expect(INSTALL_COPY.android.steps.join(" ")).toMatch(/Chrome/i);
    expect(INSTALL_COPY.ios.steps.join(" ")).toMatch(/Safari/i);
    expect(INSTALL_COPY.limits.join(" ")).toMatch(/not sent/i);
    expect(INSTALL_COPY.limits.join(" ")).not.toMatch(/synced/i);
  });
});
