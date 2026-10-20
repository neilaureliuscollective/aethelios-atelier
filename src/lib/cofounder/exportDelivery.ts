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
  width: number;
  height: number;
  outputHash?: string;
};

export function exportSaveFailedMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export function exportDownloadFailedMessage() {
  return "The export is saved. Download failed. Use Download again — a new export was not created.";
}

export function exportSavedStatus(ref: SavedExportRef) {
  return `Export saved ${ref.width}×${ref.height}. Your browser was asked to download the file. The file is stored with this account; this message does not confirm that the device kept a copy.`;
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
    throw new Error(exportDownloadFailedMessage());
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
