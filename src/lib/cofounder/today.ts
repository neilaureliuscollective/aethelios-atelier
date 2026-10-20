import type { StudioAsset, StudioDraft, WorkItem } from "@/lib/cofounder/types";

export function selectContinueWork(unfinishedDrafts: WorkItem[]) {
  return [...unfinishedDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

export function previewAssetForWorkItem(
  workItem: WorkItem | undefined,
  drafts: StudioDraft[],
  assets: StudioAsset[]
): StudioAsset | undefined {
  if (!workItem) return undefined;
  const linked = drafts
    .filter((draft) => draft.workItemId === workItem.id || draft.sourceWorkItemId === workItem.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const draft of linked) {
    if (!draft.selectedAssetId) continue;
    const asset = assets.find(
      (item) => item.id === draft.selectedAssetId && item.status === "ready" && Boolean(item.blobId)
    );
    if (asset) return asset;
  }
  return undefined;
}
