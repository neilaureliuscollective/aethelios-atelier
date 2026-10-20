import type { StudioAsset } from "@/lib/cofounder/types";

export type StudioAssetKind = "image" | "composition_export";

/** Derived from persisted revision/provenance fields, including older exports. */
export function studioAssetKind(asset: Pick<StudioAsset, "compositionRevisionId" | "prompt" | "model">): StudioAssetKind {
  return asset.compositionRevisionId || asset.prompt === "composition_export" || asset.model?.startsWith("atelier-owner-canvas-")
    ? "composition_export"
    : "image";
}

/** A composition export contains exact text/logo layers and must not become a background. */
export function isStudioBackgroundAsset(asset: StudioAsset): boolean {
  return studioAssetKind(asset) === "image" && asset.status === "ready" && Boolean(asset.blobId);
}
