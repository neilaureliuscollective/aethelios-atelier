import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyBriefContext, applyClientValue, createEmptyBrief, normalizeBrief } from "@/lib/brief";
import {
  briefDifferences,
  briefsEqual,
  resolvedBriefContext,
  wordingMatchesMessage
} from "@/lib/client/briefDiff";
import { DraftSession } from "@/lib/client/draftSession";
import type { OperationIdentity } from "@/lib/client/operationIdentity";
import { emptyCommissionContext } from "@/lib/commissionContext";

function identity(overrides: Partial<OperationIdentity> = {}): OperationIdentity {
  return { ownerId: "owner-a", projectId: "prj-1", generation: 1, signOutEpoch: 0, ...overrides };
}

describe("brief context comparison", () => {
  it("shows purpose and every relevant context field when only context changed", () => {
    const server = createEmptyBrief();
    const local = applyBriefContext(createEmptyBrief(), {
      purpose: "professional_workflow",
      route: "custom_project",
      exampleId: "follow_up_workspace",
      bookingNeeded: false
    });
    expect(briefsEqual(local, server)).toBe(false);
    const diffs = briefDifferences(local, server);
    expect(diffs.map((item) => item.key)).toEqual(["purpose", "route", "exampleId", "bookingNeeded"]);
    expect(diffs.find((item) => item.key === "purpose")).toMatchObject({
      label: "Project kind",
      local: "A professional workflow",
      server: "Not specified"
    });
    expect(diffs.find((item) => item.key === "route")).toMatchObject({
      local: "Custom project",
      server: "Not specified"
    });
    expect(diffs.find((item) => item.key === "exampleId")).toMatchObject({
      local: "Follow-up workspace",
      server: "Not specified"
    });
    expect(diffs.find((item) => item.key === "bookingNeeded")).toMatchObject({
      local: "No",
      server: "Not specified"
    });
    expect(wordingMatchesMessage(diffs)).toBeNull();
  });

  it("does not claim the wording matches when only purpose changed", () => {
    const server = applyBriefContext(createEmptyBrief(), { purpose: "business", route: "business" });
    const local = applyBriefContext(createEmptyBrief(), { purpose: "personal", route: "business" });
    expect(local.vision.value).toBe(server.vision.value);
    expect(briefsEqual(local, server)).toBe(false);
    const diffs = briefDifferences(local, server);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      key: "purpose",
      local: "A personal utility",
      server: "A business commission"
    });
    expect(wordingMatchesMessage(diffs)).toBeNull();
  });

  it("treats older briefs without context as the normalized empty defaults", () => {
    const legacy = normalizeBrief({
      vision: { key: "vision", value: "A calm studio site.", provenance: "client_statement" }
    });
    expect(legacy.context).toBeUndefined();
    expect(resolvedBriefContext(legacy)).toEqual(emptyCommissionContext());

    const explicitEmpty = applyBriefContext(normalizeBrief({
      vision: { key: "vision", value: "A calm studio site.", provenance: "client_statement" }
    }), emptyCommissionContext());
    expect(briefsEqual(legacy, explicitEmpty)).toBe(true);
    expect(briefDifferences(legacy, explicitEmpty)).toEqual([]);
    expect(wordingMatchesMessage(briefDifferences(legacy, explicitEmpty))).toMatch(/wording matches/i);
  });

  it("treats equivalent normalized values as equal", () => {
    const a = normalizeBrief({
      vision: { key: "vision", value: "Follow-ups.", provenance: "client_statement" },
      context: {
        version: 1,
        purpose: "professional_workflow",
        route: "custom_project",
        exampleId: "not-a-real-example",
        bookingNeeded: "maybe"
      }
    });
    const b = applyBriefContext(createEmptyBrief(), {
      purpose: "professional_workflow",
      route: "custom_project"
    });
    b.vision.value = "Follow-ups.";
    b.vision.provenance = "client_statement";
    expect(a.context?.exampleId).toBe("");
    expect(a.context?.bookingNeeded).toBeNull();
    expect(briefsEqual(a, b)).toBe(true);
    expect(briefDifferences(a, b)).toEqual([]);
  });

  it("never reports equality when a difference exists, including context-only changes", () => {
    const pairs: Array<[ReturnType<typeof createEmptyBrief>, ReturnType<typeof createEmptyBrief>]> = [
      [createEmptyBrief(), applyBriefContext(createEmptyBrief(), { purpose: "study" })],
      [createEmptyBrief(), applyBriefContext(createEmptyBrief(), { route: "custom_project" })],
      [createEmptyBrief(), applyBriefContext(createEmptyBrief(), { exampleId: "study_organizer" })],
      [createEmptyBrief(), applyBriefContext(createEmptyBrief(), { bookingNeeded: true })],
      [applyClientValue(createEmptyBrief(), "vision", "A"), applyClientValue(createEmptyBrief(), "vision", "B")]
    ];
    for (const [left, right] of pairs) {
      expect(briefsEqual(left, right)).toBe(false);
      expect(briefDifferences(left, right).length).toBeGreaterThan(0);
    }
  });
});

