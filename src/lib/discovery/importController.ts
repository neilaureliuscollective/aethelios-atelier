import { applyProposals, fingerprintBrief, mapSelectionToBriefProposals } from "./adapter";
import { parseSelection } from "./selection";
import type { ApplyDecision, ApplyResult, DirectionId, DiscoveryBriefMapping, DiscoverySelection } from "./types";
import type { Brief, BriefFieldKey } from "@/lib/types";

export type ImportFailureCode =
  | Exclude<ApplyResult, { ok: true }>["code"]
  | "invalid_selection"
  | "stale_revision"
  | "stale_review";

export type ImportReviewCapture = {
  selectionId: string;
  selectedDirectionId: DirectionId;
  localRevision: number;
  briefFingerprint: string;
  briefRevision: number | null;
  ownerId: string | null;
  projectId: string | null;
  mapping: DiscoveryBriefMapping;
};

export type ImportControllerResult =
  | { ok: true; brief: Brief; mapping: DiscoveryBriefMapping; selection: DiscoverySelection }
  | { ok: false; code: ImportFailureCode; reason: string; mapping?: DiscoveryBriefMapping };

const STALE_REVIEW_REASON =
  "The brief, prepared direction, or account changed while this review was open. Your newer text is still here. Review the import again before anything is applied.";

export function prepareDiscoveryImport(input: {
  rawSelection: unknown;
  currentBrief: Brief;
}): { ok: true; selection: DiscoverySelection; mapping: DiscoveryBriefMapping } | { ok: false; code: "invalid_selection"; reason: string } {
  const selection = parseSelection(input.rawSelection);
  if (!selection) {
    return {
      ok: false,
      code: "invalid_selection",
      reason: "The prepared direction could not be read. Unknown catalog or template versions are not applied."
    };
  }
  return {
    ok: true,
    selection,
    mapping: mapSelectionToBriefProposals(selection, input.currentBrief)
  };
}

export function captureDiscoveryImportReview(input: {
  rawSelection: unknown;
  currentBrief: Brief;
  ownerId?: string | null;
  projectId?: string | null;
  briefRevision?: number | null;
}):
  | { ok: true; capture: ImportReviewCapture; selection: DiscoverySelection }
  | { ok: false; code: "invalid_selection"; reason: string } {
  const prepared = prepareDiscoveryImport({
    rawSelection: input.rawSelection,
    currentBrief: input.currentBrief
  });
  if (!prepared.ok) return prepared;
  return {
    ok: true,
    selection: prepared.selection,
    capture: {
      selectionId: prepared.selection.selectionId,
      selectedDirectionId: prepared.selection.selectedDirectionId,
      localRevision: prepared.selection.localRevision,
      briefFingerprint: fingerprintBrief(input.currentBrief),
      briefRevision: typeof input.briefRevision === "number" ? input.briefRevision : null,
      ownerId: input.ownerId ?? null,
      projectId: input.projectId ?? null,
      mapping: prepared.mapping
    }
  };
}

export function reviewCaptureIsCurrent(input: {
  capture: ImportReviewCapture;
  currentBrief: Brief;
  currentSelection: unknown;
  currentOwnerId?: string | null;
  currentProjectId?: string | null;
  currentRevision?: number | null;
}): boolean {
  const current = parseSelection(input.currentSelection);
  if (!current) return false;
  if (
    current.selectionId !== input.capture.selectionId ||
    current.selectedDirectionId !== input.capture.selectedDirectionId ||
    current.localRevision !== input.capture.localRevision
  ) {
    return false;
  }
  if (fingerprintBrief(input.currentBrief) !== input.capture.briefFingerprint) return false;
  if ((input.capture.ownerId ?? null) !== (input.currentOwnerId ?? null)) return false;
  if ((input.capture.projectId ?? null) !== (input.currentProjectId ?? null)) return false;
  if (
    typeof input.capture.briefRevision === "number" &&
    typeof input.currentRevision === "number" &&
    input.capture.briefRevision !== input.currentRevision
  ) {
    return false;
  }
  return true;
}

export function applyDiscoveryImport(input: {
  capture: ImportReviewCapture;
  currentBrief: Brief;
  currentSelection: unknown;
  decisions: Partial<Record<BriefFieldKey, ApplyDecision>>;
  currentOwnerId?: string | null;
  currentProjectId?: string | null;
  currentRevision?: number | null;
}): ImportControllerResult {
  const current = parseSelection(input.currentSelection);
  if (!current) {
    return {
      ok: false,
      code: "invalid_selection",
      reason: "The prepared direction could not be read. Unknown catalog or template versions are not applied."
    };
  }

  if (
    !reviewCaptureIsCurrent({
      capture: input.capture,
      currentBrief: input.currentBrief,
      currentSelection: input.currentSelection,
      currentOwnerId: input.currentOwnerId,
      currentProjectId: input.currentProjectId,
      currentRevision: input.currentRevision
    })
  ) {
    return {
      ok: false,
      code: "stale_review",
      reason: STALE_REVIEW_REASON,
      mapping: input.capture.mapping
    };
  }

  const applied = applyProposals(input.currentBrief, input.capture.mapping, input.decisions);
  if (!applied.ok) {
    return { ok: false, code: applied.code, reason: applied.reason, mapping: input.capture.mapping };
  }

  return {
    ok: true,
    brief: applied.brief,
    mapping: input.capture.mapping,
    selection: current
  };
}
