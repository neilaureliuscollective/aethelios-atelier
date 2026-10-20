import { DIRECTIONS } from "@/lib/discovery/catalog";
import { DIRECTION_IDS, type DirectionId } from "@/lib/discovery/types";
import type { GuestWorkClaim } from "@/lib/cofounder/types";
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
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  const visual = asRecord(record.visualPreferences);
  const selectionId = asText(record.selectionId) || claim.guestWorkId;
  const localRevision = Number(record.localRevision ?? record.sourceRevision ?? Number.NaN);
  const selectedDirectionId = asText(record.selectedDirectionId) || asText(record.directionId);
  if (!DIRECTION_IDS.includes(selectedDirectionId as DirectionId)) {
    throw new ForbiddenError("The claimed Discovery snapshot is missing a valid direction.");
  }
  if (!Number.isInteger(localRevision) || localRevision < 0) {
    throw new ForbiddenError("The claimed Discovery snapshot is missing an exact revision.");
  }
  const direction = DIRECTIONS[selectedDirectionId as DirectionId];
  const businessName = asText(record.businessName);
  const audience = asText(record.audience);
  const intentNote = asText(record.intentNote);
  const headline =
    asText(visual.headline) ||
    asText(record.headline) ||
    `${direction.name} · ${businessName || "Untitled"}`;
  const body = [audience, intentNote].filter(Boolean).join(" ").trim() || direction.feeling;
  return {
    guestWorkId: claim.guestWorkId,
    selectionId,
    localRevision,
    selectedDirectionId: selectedDirectionId as DirectionId,
    businessName,
    audience,
    intentNote,
    headline: headline.slice(0, 160),
    body: body.slice(0, 800)
  };
}
