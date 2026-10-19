import { applyProposals, mapSelectionToBriefProposals } from "./adapter";
import { parseSelection } from "./selection";
import type { ApplyDecision, ApplyResult, DiscoveryBriefMapping, DiscoverySelection } from "./types";
import type { Brief, BriefFieldKey } from "@/lib/types";

export type ImportFailureCode =
  | Exclude<ApplyResult, { ok: true }>["code"]
  | "invalid_selection"
  | "stale_revision";

export type ImportControllerResult =
  | { ok: true; brief: Brief; mapping: DiscoveryBriefMapping; selection: DiscoverySelection }
  | { ok: false; code: ImportFailureCode; reason: string; mapping?: DiscoveryBriefMapping };

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

export function applyDiscoveryImport(input: {
  rawSelection: unknown;
  currentBrief: Brief;
  decisions: Partial<Record<BriefFieldKey, ApplyDecision>>;
  expectedRevision?: number | null;
  currentRevision?: number | null;
}): ImportControllerResult {
  const prepared = prepareDiscoveryImport({ rawSelection: input.rawSelection, currentBrief: input.currentBrief });
  if (!prepared.ok) return prepared;

  if (
    typeof input.expectedRevision === "number" &&
    typeof input.currentRevision === "number" &&
    input.expectedRevision !== input.currentRevision
  ) {
    return {
      ok: false,
      code: "stale_revision",
      reason: "The brief revision changed. Generate a fresh mapping against the current saved revision before applying.",
      mapping: prepared.mapping
    };
  }

  const applied = applyProposals(input.currentBrief, prepared.mapping, input.decisions);
  if (!applied.ok) {
    return { ok: false, code: applied.code, reason: applied.reason, mapping: prepared.mapping };
  }

  return {
    ok: true,
    brief: applied.brief,
    mapping: prepared.mapping,
    selection: prepared.selection
  };
}
