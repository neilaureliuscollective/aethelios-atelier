import type { StudioDraft, WorkItem } from "@/lib/cofounder/types";

export type StudioOpenRequest = {
  draftId?: string | null;
  workItemId?: string | null;
};

export type StudioOpenResult =
  | { kind: "none" }
  | { kind: "draft"; draft: StudioDraft; reason: "exact_draft" | "linked_work_item" }
  | { kind: "create_from_work"; workItem: WorkItem }
  | {
      kind: "error";
      code: "missing" | "deleted" | "mismatched";
      message: string;
      recovery: string;
    };

export function selectedWorkText(item: WorkItem) {
  return {
    headline: item.title,
    body: String(item.payload.body ?? item.payload.preview ?? "")
  };
}

export function findLinkedDraft(drafts: StudioDraft[], workItemId: string) {
  return (
    drafts.find((draft) => draft.workItemId === workItemId) ??
    drafts.find((draft) => draft.sourceWorkItemId === workItemId) ??
    null
  );
}

/**
 * Resolve the exact owner-requested Studio target.
 * Never substitutes current/first draft when the requested item is missing.
 */
export function resolveStudioOpen(
  request: StudioOpenRequest,
  drafts: StudioDraft[],
  workItems: WorkItem[]
): StudioOpenResult {
  const draftId = request.draftId?.trim() || "";
  const workItemId = request.workItemId?.trim() || "";
  if (!draftId && !workItemId) return { kind: "none" };

  if (draftId) {
    const exact = drafts.find((draft) => draft.id === draftId);
    if (exact) {
      if (workItemId && exact.workItemId !== workItemId && exact.sourceWorkItemId !== workItemId) {
        return {
          kind: "error",
          code: "mismatched",
          message: "That Studio draft is not the saved composition for the requested Work item.",
          recovery: "Open the Work item again, or create a new Studio draft from its exact copy."
        };
      }
      return { kind: "draft", draft: exact, reason: "exact_draft" };
    }
    return {
      kind: "error",
      code: "missing",
      message: "That Studio draft is missing, deleted, or not in this workspace.",
      recovery: "Return to Work and open a saved item, or start a new composition from its exact copy."
    };
  }

  const linked = findLinkedDraft(drafts, workItemId);
  if (linked) return { kind: "draft", draft: linked, reason: "linked_work_item" };

  const workItem = workItems.find((item) => item.id === workItemId);
  if (!workItem || workItem.archivedAt) {
    return {
      kind: "error",
      code: workItem?.archivedAt ? "deleted" : "missing",
      message: workItem?.archivedAt
        ? "That Work item was archived and cannot open another composition."
        : "That Work item is missing, deleted, or not in this workspace.",
      recovery: "Return to Work and choose a visible item, or start a new Studio draft."
    };
  }

  return { kind: "create_from_work", workItem };
}
