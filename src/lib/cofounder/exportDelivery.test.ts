import { describe, expect, it } from "vitest";
import {
  assertIsolationContract,
  bindSavedExport,
  exportAccessDeniedMessage,
  exportBelongsToDraft,
  exportDownloadFailedMessage,
  exportPriorRevisionStatus,
  exportSaveFailedMessage,
  exportSavedStatus,
  exportStatusForDraft,
  fetchSavedExportBytes,
  isPriorRevisionExport,
  isStaleExportRequest,
  nextExportGeneration,
  type SavedExportRef
} from "@/lib/cofounder/exportDelivery";

const refA: SavedExportRef = {
  assetId: "asset_a",
  assetUrl: "/api/companion/assets/asset_a?businessId=biz_1",
  revisionId: "crev_a",
  draftId: "studio_a",
  businessId: "biz_1",
  draftUpdatedAt: "2026-10-20T10:00:00.000Z",
  exportedAt: "2026-10-20T10:00:00.000Z",
  width: 1600,
  height: 1200,
  outputHash: "aaa"
};

const draftA = {
  id: "studio_a",
  businessId: "biz_1",
  layout: "direction_board" as const,
  updatedAt: "2026-10-20T10:00:00.000Z"
};

const draftB = {
  id: "studio_b",
  businessId: "biz_1",
  layout: "square_announcement" as const,
  updatedAt: "2026-10-20T11:00:00.000Z"
};

const exportAssetA = {
  id: "asset_a",
  draftId: "studio_a",
  status: "ready" as const,
  blobId: "blob_a",
  compositionRevisionId: "crev_a",
  prompt: "composition_export",
  revision: 1,
  outputHash: "aaa",
  createdAt: "2026-10-20T10:00:00.000Z"
};

describe("export delivery stages", () => {
  it("keeps a successful save distinct from a failed download", async () => {
    await expect(
      fetchSavedExportBytes(refA, async () => new Response(null, { status: 503 }))
    ).rejects.toThrow(exportDownloadFailedMessage());
    await expect(
      fetchSavedExportBytes(refA, async () => {
        throw new TypeError("network");
      })
    ).rejects.toThrow(exportDownloadFailedMessage());
    expect(exportSavedStatus(refA)).toContain("Export saved 1600×1200");
    expect(exportSavedStatus(refA)).toContain("does not confirm that the device kept a copy");
  });

  it("does not claim the draft is unmarked when save already succeeded", () => {
    expect(exportDownloadFailedMessage()).not.toMatch(/not marked exported/i);
    expect(exportSaveFailedMessage(new Error("The composed image was rejected."), "fallback")).toBe(
      "The composed image was rejected."
    );
  });

  it("rejects a missing or empty download without inventing bytes", async () => {
    await expect(
      fetchSavedExportBytes({ ...refA, assetUrl: "" }, async () => new Response(new Uint8Array([1, 2, 3])))
    ).rejects.toThrow(/no download URL/);
    await expect(fetchSavedExportBytes(refA, async () => new Response(new Uint8Array()))).rejects.toThrow(
      exportDownloadFailedMessage()
    );
  });

  it("distinguishes expired, forbidden, and missing artifact responses from a generic download failure", async () => {
    await expect(fetchSavedExportBytes(refA, async () => new Response(null, { status: 401 }))).rejects.toThrow(
      exportAccessDeniedMessage(401)
    );
    await expect(fetchSavedExportBytes(refA, async () => new Response(null, { status: 403 }))).rejects.toThrow(
      exportAccessDeniedMessage(403)
    );
    await expect(fetchSavedExportBytes(refA, async () => new Response(null, { status: 404 }))).rejects.toThrow(
      exportAccessDeniedMessage(404)
    );
    expect(exportAccessDeniedMessage(401)).toMatch(/Sign in is required/);
    expect(exportAccessDeniedMessage(403)).toMatch(/another account/);
    expect(exportAccessDeniedMessage(404)).toMatch(/could not be found/);
  });
});

