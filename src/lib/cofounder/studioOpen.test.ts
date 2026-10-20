import { describe, expect, it } from "vitest";
import { resolveStudioOpen, selectedWorkText } from "@/lib/cofounder/studioOpen";
import type { StudioDraft, WorkItem } from "@/lib/cofounder/types";

function work(id: string, title: string, body: string): WorkItem {
  return {
    id,
    businessId: "biz_1",
    kind: "draft",
    title,
    status: "open",
    payload: { body },
    createdBy: "user_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

function draft(id: string, workItemId: string, headline: string, sourceWorkItemId?: string): StudioDraft {
  return {
    id,
    businessId: "biz_1",
    workItemId,
    sourceWorkItemId,
    layout: "square_announcement",
    layers: [{ id: "headline", kind: "headline", text: headline, x: 8, y: 12, width: 84, height: 18 }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("exact Work-to-Studio continuation", () => {
  const first = work("work_first", "Porch season", "Custom timber porches.");
  const second = work("work_second", "Evening gathering", "Aethelios Lifestyle dinner.");
  const drafts = [
    draft("studio_unrelated", "work_other", "Unrelated current draft"),
    draft("studio_first", "work_studio_1", "Porch season", "work_first")
  ];

  it("opens the exact linked draft for a Work item and never falls back to the first draft", () => {
    const opened = resolveStudioOpen({ workItemId: "work_first" }, drafts, [first, second]);
    expect(opened.kind).toBe("draft");
    if (opened.kind === "draft") {
      expect(opened.draft.id).toBe("studio_first");
      expect(opened.reason).toBe("linked_work_item");
    }
  });

  it("creates from the second Work item’s exact text when no Studio draft exists", () => {
    const opened = resolveStudioOpen({ workItemId: "work_second" }, drafts, [first, second]);
    expect(opened.kind).toBe("create_from_work");
    if (opened.kind === "create_from_work") {
      expect(selectedWorkText(opened.workItem)).toEqual({
        headline: "Evening gathering",
        body: "Aethelios Lifestyle dinner."
      });
    }
  });

  it("returns an honest error for a missing or mismatched item", () => {
    const missing = resolveStudioOpen({ workItemId: "work_gone" }, drafts, [first, second]);
    expect(missing.kind).toBe("error");
    if (missing.kind === "error") {
      expect(missing.code).toBe("missing");
      expect(missing.recovery).toMatch(/Work/);
    }
    const mismatched = resolveStudioOpen(
      { draftId: "studio_first", workItemId: "work_second" },
      drafts,
      [first, second]
    );
    expect(mismatched.kind).toBe("error");
    if (mismatched.kind === "error") expect(mismatched.code).toBe("mismatched");
  });
});
