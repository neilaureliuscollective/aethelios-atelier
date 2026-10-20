import { defaultPaletteFor, defaultVisualFor, DIRECTIONS } from "@/lib/discovery/catalog";
import { parseSelection } from "@/lib/discovery/selection";
import {
  DIRECTION_IDS,
  isPaletteId,
  isVisualDirectionId,
  type DirectionId,
  type DiscoverySelection,
  type PaletteId,
  type VisualDirectionId
} from "@/lib/discovery/types";
import type { DesignSpec } from "@/lib/design-spec/types";
import type { GuestWorkClaim, StudioLayoutId } from "@/lib/cofounder/types";
import { ForbiddenError } from "@/lib/domain/errors";

export type ClaimedDiscoverySnapshot = {
  guestWorkId: string;
  selectionId: string;
  localRevision: number;
  selectedDirectionId: DirectionId;
  businessName: string;
  audience: string;
  intentNote: string;
  headline: string;
  body: string;
  paletteId: PaletteId;
  visualDirectionId: VisualDirectionId;
  layout: StudioLayoutId;
  designSpec?: DesignSpec;
  selection: DiscoverySelection | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

const STUDIO_LAYOUTS: StudioLayoutId[] = [
  "direction_board",
  "square_announcement",
  "portrait_social",
  "story_portrait",
  "website_banner"
];

function asLayout(value: unknown): StudioLayoutId | null {
  return typeof value === "string" && STUDIO_LAYOUTS.includes(value as StudioLayoutId)
    ? (value as StudioLayoutId)
    : null;
}

export function parseClaimedDiscovery(claim: GuestWorkClaim): ClaimedDiscoverySnapshot {
  if (claim.kind !== "discovery") {
    throw new ForbiddenError("Only a claimed Discovery snapshot can be adopted into Studio.");
  }
  let payload: unknown = {};
  try {
    payload = JSON.parse(claim.payloadJson || "{}");
  } catch {
    payload = {};
  }
  const record = asRecord(payload);
  const selection = parseSelection(payload) ?? parseSelection(record.selection);
  const visual = asRecord(record.visualPreferences);
  const selectedDirectionId =
    selection?.selectedDirectionId || asText(record.selectedDirectionId) || asText(record.directionId);
  if (!DIRECTION_IDS.includes(selectedDirectionId as DirectionId)) {
    throw new ForbiddenError("The claimed Discovery snapshot is missing a valid direction.");
  }
  const directionId = selectedDirectionId as DirectionId;
  const localRevision = selection?.localRevision ?? Number(record.localRevision ?? record.sourceRevision ?? Number.NaN);
  if (!Number.isInteger(localRevision) || localRevision < 0) {
    throw new ForbiddenError("The claimed Discovery snapshot is missing an exact revision.");
  }
  const paletteRaw = selection?.visualPreferences.paletteId ?? visual.paletteId ?? record.paletteId;
  const visualRaw = selection?.visualPreferences.visualDirectionId ?? visual.visualDirectionId ?? record.visualDirectionId;
  const paletteId = isPaletteId(paletteRaw) ? paletteRaw : defaultPaletteFor(directionId);
  const visualDirectionId = isVisualDirectionId(visualRaw) ? visualRaw : defaultVisualFor(directionId);
  const direction = DIRECTIONS[directionId];
  const businessName = selection?.businessName || asText(record.businessName);
  const audience = selection?.audience || asText(record.audience);
  const intentNote = selection?.intentNote || asText(record.intentNote);
  const headline =
    selection?.visualPreferences.headline ||
    asText(visual.headline) ||
    asText(record.headline) ||
    `${direction.name} · ${businessName || "Untitled"}`;
  const body =
    [audience, intentNote].filter(Boolean).join(" ").trim() ||
    selection?.visitorNotes ||
    direction.feeling;
  return {
    guestWorkId: claim.guestWorkId,
    selectionId: selection?.selectionId || asText(record.selectionId) || claim.guestWorkId,
    localRevision,
    selectedDirectionId: directionId,
    businessName,
    audience,
    intentNote,
    headline: headline.slice(0, 160),
    body: body.slice(0, 800),
    paletteId,
    visualDirectionId,
    layout: asLayout(record.layout) ?? asLayout(selection?.designSpec?.layoutId) ?? "direction_board",
    designSpec: selection?.designSpec,
    selection
  };
}