describe("exact-draft export binding", () => {
  it("recovers an export only for the selected draft and clears an unexported draft", () => {
    const assets = [exportAssetA];
    expect(bindSavedExport(assets, draftA, "biz_1")?.assetId).toBe("asset_a");
    expect(bindSavedExport(assets, draftB, "biz_1")).toBeNull();
    expect(bindSavedExport(assets, draftA, "biz_other")).toEqual(bindSavedExport(assets, draftA, "biz_other"));
    expect(bindSavedExport(assets, null, "biz_1")).toBeNull();
    expect(exportBelongsToDraft(refA, { draftId: "studio_b", businessId: "biz_1" })).toBe(false);
    expect(exportBelongsToDraft(refA, { draftId: "studio_a", businessId: "biz_2" })).toBe(false);
    expect(exportStatusForDraft(refA, draftB, false, "biz_1")).toBe("");
  });

  it("returns A then clears B then restores A", () => {
    const assets = [exportAssetA];
    const first = bindSavedExport(assets, draftA, "biz_1");
    const afterSwitch = bindSavedExport(assets, draftB, "biz_1");
    const back = bindSavedExport(assets, draftA, "biz_1");
    expect(first?.draftId).toBe("studio_a");
    expect(afterSwitch).toBeNull();
    expect(back?.assetId).toBe(first?.assetId);
    expect(back?.revisionId).toBe("crev_a");
  });

  it("labels a same-draft export as an earlier revision after later edits", () => {
    expect(isPriorRevisionExport(refA, draftA, true)).toBe(true);
    expect(isPriorRevisionExport(refA, { ...draftA, updatedAt: "2026-10-20T12:00:00.000Z" }, false)).toBe(true);
    expect(exportStatusForDraft(refA, { ...draftA, updatedAt: "2026-10-20T12:00:00.000Z" }, false, "biz_1")).toBe(
      exportPriorRevisionStatus(refA)
    );
    expect(exportStatusForDraft(refA, draftA, false, "biz_1")).toBe(exportSavedStatus(refA));
    expect(exportPriorRevisionStatus(refA)).toMatch(/earlier revision/);
    expect(exportPriorRevisionStatus(refA)).not.toMatch(/Current edits have been exported/);
  });

  it("increments the export generation when the draft, workspace, or owner changes", () => {
    expect(
      nextExportGeneration(3, { draftId: "studio_a", businessId: "biz_1", ownerId: "owner_1" }, {
        draftId: "studio_b",
        businessId: "biz_1",
        ownerId: "owner_1"
      })
    ).toEqual({ generation: 4, switched: true });
    expect(
      nextExportGeneration(3, { draftId: "studio_a", businessId: "biz_1", ownerId: "owner_1" }, {
        draftId: "studio_a",
        businessId: "biz_1",
        ownerId: "owner_1"
      })
    ).toEqual({ generation: 3, switched: false });
    expect(
      nextExportGeneration(1, { draftId: "studio_a", businessId: "biz_1", ownerId: "owner_1" }, {
        draftId: "studio_a",
        businessId: "biz_2",
        ownerId: "owner_1"
      }).switched
    ).toBe(true);
  });

  it("ignores an in-flight A request after the visible draft becomes B", () => {
    const tokenA = { generation: 1, ownerId: "owner_1", businessId: "biz_1", draftId: "studio_a" };
    const currentB = { generation: 2, ownerId: "owner_1", businessId: "biz_1", draftId: "studio_b" };
    expect(isStaleExportRequest(tokenA, currentB)).toBe(true);
    expect(isStaleExportRequest(tokenA, tokenA)).toBe(false);
    expect(
      isStaleExportRequest(tokenA, { ...tokenA, ownerId: "owner_2" })
    ).toBe(true);
  });
});

describe("isolation response contract", () => {
  it("requires the exact unauthenticated, forbidden, and not-found bodies", () => {
    expect(assertIsolationContract(401, { ok: false, error: "unauthenticated" }, "unauthenticated")).toEqual({
      status: 401,
      error: "unauthenticated"
    });
    expect(assertIsolationContract(403, { ok: false, error: "forbidden" }, "forbidden").error).toBe("forbidden");
    expect(assertIsolationContract(404, { ok: false, error: "not_found" }, "not_found").error).toBe("not_found");
    expect(() => assertIsolationContract(500, { ok: false, error: "internal" }, "forbidden")).toThrow(/not isolation/);
    expect(() => assertIsolationContract(403, { ok: false, error: "internal" }, "forbidden")).toThrow(/Isolation contract/);
    expect(() => assertIsolationContract(200, { ok: true }, "forbidden")).toThrow(/HTTP 200/);
  });
});
