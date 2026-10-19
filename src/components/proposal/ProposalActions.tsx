"use client";

import { useState } from "react";
import { PROPOSAL_AGREEMENT_TEXT } from "@/lib/copy";
import type { Proposal } from "@/lib/types";

export function ProposalActions({
  proposal,
  pending,
  onApprove,
  onRequestChanges
}: {
  proposal: Proposal;
  pending: boolean;
  onApprove: () => Promise<void>;
  onRequestChanges: (body: string) => Promise<void>;
}) {
  const [changes, setChanges] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const canDecide = proposal.status === "published";

  async function run(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action did not complete.");
    }
  }

  if (!canDecide) {
    return proposal.status === "approved" ? (
      <p className="notice">This exact version is the agreed scope.</p>
    ) : proposal.status === "changes_requested" ? (
      <p className="notice">A change request is stored against this version. Neil will publish a new version rather than editing this text.</p>
    ) : (
      <p className="muted">This version is historical.</p>
    );
  }

  return (
    <div className="proposal-actions">
      <label className="consent-box">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>{PROPOSAL_AGREEMENT_TEXT}</span>
      </label>
      {error ? <p className="notice notice-warn">{error}</p> : null}
      <div className="row">
        <button
          className="btn btn-gold"
          type="button"
          disabled={pending || !consent}
          onClick={() => void run(onApprove)}
        >
          {pending ? "Recording…" : `Agree to v${proposal.version}`}
        </button>
      </div>
      <label>
        <span className="lbl">Request changes to this version</span>
        <textarea value={changes} onChange={(event) => setChanges(event.target.value)} />
      </label>
      <button
        className="btn btn-ghost"
        type="button"
        disabled={pending || !changes.trim()}
        onClick={() =>
          void run(async () => {
            await onRequestChanges(changes);
            setChanges("");
          })
        }
      >
        Request changes
      </button>
    </div>
  );
}
