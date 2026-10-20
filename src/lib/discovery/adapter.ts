import { createEmptyBrief } from "@/lib/brief";
import { BRIEF_FIELD_KEYS, type Brief, type BriefFieldKey } from "@/lib/types";
import { BUSINESS_TYPE_COPY, DIRECTIONS, INTENT_COPY, PALETTES, QUALITY_COPY, VISUAL_DIRECTION_COPY } from "./catalog";
import { displayName } from "./sanitize";
import {
  serviceInterestToProjectType,
  type ApplyDecision,
  type ApplyResult,
  type BriefProposal,
  type DiscoveryBriefMapping,
  type DiscoverySelection
} from "./types";

const NEVER_INFERRED: BriefFieldKey[] = [
  "timing",
  "budget",
  "bookingProvider",
  "existingWebsite",
  "goals"
];

const ENUM_FIELDS: BriefFieldKey[] = ["projectType"];

export function fingerprintBrief(brief: Brief): string {
  return JSON.stringify(BRIEF_FIELD_KEYS.map((key) => [key, brief[key]?.value ?? "", brief[key]?.provenance ?? "empty"]));
}

export function mapSelectionToBriefProposals(
  selection: DiscoverySelection,
  existingBrief: Brief = createEmptyBrief()
): DiscoveryBriefMapping {
  const proposals: BriefProposal[] = [];
  const unknowns: string[] = [];
  const warnings: string[] = [];

  const vision = proposeVision(selection);
  if (vision) proposals.push(toProposal("vision", vision, "Business name and the visitor’s stated intent.", existingBrief));
  else unknowns.push("vision");

  const audience = proposeAudience(selection);
  if (audience) proposals.push(toProposal("audience", audience, "Audience and desired customer feeling.", existingBrief));
  else unknowns.push("audience");

  const projectType = serviceInterestToProjectType(selection.serviceInterest);
  if (projectType) {
    proposals.push(
      toProposal(
        "projectType",
        projectType,
        "Explicit service selection only. Aesthetic direction does not choose a package.",
        existingBrief
      )
    );
  } else {
    unknowns.push("projectType");
  }

  const references = proposeReferences(selection);
  proposals.push(
    toProposal(
      "references",
      references,
      "Confirmed concept, palette, and visual direction — treated as untrusted references.",
      existingBrief
    )
  );

  const priorities = proposePriorities(selection);
  if (priorities) {
    proposals.push(toProposal("priorities", priorities, "Explicit notes about what they like and want changed.", existingBrief));
  } else {
    unknowns.push("priorities");
  }

  if (selection.exclusions.trim()) {
    proposals.push(
      toProposal("constraints", selection.exclusions.trim(), "Explicit exclusions written by the visitor.", existingBrief)
    );
  } else {
    unknowns.push("constraints");
  }

  for (const field of NEVER_INFERRED) {
    warnings.push(`${field} remains unknown; discovery does not infer price, deadline, booking provider, or technical scope.`);
  }

  const proposedKeys = new Set(proposals.map((item) => item.field));
  const untouchedFields = BRIEF_FIELD_KEYS.filter((key) => !proposedKeys.has(key));

  return {
    version: 2,
    kind: "discovery_brief_mapping",
    sourceSelectionId: selection.selectionId,
    sourceRevision: selection.localRevision,
    briefFingerprint: fingerprintBrief(existingBrief),
    proposals,
    untouchedFields,
    summary: humanDirectionSummary(selection),
    unknowns,
    warnings
  };
}

export function applyProposals(
  currentBrief: Brief,
  mapping: DiscoveryBriefMapping,
  decisions: Partial<Record<BriefFieldKey, ApplyDecision>>
): ApplyResult {
  if (mapping.briefFingerprint !== fingerprintBrief(currentBrief)) {
    return {
      ok: false,
      code: "stale_mapping",
      reason: "The brief has changed since this mapping was prepared. Generate a fresh mapping before applying."
    };
  }

  for (const proposal of mapping.proposals) {
    const decision = decisions[proposal.field];
    if (!decision) {
      return {
        ok: false,
        code: "missing_decision",
        reason: `Choose how to treat ${proposal.field} — add to existing notes, replace existing notes, or leave unchanged — before anything is written.`
      };
    }
    if (ENUM_FIELDS.includes(proposal.field) && decision === "append") {
      return {
        ok: false,
        code: "invalid_project_type_append",
        reason: "Project type can only be replaced with a supported choice, or skipped."
      };
    }
  }

  const next: Brief = { ...currentBrief };
  for (const proposal of mapping.proposals) {
    const decision = decisions[proposal.field];
    if (decision !== "append" && decision !== "replace") continue;
    const current = currentBrief[proposal.field].value;
    const value =
      decision === "append" && current.trim() ? `${current.trim()}\n\n${proposal.proposedValue}` : proposal.proposedValue;
    next[proposal.field] = {
      key: proposal.field,
      value,
      provenance: "client_statement",
      unresolvedQuestion: undefined,
      pendingSuggestionId: undefined
    };
  }
  return { ok: true, brief: next };
}

