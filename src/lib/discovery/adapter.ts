import { createEmptyBrief } from "@/lib/brief";
import { BRIEF_FIELD_KEYS, type Brief, type BriefFieldKey } from "@/lib/types";
import { BUSINESS_TYPE_COPY, DIRECTIONS, INTENT_COPY, PALETTES, QUALITY_COPY, VISUAL_DIRECTION_COPY } from "./catalog";
import { displayName } from "./sanitize";
import { serviceInterestToProjectType, type BriefProposal, type DiscoveryBriefMapping, type DiscoverySelection } from "./types";

const NEVER_INFERRED: BriefFieldKey[] = [
  "timing",
  "budget",
  "bookingProvider",
  "existingWebsite",
  "goals"
];

export function mapSelectionToBriefProposals(
  selection: DiscoverySelection,
  existingBrief: Brief = createEmptyBrief()
): DiscoveryBriefMapping {
  const proposals: BriefProposal[] = [];
  const unknowns: string[] = [];
  const warnings: string[] = [];

  const vision = proposeVision(selection);
  if (vision) proposals.push(toProposal("vision", vision, "Business name and stated intent.", existingBrief));
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
    proposals.push(toProposal("priorities", priorities, "Explicit visitor notes about what they like.", existingBrief));
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

  if (selection.catalogVersion !== 1 || selection.templateVersion !== 1) {
    warnings.push("Catalog or template version is not the current discovery catalog; do not import blindly.");
  }

  const proposedKeys = new Set(proposals.map((item) => item.field));
  const untouchedFields = BRIEF_FIELD_KEYS.filter((key) => !proposedKeys.has(key));

  return {
    version: 1,
    kind: "discovery_brief_mapping",
    sourceSelectionId: selection.selectionId,
    sourceRevision: selection.localRevision,
    proposals,
    untouchedFields,
    summary: buildReadableSummary(selection, proposals, unknowns),
    unknowns,
    warnings
  };
}

export function applyProposals(
  existingBrief: Brief,
  mapping: DiscoveryBriefMapping,
  decisions: Partial<Record<BriefFieldKey, "append" | "replace" | "skip">>
): Brief {
  const next: Brief = { ...existingBrief };
  for (const proposal of mapping.proposals) {
    const decision = decisions[proposal.field] ?? (proposal.conflict ? "skip" : "replace");
    if (decision === "skip") continue;
    const current = existingBrief[proposal.field].value;
    const value =
      decision === "append" && current.trim()
        ? `${current.trim()}\n\n${proposal.proposedValue}`
        : proposal.proposedValue;
    next[proposal.field] = {
      key: proposal.field,
      value,
      provenance: "client_statement",
      unresolvedQuestion: undefined,
      pendingSuggestionId: undefined
    };
  }
  return next;
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
  const parts = [
    name ? `${name}` : "",
    type ? `A ${type.toLowerCase()} business.` : "",
    intent ? `They want to ${intent.toLowerCase()}.` : ""
  ].filter(Boolean);
  return parts.join(" ").trim();
}

function proposeAudience(selection: DiscoverySelection): string {
  const written = selection.audience.trim();
  const feeling = selection.customerFeeling
    ? `Customers should feel ${selection.customerFeeling}.`
    : "";
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
  const notes = selection.visitorNotes.trim();
  const qualities = selection.desiredQualities.map((id) => QUALITY_COPY[id].label);
  const parts = [
    qualities.length ? `Desired qualities: ${qualities.join(", ")}.` : "",
    notes
  ].filter(Boolean);
  return parts.join("\n\n").trim();
}

function buildReadableSummary(
  selection: DiscoverySelection,
  proposals: BriefProposal[],
  unknowns: string[]
): string {
  const name = displayName(selection.businessName);
  const direction = DIRECTIONS[selection.selectedDirectionId];
  const palette = PALETTES[selection.visualPreferences.paletteId];
  const visual = VISUAL_DIRECTION_COPY[selection.visualPreferences.visualDirectionId];
  const lines = [
    `Aethelios Atelier — discovery direction (prepared on this device)`,
    `Selection ${selection.selectionId} · revision ${selection.localRevision}`,
    `Catalog ${selection.catalogVersion} / template ${selection.templateVersion}`,
    "",
    `Business: ${name}`,
    selection.businessType ? `Type: ${BUSINESS_TYPE_COPY[selection.businessType].label}` : "Type: not specified",
    `Direction: ${direction.name} — ${direction.epithet}`,
    `Palette: ${palette.label}`,
    `Visual: ${visual.label}`,
    selection.visualPreferences.headline ? `Headline: ${selection.visualPreferences.headline}` : "",
    selection.desiredQualities.length
      ? `Qualities: ${selection.desiredQualities.map((id) => QUALITY_COPY[id].label).join(", ")}`
      : "Qualities: not specified",
    selection.audience ? `Audience: ${selection.audience}` : "",
    selection.visitorNotes ? `Notes:\n${selection.visitorNotes}` : "",
    selection.exclusions ? `Exclusions:\n${selection.exclusions}` : "",
    "",
    "Proposed brief fields (not written to any project):",
    ...proposals.map(
      (item) =>
        `- ${item.field}: ${item.conflict ? "conflicts with existing brief field — append/replace/skip required" : "empty on existing brief"}`
    ),
    "",
    unknowns.length ? `Left unknown: ${unknowns.join(", ")}` : "No additional unknowns from discovery.",
    "Timing, budget, booking provider, existing website, and technical scope are not inferred.",
    "Status: direction prepared on this device. Not submitted, not added to an account, and not imported until the repaired brief controller asks for append/replace/skip and fresh consent."
  ];
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n");
}

export function existingBriefUntouchedProof(before: Brief, after: Brief): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}
