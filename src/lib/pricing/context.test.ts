import { describe, expect, it } from "vitest";
import { createEmptyBrief } from "@/lib/brief";
import {
  applyPlanInterest,
  createPlanInterestRecord,
  parsePlanInterestRecord,
  planDiscussionHref,
  planInterestNote,
  proposePlanInterest,
  readPlanInterestFromSearch
} from "./context";

describe("plan interest handoff", () => {
  it("reads only known plan ids from the brief query", () => {
    expect(readPlanInterestFromSearch("?plan=connected")).toBe("connected");
    expect(readPlanInterestFromSearch("plan=partnership&review=1")).toBe("partnership");
    expect(readPlanInterestFromSearch("?plan=human-ascendance")).toBeNull();
    expect(readPlanInterestFromSearch("?preview=true")).toBeNull();
  });

  it("preserves existing brief text unless the owner chooses replace", () => {
    const brief = createEmptyBrief();
    brief.constraints.value = "Keep the current booking provider.";
    brief.constraints.provenance = "client_statement";

    const appended = applyPlanInterest({ brief, planId: "atelier", decision: "append" });
    expect(appended.constraints.value).toContain("Keep the current booking provider.");
    expect(appended.constraints.value).toContain(planInterestNote("atelier"));
    expect(appended.vision.value).toBe("");

    const skipped = applyPlanInterest({ brief, planId: "atelier", decision: "skip" });
    expect(skipped).toEqual(brief);

    const replaced = applyPlanInterest({ brief, planId: "connected", decision: "replace" });
    expect(replaced.constraints.value).toBe(planInterestNote("connected"));
    expect(replaced.constraints.value).not.toContain("Keep the current booking provider.");
  });

  it("does not treat a plan selection as a purchase or overwrite on default review", () => {
    const brief = createEmptyBrief();
    brief.constraints.value = "Existing note";
    const proposal = proposePlanInterest(brief, "partnership");
    expect(proposal.defaultDecision).toBe("append");
    expect(proposal.proposedValue).not.toMatch(/buy|subscribe|payment|\$/i);
    expect(planDiscussionHref("partnership")).toBe("/project?plan=partnership");
  });

  it("rejects unknown stored plan interest records", () => {
    expect(parsePlanInterestRecord({ version: 1, kind: "plan_interest", planId: "reserve" })).toBeNull();
    expect(parsePlanInterestRecord(createPlanInterestRecord("atelier"))?.planId).toBe("atelier");
  });
});
