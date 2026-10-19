import type { AuthContext, ClientProjectView, NextStep, Project } from "@/lib/types";

export function deriveNextStep(input: {
  project: Project;
  auth: AuthContext | null;
  reviewStartedAt: string | null;
  openClarification: boolean;
  hasClientVisibleDecision: boolean;
}): NextStep {
  const { project, auth, reviewStartedAt, openClarification, hasClientVisibleDecision } = input;

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

  if (hasClientVisibleDecision) {
    return {
      code: "read_founder_update",
      label: "Read Neil’s update",
      detail: "A client-visible note has been published. Scope and price remain unconfirmed until a labeled decision says otherwise."
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
      hasClientVisibleDecision: view.updates.some((update) => update.kind === "decision")
    })
  };
}
