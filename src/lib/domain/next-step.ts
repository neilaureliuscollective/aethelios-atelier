import {
  confirmedProposal,
  currentClientProposal,
  currentDeliveryReview
} from "@/lib/domain/proposal";
import type {
  AuthContext,
  ClientProjectView,
  ContentRequest,
  DeliveryMilestone,
  DeliveryVersion,
  NextStep,
  Project,
  Proposal
} from "@/lib/types";

export function deriveNextStep(input: {
  project: Project;
  auth: AuthContext | null;
  reviewStartedAt: string | null;
  openClarification: boolean;
  hasClientVisibleDecision: boolean;
  proposals?: Proposal[];
  deliveryVersions?: DeliveryVersion[];
  contentRequests?: ContentRequest[];
  milestones?: DeliveryMilestone[];
}): NextStep {
  const {
    project,
    auth,
    reviewStartedAt,
    openClarification,
    hasClientVisibleDecision,
    proposals = [],
    deliveryVersions = [],
    contentRequests = [],
    milestones = []
  } = input;

  if (project.status === "draft") {
    if (!auth) {
      return {
        code: "sign_in_to_submit",
        label: "Continue locally, then sign in to send",
        detail:
          "Guest drafts stay on this device. Signing in will not send the brief. You will be asked to review and adopt it first."
      };
    }
    return {
      code: "continue_draft",
      label: "Finish the brief, then consent to send it",
      detail: "Nothing is sent to Neil until you review the snapshot and give explicit consent."
    };
  }

  if (openClarification) {
    return {
      code: "respond_to_clarification",
      label: "A clarification is waiting",
      detail: "Neil asked a question. Your reply is stored with this commission and does not rewrite the submitted snapshot."
    };
  }

  const liveProposal = currentClientProposal(proposals);
  if (liveProposal?.status === "published") {
    return {
      code: "review_proposal",
      label: `Review proposal v${liveProposal.version}`,
      detail:
        "Neil published a scoped proposal. Request changes or record agreement to this exact version. Later edits will become a new version."
    };
  }
  if (liveProposal?.status === "changes_requested") {
    return {
      code: "proposal_revision_in_progress",
      label: "Neil is revising the proposal",
      detail: `Your change request on v${liveProposal.version} is stored. The previous text stays until a new version is published.`
    };
  }

  const openContent = contentRequests.some((item) => item.status === "requested");
  if (openContent) {
    return {
      code: "provide_client_content",
      label: "Materials are waiting",
      detail: "Neil asked for client content needed to keep delivery moving. Your reply is stored with this commission."
    };
  }

  const liveDelivery = currentDeliveryReview(deliveryVersions);
  if (liveDelivery?.status === "awaiting_review") {
    return {
      code: "review_delivery_version",
      label: `Review ${liveDelivery.kind} v${liveDelivery.version}`,
      detail: "A design or build version is ready. Leave feedback, request changes, or approve this exact version."
    };
  }
  if (liveDelivery?.status === "changes_requested") {
    return {
      code: "proposal_revision_in_progress",
      label: "A revision is in progress",
      detail: `Your change request on ${liveDelivery.kind} v${liveDelivery.version} is stored. Neil will publish a new version rather than silently editing this one.`
    };
  }

  const approved = confirmedProposal(proposals);
  if (approved) {
    const nextMilestone =
      milestones.find((item) => item.status === "current" || item.status === "waiting_on_client") ??
      milestones.find((item) => item.status === "upcoming");
    return {
      code: "read_confirmed_scope",
      label: nextMilestone ? `Next: ${nextMilestone.title}` : `Scope confirmed (proposal v${approved.version})`,
      detail: nextMilestone
        ? `${nextMilestone.description} Agreed scope remains proposal v${approved.version} until a later version is approved.`
        : `You agreed to proposal v${approved.version}. That version is the delivery scope until a later version is reviewed and approved.`
    };
  }

  if (hasClientVisibleDecision) {
    return {
      code: "read_founder_update",
      label: "Read Neil’s update",
      detail: "A client-visible note has been published. Scope and price remain unconfirmed until a labeled proposal is agreed."
    };
  }

  if (reviewStartedAt) {
    return {
      code: "founder_is_reviewing",
      label: "Neil has started review",
      detail: "Review is in progress because an authorized founder event exists. Scope and pricing are still unconfirmed."
    };
  }

  return {
    code: "awaiting_founder_receipt",
    label: "Submitted — not yet under review",
    detail:
      "A durable receipt exists. Submitted is not the same as founder review. Review progress appears only after Neil opens the brief."
  };
}

export function toClientView(
  view: Omit<ClientProjectView, "nextStep">,
  auth: AuthContext | null
): ClientProjectView {
  const openClarification = view.updates.some(
    (update) =>
      update.kind === "clarification" &&
      update.requiresResponse &&
      !view.clarificationResponses.some((response) => response.updateId === update.id)
  );
  return {
    ...view,
    nextStep: deriveNextStep({
      project: view.project,
      auth,
      reviewStartedAt: view.reviewStartedAt,
      openClarification,
      hasClientVisibleDecision: view.updates.some((update) => update.kind === "decision"),
      proposals: view.proposals,
      deliveryVersions: view.deliveryVersions,
      contentRequests: view.contentRequests,
      milestones: view.milestones
    })
  };
}
