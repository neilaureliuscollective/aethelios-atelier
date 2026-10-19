"use client";

import { useState } from "react";
import { ProposalActions } from "@/components/proposal/ProposalActions";
import { ProposalDocument } from "@/components/proposal/ProposalDocument";
import { ReviewRoom } from "@/components/proposal/ReviewRoom";
import { api } from "@/lib/client/api";
import { currentClientProposal } from "@/lib/domain/proposal";
import type { ClientProjectView, ContentRequest, DeliveryVersion } from "@/lib/types";

export function WorkspaceDelivery({
  view,
  pending,
  onReload
}: {
  view: ClientProjectView;
  pending: boolean;
  onReload: () => Promise<void>;
}) {
  const live = currentClientProposal(view.proposals);
  const history = view.proposals.slice().sort((a, b) => b.version - a.version);
  const openContent = view.contentRequests.filter((item) => item.status === "requested");
  const [contentReplies, setContentReplies] = useState<Record<string, string>>({});

  async function decide(action: "approve" | "request_changes", body = "") {
    if (!live) return;
    await api(`/api/projects/${view.project.id}/proposals/${live.id}/decide`, {
      method: "POST",
      body: JSON.stringify({
        action,
        expectedVersion: live.version,
        body,
        consent: action === "approve",
        agreementTextAcknowledged: action === "approve"
      })
    });
    await onReload();
  }

  async function feedback(version: DeliveryVersion, kind: "comment" | "request_changes" | "approve", body = "") {
    await api(`/api/projects/${view.project.id}/delivery-versions/${version.id}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        kind,
        expectedVersion: version.version,
        body,
        consent: kind === "approve",
        agreementTextAcknowledged: kind === "approve"
      })
    });
    await onReload();
  }

  async function respond(request: ContentRequest) {
    const body = contentReplies[request.id]?.trim();
    if (!body) return;
    await api(`/api/projects/${view.project.id}/content-requests/${request.id}`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
    setContentReplies((current) => ({ ...current, [request.id]: "" }));
    await onReload();
  }

  return (
    <div className="stack" style={{ marginTop: 16 }}>
      {live ? (
        <article className="surface-dimensional proposal-stage">
          <ProposalDocument proposal={live} decisions={view.proposalDecisions} />
          <ProposalActions
            proposal={live}
            pending={pending}
            onApprove={() => decide("approve")}
            onRequestChanges={(body) => decide("request_changes", body)}
          />
        </article>
      ) : (
        <p className="notice">No client-visible proposal yet. Neil reviews the brief privately before publishing a scoped version.</p>
      )}

      {history.length > 1 ? (
        <div className="surface-glass" style={{ padding: 24 }}>
          <h2>Proposal versions</h2>
          {history.map((item) => (
            <p className="tiny" key={item.id}>
              v{item.version} · {item.status.replaceAll("_", " ")}
              {item.changeSummary ? ` — ${item.changeSummary}` : ""}
            </p>
          ))}
        </div>
      ) : null}

      {openContent.length ? (
        <article className="surface-dense" style={{ padding: 24 }}>
          <p className="tiny">Missing materials</p>
          <h2>Content Neil still needs</h2>
          {openContent.map((item) => (
            <div className="brief-item" key={item.id}>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <label>
                <span className="lbl">Your materials or note</span>
                <textarea
                  value={contentReplies[item.id] ?? ""}
                  onChange={(event) =>
                    setContentReplies((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                />
              </label>
              <button
                className="btn btn-gold"
                type="button"
                disabled={pending || !contentReplies[item.id]?.trim()}
                onClick={() => void respond(item)}
              >
                Send materials
              </button>
            </div>
          ))}
        </article>
      ) : null}

      {view.milestones.length ? (
        <article className="surface-glass" style={{ padding: 24 }}>
          <h2>Delivery progression</h2>
          <ol className="proposal-milestones">
            {view.milestones.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong> <span className="tiny">{item.status.replaceAll("_", " ")}</span>
                <p>{item.description}</p>
              </li>
            ))}
          </ol>
        </article>
      ) : null}

      <ReviewRoom
        versions={view.deliveryVersions}
        feedback={view.deliveryFeedback}
        pending={pending}
        onComment={(version, body) => feedback(version, "comment", body)}
        onRequestChanges={(version, body) => feedback(version, "request_changes", body)}
        onApprove={(version) => feedback(version, "approve")}
      />
    </div>
  );
}