export function undecidedFromSelection(selection: DiscoverySelection): string[] {
  const undecided: string[] = [];
  if (!selection.businessName.trim()) undecided.push("business name");
  if (!selection.businessType) undecided.push("business type");
  if (!selection.intent) undecided.push("aim");
  if (!selection.audience.trim()) undecided.push("audience");
  if (!selection.desiredQualities.length) undecided.push("qualities");
  if (!selection.customerFeeling) undecided.push("customer feeling");
  if (selection.serviceInterest === "unspecified") undecided.push("commission type");
  if (!selection.exclusions.trim()) undecided.push("exclusions");
  return undecided;
}

export function humanDirectionSummary(selection: DiscoverySelection): string {
  const name = displayName(selection.businessName);
  const direction = DIRECTIONS[selection.selectedDirectionId];
  const palette = PALETTES[selection.visualPreferences.paletteId];
  const visual = VISUAL_DIRECTION_COPY[selection.visualPreferences.visualDirectionId];
  const intent = selection.intent ? INTENT_COPY[selection.intent].label : "Not specified";
  const undecided = undecidedFromSelection(selection);

  return [
    "Aethelios Atelier — direction prepared on this device",
    "",
    `Business: ${name}`,
    selection.businessType ? `Type: ${BUSINESS_TYPE_COPY[selection.businessType].label}` : "Type: not specified",
    `Direction: ${direction.name} — ${direction.epithet}`,
    `Palette: ${palette.label}`,
    `Visual: ${visual.label}`,
    selection.visualPreferences.headline ? `Headline: ${selection.visualPreferences.headline}` : "",
    `Aim: ${intent}`,
    selection.intentNote.trim() ? `Written intent:\n${selection.intentNote.trim()}` : "",
    selection.desiredQualities.length
      ? `Qualities: ${selection.desiredQualities.map((id) => QUALITY_COPY[id].label).join(", ")}`
      : "Qualities: not specified",
    selection.audience.trim() ? `Audience: ${selection.audience.trim()}` : "",
    selection.likesNote.trim() ? `What they like:\n${selection.likesNote.trim()}` : "",
    selection.changeNote.trim() ? `What to change:\n${selection.changeNote.trim()}` : "",
    selection.exclusions.trim() ? `Exclusions:\n${selection.exclusions.trim()}` : "",
    "",
    undecided.length ? `Still undecided: ${undecided.join(", ")}.` : "No additional unknowns from this sketch.",
    "Timing, budget, booking provider, and technical scope were not inferred from this direction.",
    "This sketch stays on this device. It has not been added to an account or sent for founder review."
  ]
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""))
    .join("\n");
}

function toProposal(
  field: BriefFieldKey,
  proposedValue: string,
  reason: string,
  existingBrief: Brief
): BriefProposal {
  const existingValue = existingBrief[field]?.value ?? "";
  return {
    field,
    proposedValue,
    reason,
    existingValue,
    conflict: existingValue.trim().length > 0 && existingValue.trim() !== proposedValue.trim(),
    apply: "propose"
  };
}

function proposeVision(selection: DiscoverySelection): string {
  const name = selection.businessName.trim();
  const type = selection.businessType ? BUSINESS_TYPE_COPY[selection.businessType].label : "";
  const intent = selection.intent ? INTENT_COPY[selection.intent].label : "";
  const note = selection.intentNote.trim();
  const parts = [
    name ? `${name}.` : "",
    type ? `A ${type.toLowerCase()} business.` : "",
    intent ? `They want to ${intent.toLowerCase()}.` : "",
    note ? note : ""
  ].filter(Boolean);
  return parts.join(" ").trim();
}

function proposeAudience(selection: DiscoverySelection): string {
  const written = selection.audience.trim();
  const feeling = selection.customerFeeling ? `Customers should feel ${selection.customerFeeling}.` : "";
  return [written, feeling].filter(Boolean).join(" ").trim();
}

function proposeReferences(selection: DiscoverySelection): string {
  const direction = DIRECTIONS[selection.selectedDirectionId];
  const palette = PALETTES[selection.visualPreferences.paletteId];
  const visual = VISUAL_DIRECTION_COPY[selection.visualPreferences.visualDirectionId];
  const qualities = selection.desiredQualities.map((id) => QUALITY_COPY[id].label).join(", ");
  const headline = selection.visualPreferences.headline.trim();
  return [
    `Confirmed discovery direction: ${direction.name} (${direction.epithet}).`,
    `Palette: ${palette.label}.`,
    `Visual direction: ${visual.label}.`,
    headline ? `Working headline: ${headline}.` : "",
    qualities ? `Qualities: ${qualities}.` : "",
    "These are curated, personalized directions — not live model output and not completed project photography."
  ]
    .filter(Boolean)
    .join(" ");
}

function proposePriorities(selection: DiscoverySelection): string {
  const qualities = selection.desiredQualities.map((id) => QUALITY_COPY[id].label);
  return [
    qualities.length ? `Desired qualities: ${qualities.join(", ")}.` : "",
    selection.likesNote.trim() ? `What they like:\n${selection.likesNote.trim()}` : "",
    selection.changeNote.trim() ? `What they want changed:\n${selection.changeNote.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

export function existingBriefUntouchedProof(before: Brief, after: Brief): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

export function decisionsFor(
  mapping: DiscoveryBriefMapping,
  decision: ApplyDecision
): Partial<Record<BriefFieldKey, ApplyDecision>> {
  return Object.fromEntries(mapping.proposals.map((item) => [item.field, decision]));
}
