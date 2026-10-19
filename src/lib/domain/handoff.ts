import { briefTitle, FIELD_LABELS } from "@/lib/brief";
import { BRIEF_FIELD_KEYS } from "@/lib/types";
import type {
  Brief,
  ContentRequest,
  DeliveryHandoff,
  DeliveryMilestone,
  DeliveryVersion,
  Proposal,
  ProposalDecision
} from "@/lib/types";

function list(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None recorded";
}

function stamp(value?: string) {
  return value ? new Date(value).toISOString() : "n/a";
}

export function buildDeliveryHandoff(input: {
  projectId: string;
  title?: string;
  brief: Brief;
  proposal: Proposal | null;
  decisions: ProposalDecision[];
  deliveryVersions: DeliveryVersion[];
  contentRequests: ContentRequest[];
  milestones: DeliveryMilestone[];
}): DeliveryHandoff {
  const generatedAt = new Date().toISOString();
  const proposal = input.proposal;
  const title = input.title?.trim() || briefTitle(input.brief);
  const approvedDeliveries = input.deliveryVersions
    .filter((item) => item.status === "approved")
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.version - b.version);
  const openContent = input.contentRequests.filter((item) => item.status === "requested");
  const nextMilestone =
    input.milestones.find((item) => item.status === "current" || item.status === "waiting_on_client") ??
    input.milestones.find((item) => item.status === "upcoming") ??
    null;
  const approval = proposal
    ? input.decisions
        .filter((item) => item.proposalId === proposal.id && item.kind === "approve")
        .at(-1)
    : null;

  const briefLines = BRIEF_FIELD_KEYS.map((key) => {
    const field = input.brief[key];
    return `- ${FIELD_LABELS[key]}: ${field.value.trim() || "(empty)"} [${field.provenance}]`;
  }).join("\n");

  const markdown = `# Atelier delivery brief

Generated: ${generatedAt}
Project: ${input.projectId}
Title: ${title}
Confirmed proposal: ${proposal ? `v${proposal.version} (${proposal.id})` : "none"}
Approved at: ${approval ? stamp(approval.createdAt) : "not yet approved"}
Price: ${proposal?.scope.price.amount || "unset"} ${proposal?.scope.price.currency ?? "USD"} — ${proposal?.scope.price.paymentStatus ?? "not_collected"}
Payments: not collected in Atelier. This brief is agreed scope for delivery, not an invoice.

Use this as the implementation brief in Cursor or Codex. Later, Architect can consume the same fields.

## Vision
${proposal?.scope.summary || input.brief.vision.value || "(not recorded)"}

## Brand direction
${proposal?.scope.brandDirection || input.brief.references.value || input.brief.priorities.value || "(not recorded)"}

## Deliverables
${list(proposal?.scope.deliverables ?? [])}

## Included pages
${list(proposal?.scope.includedPages ?? [])}

## Included features
${list(proposal?.scope.includedFeatures ?? [])}

## Exclusions
${list(proposal?.scope.exclusions ?? [])}

## Client responsibilities
${list(proposal?.scope.clientResponsibilities ?? [])}

## Milestones
${
  proposal?.scope.milestones.length
    ? proposal.scope.milestones
        .map((item, index) => {
          const live = input.milestones.find((row) => row.sortOrder === index);
          return `- ${item.title}${item.timing ? ` (${item.timing})` : ""}${live ? ` — ${live.status}` : ""}: ${item.description}`;
        })
        .join("\n")
    : "- None recorded"
}

## Next milestone
${
  nextMilestone
    ? `${nextMilestone.title} [${nextMilestone.status}] ${nextMilestone.description}`
    : "No open milestone."
}

## Approved design and build versions
${
  approvedDeliveries.length
    ? approvedDeliveries
        .map(
          (item) =>
            `- ${item.kind} v${item.version}: ${item.title}\n  Changed: ${item.summary}\n  Notes: ${item.notes || "none"}\n  Preview: ${item.previewUrl || "none"}`
        )
        .join("\n")
    : "- None approved yet"
}

## Open client content
${
  openContent.length
    ? openContent.map((item) => `- ${item.title}: ${item.detail}`).join("\n")
    : "- None waiting"
}

## Submitted snapshot
${briefLines}
`;

  return {
    generatedAt,
    projectId: input.projectId,
    title,
    confirmedProposalId: proposal?.id ?? null,
    confirmedProposalVersion: proposal?.version ?? null,
    markdown
  };
}
