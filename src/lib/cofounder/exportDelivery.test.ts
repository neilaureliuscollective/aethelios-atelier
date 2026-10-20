import { describe, expect, it } from "vitest";
import {
  exportDownloadFailedMessage,
  exportSaveFailedMessage,
  exportSavedStatus,
  fetchSavedExportBytes,
  type SavedExportRef
} from "@/lib/cofounder/exportDelivery";

const ref: SavedExportRef = {
  assetId: "asset_1",
  assetUrl: "/api/companion/assets/asset_1?businessId=biz",
  revisionId: "crev_1",
  draftId: "studio_1",
  width: 1600,
  height: 1200,
  outputHash: "abc"
};

describe("export delivery stages", () => {
  it("keeps a successful save distinct from a failed download", async () => {
    await expect(
      fetchSavedExportBytes(ref, async () => new Response(null, { status: 503 }))
    ).rejects.toThrow(exportDownloadFailedMessage());
    await expect(
      fetchSavedExportBytes(ref, async () => {
        throw new TypeError("network");
      })
    ).rejects.toThrow(exportDownloadFailedMessage());
    expect(exportSavedStatus(ref)).toContain("Export saved 1600×1200");
    expect(exportSavedStatus(ref)).toContain("does not confirm that the device kept a copy");
  });

  it("does not claim the draft is unmarked when save already succeeded", () => {
    expect(exportDownloadFailedMessage()).not.toMatch(/not marked exported/i);
    expect(exportSaveFailedMessage(new Error("The composed image was rejected."), "fallback")).toBe(
      "The composed image was rejected."
    );
  });

  it("rejects a missing or empty download without inventing bytes", async () => {
    await expect(
      fetchSavedExportBytes({ ...ref, assetUrl: "" }, async () => new Response(new Uint8Array([1, 2, 3])))
    ).rejects.toThrow(/no download URL/);
    await expect(fetchSavedExportBytes(ref, async () => new Response(new Uint8Array()))).rejects.toThrow(
      exportDownloadFailedMessage()
    );
  });
});
