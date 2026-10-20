import { describe, expect, it } from "vitest";
import { previewAssetForWorkItem, selectContinueWork } from "@/lib/cofounder/today";
import type { StudioAsset, StudioDraft, WorkItem } from "@/lib/cofounder/types";

function work(id: string, updatedAt: string, title = id): WorkItem {
  return {
    id,
    businessId: "biz_1",
    kind: "draft",
    title,
    status: "open",
    payload: { body: title },
    createdBy: "user_1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt
  };
}

function draft(
  id: string,
  workItemId: string,
  updatedAt: string,
  selectedAssetId?: string,
  sourceWorkItemId?: string
): StudioDraft {
  return {
    id,
    businessId: "biz_1",
    workItemId,
    sourceWorkItemId,
    selectedAssetId,
    layout: "square_announcement",
    layers: [],
    saveRevision: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt
  };
}

function asset(id: string, status: StudioAsset["status"] = "ready", blobId = `blob_${id}`): StudioAsset {
  return {
    id,
    businessId: "biz_1",
    status,
    prompt: id,
    blobId: status === "ready" ? blobId : undefined,
    revision: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("Today Continue selection", () => {
  it("continues the newest unfinished work item, not the globally newest Studio draft", () => {
    const cedar = work("work_cedar", "2026-03-02T12:00:00.000Z", "Cedar menu");
    const stone = work("work_stone", "2026-03-01T12:00:00.000Z", "Stone flyer");
    expect(selectContinueWork([stone, cedar])?.id).toBe("work_cedar");

    const preview = previewAssetForWorkItem(
      cedar,
      [
        draft("studio_cedar", "studio_work_cedar", "2026-03-01T18:00:00.000Z", "asset_cedar", "work_cedar"),
        draft("studio_stone", "studio_work_stone", "2026-03-03T09:00:00.000Z", "asset_stone", "work_stone")
      ],
      [asset("asset_cedar"), asset("asset_stone")]
    );
    expect(preview?.id).toBe("asset_cedar");
  });

  it("falls back honestly when the continued work item has no linked ready image", () => {
    const notes = work("work_notes", "2026-03-04T12:00:00.000Z", "Notes only");
    const preview = previewAssetForWorkItem(
      notes,
      [
        draft("studio_other", "work_other", "2026-03-05T12:00:00.000Z", "asset_other"),
        draft("studio_notes", "work_notes", "2026-03-04T12:00:00.000Z")
      ],
      [asset("asset_other"), asset("asset_pending", "pending")]
    );
    expect(preview).toBeUndefined();
  });
});
