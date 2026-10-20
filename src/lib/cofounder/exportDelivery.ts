import { assetUrl, STUDIO_LAYOUTS } from "@/lib/cofounder/composition";
import { studioAssetKind } from "@/lib/cofounder/studioAssets";
import type { StudioAsset, StudioDraft } from "@/lib/cofounder/types";

export type ExportDeliveryStage =
  | "idle"
  | "rendering"
  | "saving"
  | "saved"
  | "downloading"
  | "download_failed";

export type SavedExportRef = {
  assetId: string;
  assetUrl: string;
  revisionId: string;
  draftId: string;
  businessId?: string;
  draftUpdatedAt?: string;
  exportedAt?: string;
  width: number;
  height: number;
  outputHash?: string;
};

export type ExportBindingContext = {
  ownerId?: string | null;
  businessId?: string | null;
  draftId?: string | null;
};

export type ExportRequestToken = {
  generation: number;
  ownerId: string | null;
  businessId: string | null;
  draftId: string | null;
};

export type IsolationBody = {
  ok?: boolean;
  error?: string;
  message?: string;
};

export function exportSaveFailedMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function exportDownloadFailedMessage() {
  return "The export is saved. Download failed. Use Download again — a new export was not created.";
}

export function exportAccessDeniedMessage(status: number) {
  if (status === 401) {
    return "Sign in is required to download this export. The saved file was not deleted.";
  }
  if (status === 403) {
    return "This export belongs to another account or workspace. The saved file was not deleted.";
  }
  if (status === 404) {
    return "The saved export could not be found. The draft was not replaced.";
  }
  return exportDownloadFailedMessage();
}

export function exportSavedStatus(ref: SavedExportRef) {
  return `Export saved ${ref.width}×${ref.height}. Your browser was asked to download the file. The file is stored with this account; this message does not confirm that the device kept a copy.`;
}

export function exportPriorRevisionStatus(ref: SavedExportRef) {
  return `Export saved for an earlier revision of this draft (${ref.width}×${ref.height}). Current edits have not been exported.`;
}

export function exportBelongsToDraft(
  ref: SavedExportRef | null | undefined,
  context: ExportBindingContext
): ref is SavedExportRef {
  if (!ref || !context.draftId) return false;
  if (ref.draftId !== context.draftId) return false;
  if (ref.businessId && context.businessId && ref.businessId !== context.businessId) return false;
  return true;
}

export function isPriorRevisionExport(
  ref: SavedExportRef | null | undefined,
  draft: Pick<StudioDraft, "id" | "updatedAt"> | null | undefined,
  dirty = false
) {
  if (!ref || !draft || ref.draftId !== draft.id) return false;
  if (dirty) return true;
  if (ref.draftUpdatedAt && draft.updatedAt && ref.draftUpdatedAt !== draft.updatedAt) return true;
  if (ref.exportedAt && draft.updatedAt && Date.parse(draft.updatedAt) > Date.parse(ref.exportedAt)) return true;
  return false;
}

export function exportStatusForDraft(
  ref: SavedExportRef | null | undefined,
  draft: Pick<StudioDraft, "id" | "updatedAt" | "businessId"> | null | undefined,
  dirty = false,
  businessId?: string | null
) {
  if (!exportBelongsToDraft(ref, { draftId: draft?.id, businessId: businessId ?? draft?.businessId })) {
    return "";
  }
  if (isPriorRevisionExport(ref, draft, dirty)) {
    return exportPriorRevisionStatus(ref);
  }
  return exportSavedStatus(ref);
}

export function nextExportGeneration(
  generation: number,
  from: ExportBindingContext,
  to: ExportBindingContext
) {
  const switched = from.draftId !== to.draftId || from.businessId !== to.businessId || from.ownerId !== to.ownerId;
  return { generation: switched ? generation + 1 : generation, switched };
}

export function isStaleExportRequest(token: ExportRequestToken, current: ExportRequestToken) {
  return (
    token.generation !== current.generation ||
    token.draftId !== current.draftId ||
    token.businessId !== current.businessId ||
    token.ownerId !== current.ownerId
  );
}

export function bindSavedExport(
  list: Array<Pick<
    StudioAsset,
    | "id"
    | "draftId"
    | "status"
    | "blobId"
    | "compositionRevisionId"
    | "prompt"
    | "model"
    | "revision"
    | "outputHash"
    | "createdAt"
  >>,
  draft: Pick<StudioDraft, "id" | "layout" | "updatedAt"> | null | undefined,
  businessId?: string | null
): SavedExportRef | null {
  if (!draft || !businessId) return null;
  const item = list
    .filter(
      (asset) =>
        asset.draftId === draft.id &&
        studioAssetKind(asset) === "composition_export" &&
        asset.status === "ready" &&
        asset.blobId &&
        asset.compositionRevisionId
    )
    .sort((left, right) => right.revision - left.revision)[0];
  if (!item?.compositionRevisionId) return null;
  const size = STUDIO_LAYOUTS[draft.layout] ?? STUDIO_LAYOUTS.direction_board;
  return {
    assetId: item.id,
    assetUrl: assetUrl(businessId, item.id),
    revisionId: item.compositionRevisionId,
    draftId: draft.id,
    businessId,
    exportedAt: item.createdAt,
    width: size.width,
    height: size.height,
    outputHash: item.outputHash
  };
}

export function assertIsolationContract(
  status: number,
  body: IsolationBody | null | undefined,
  expected: "unauthenticated" | "forbidden" | "not_found"
) {
  const error = body?.error;
  if (status === 200) {
    throw new Error("Cross-account or missing-artifact read returned HTTP 200.");
  }
  if (expected === "unauthenticated" && status === 401 && error === "unauthenticated" && body?.ok === false) {
    return { status, error };
  }
  if (expected === "forbidden" && status === 403 && error === "forbidden" && body?.ok === false) {
    return { status, error };
  }
  if (expected === "not_found" && status === 404 && error === "not_found" && body?.ok === false) {
    return { status, error };
  }
  throw new Error(
    `Isolation contract failed: expected ${expected}, got HTTP ${status} error=${String(error)}. A server error is not isolation evidence.`
  );
}

export async function fetchSavedExportBytes(
  ref: SavedExportRef,
  fetchImpl: typeof fetch = fetch
): Promise<Blob> {
  if (!ref.assetUrl) {
    throw new Error("The saved export has no download URL. The artifact remains on the server if saving succeeded.");
  }
  let response: Response;
  try {
    response = await fetchImpl(ref.assetUrl, { credentials: "same-origin" });
  } catch {
    throw new Error(exportDownloadFailedMessage());
  }
  if (!response.ok) {
    throw new Error(exportAccessDeniedMessage(response.status));
  }
  const blob = await response.blob();
  if (!blob.size) {
    throw new Error(exportDownloadFailedMessage());
  }
  return blob;
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  link.click();
  URL.revokeObjectURL(objectUrl);
}