describe("recovery UI for context differences", () => {
  it("keeps the chosen local revision, including context, without dropping other fields", () => {
    const server = applyBriefContext(applyClientValue(createEmptyBrief(), "vision", "A website for the practice."), {
      purpose: "business",
      route: "business"
    });
    const local = applyBriefContext(applyClientValue(createEmptyBrief(), "vision", "A website for the practice."), {
      purpose: "professional_workflow",
      route: "custom_project",
      bookingNeeded: false
    });
    const session = new DraftSession(identity(), server, 4, {
      localBrief: local,
      acknowledgedBrief: server,
      acknowledgedVersion: 3,
      unconfirmed: true,
      updatedAt: new Date().toISOString()
    });
    expect(session.recoveryOpen).toBe(true);
    expect(wordingMatchesMessage(briefDifferences(session.localBrief, session.serverBrief ?? server))).toBeNull();
    expect(briefDifferences(session.localBrief, session.serverBrief ?? server).map((item) => item.key)).toEqual(
      expect.arrayContaining(["purpose", "route", "bookingNeeded"])
    );

    session.keepLocalAfterCompare();
    expect(session.recoveryOpen).toBe(false);
    expect(session.localBrief.vision.value).toBe("A website for the practice.");
    expect(session.localBrief.context?.purpose).toBe("professional_workflow");
    expect(session.localBrief.context?.route).toBe("custom_project");
    expect(session.localBrief.context?.bookingNeeded).toBe(false);
    expect(session.localBrief.audience.value).toBe("");
  });

  it("takes the saved copy as a whole revision, including context", () => {
    const server = applyBriefContext(applyClientValue(createEmptyBrief(), "goals", "Book treatments."), {
      purpose: "business",
      route: "business",
      bookingNeeded: true
    });
    const local = applyBriefContext(applyClientValue(createEmptyBrief(), "goals", "Book treatments."), {
      purpose: "study",
      route: "custom_project"
    });
    const session = new DraftSession(identity(), server, 2, {
      localBrief: local,
      acknowledgedBrief: server,
      acknowledgedVersion: 1,
      unconfirmed: true,
      updatedAt: new Date().toISOString()
    });
    session.takeServerCopy();
    expect(session.localBrief.context?.purpose).toBe("business");
    expect(session.localBrief.context?.bookingNeeded).toBe(true);
    expect(session.localBrief.goals.value).toBe("Book treatments.");
    expect(session.localBrief.vision.value).toBe("");
  });

  it("does not open recovery for a legacy brief versus the same wording with empty context", () => {
    const legacy = normalizeBrief({
      vision: { key: "vision", value: "Original branded site", provenance: "client_statement" },
      projectType: { key: "projectType", value: "website", provenance: "client_statement" }
    });
    const emptyContext = { ...legacy, context: emptyCommissionContext() };
    const session = new DraftSession(identity(), legacy, 1, {
      localBrief: emptyContext,
      acknowledgedBrief: legacy,
      acknowledgedVersion: 1,
      unconfirmed: true,
      updatedAt: new Date().toISOString()
    });
    expect(session.recoveryOpen).toBe(false);
    expect(session.localBrief.vision.value).toBe("Original branded site");
    expect(briefDifferences(legacy, emptyContext)).toEqual([]);
  });

  it("keeps DraftCompare bound to briefDifferences so context-only recovery can render", () => {
    const source = readFileSync(path.resolve("src/components/project/DraftCompare.tsx"), "utf8");
    expect(source).toContain("briefDifferences(local, server)");
    expect(source).toContain("wordingMatchesMessage(differences)");
    expect(source).toContain("differences.length === 0");
    expect(source).toContain("item.label");
    expect(source).toContain("item.local");
    expect(source).toContain("item.server");
  });
});
