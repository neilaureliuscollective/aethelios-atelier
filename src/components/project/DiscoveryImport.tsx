"use client";

import { useEffect, useState } from "react";
import { FIELD_LABELS } from "@/lib/brief";
import {
  applyDiscoveryImport,
  browserStorage,
  captureDiscoveryImportReview,
  readDiscovery,
  readDiscoveryHandoff,
  reviewCaptureIsCurrent,
  type ApplyDecision,
  type DiscoverySelection,
  type ImportReviewCapture
} from "@/lib/discovery";
import type { Brief, BriefFieldKey } from "@/lib/types";

export function DiscoveryImport({
  brief,
  revision,
  ownerId = null,
  projectId = null,
  blocked,
  onApply
}: {
  brief: Brief;
  revision?: number | null;
  ownerId?: string | null;
  projectId?: string | null;
  blocked?: boolean;
  onApply: (next: Brief) => void;
}) {
  const [selection, setSelection] = useState<DiscoverySelection | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [decisions, setDecisions] = useState<Partial<Record<BriefFieldKey, ApplyDecision>>>({});
  const [capture, setCapture] = useState<ImportReviewCapture | null>(null);

  useEffect(() => {
    const handoff = readDiscoveryHandoff();
    if (handoff) {
      setSelection(handoff);
      return;
    }
    const stored = readDiscovery(browserStorage());
    if (stored.ok && stored.state === "opted_in" && stored.envelope?.confirmed) {
      setSelection(stored.envelope.confirmed);
      return;
    }
    setSelection(null);
  }, [brief]);

  const mapping = capture?.mapping ?? null;
  const staleOpen =
    Boolean(open && capture && selection) &&
    !reviewCaptureIsCurrent({
      capture: capture as ImportReviewCapture,
      currentBrief: brief,
      currentSelection: selection,
      currentOwnerId: ownerId,
      currentProjectId: projectId,
      currentRevision: typeof revision === "number" ? revision : null
    });

  if (!selection) return null;

  function startReview() {
    if (blocked) {
      setMessage("Resolve the recovery comparison before adding a prepared direction.");
      return;
    }
    const reviewed = captureDiscoveryImportReview({
      rawSelection: selection,
      currentBrief: brief,
      ownerId,
      projectId,
      briefRevision: typeof revision === "number" ? revision : null
    });
    if (!reviewed.ok) {
      setMessage(reviewed.reason);
      return;
    }
    setCapture(reviewed.capture);
    setOpen(true);
    setMessage("Choose append, replace, or skip for each proposed field. This is not a submission.");
    setDecisions(
      Object.fromEntries(
        reviewed.capture.mapping.proposals.map((item) => [item.field, item.conflict ? "skip" : "replace"])
      )
    );
  }

  function apply() {
    if (!selection || !capture) return;
    if (staleOpen) {
      setMessage(
        "The brief, prepared direction, or account changed while this review was open. Your newer text is still here. Review the import again before anything is applied."
      );
      return;
    }
    const result = applyDiscoveryImport({
      capture,
      currentBrief: brief,
      currentSelection: selection,
      decisions,
      currentOwnerId: ownerId,
      currentProjectId: projectId,
      currentRevision: typeof revision === "number" ? revision : null
    });
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    onApply(result.brief);
    setOpen(false);
    setCapture(null);
    setMessage(
      "Prepared direction added to this brief. Review the fields and consent before sending. Nothing was submitted or saved to an account."
    );
  }

  return (
    <aside className="surface-glass discovery-import" style={{ padding: 16, marginBottom: 18 }}>
      <p className="tiny">Prepared direction on this device</p>
      <p>
        {selection.businessName || "Your business"} · {selection.selectedDirectionId} · revision{" "}
        {selection.localRevision}
      </p>
      <p className="muted">
        This sketch stays on this device until you choose how to add it. It has not been sent to Neil
        and is not an account save.
      </p>
      <p className="muted">
        This commission import adds brief text. To keep the structured palette, typography,
        layout and imagery references for editable work, <a href="/companion/talk">open Companion
        and review saving this direction to your business</a>.
      </p>
      {message ? <p className="notice">{message}</p> : null}
      {staleOpen ? (
        <p className="notice notice-warn">
          Newer brief edits, a different direction snapshot, or a different account were detected.
          The open review will not overwrite them.
        </p>
      ) : null}
      {!open ? (
        <button className="btn btn-ghost btn-compact" type="button" onClick={startReview}>
          Review adding this to the brief
        </button>
      ) : (
        <div className="stack">
          {mapping?.proposals.map((proposal) => (
            <fieldset key={proposal.field} className="surface-read" style={{ padding: 12 }}>
              <legend className="lbl">{FIELD_LABELS[proposal.field]}</legend>
              {proposal.existingValue.trim() ? (
                <p className="muted">Already in the brief: {proposal.existingValue}</p>
              ) : (
                <p className="muted">This field is currently empty.</p>
              )}
              <p>{proposal.proposedValue}</p>
              <div className="row" role="radiogroup" aria-label={`${FIELD_LABELS[proposal.field]} import decision`}>
                {(["append", "replace", "skip"] as ApplyDecision[]).map((decision) => (
                  <label className="chip" key={decision}>
                    <input
                      type="radio"
                      name={`import-${proposal.field}`}
                      checked={decisions[proposal.field] === decision}
                      disabled={proposal.field === "projectType" && decision === "append"}
                      onChange={() => setDecisions((current) => ({ ...current, [proposal.field]: decision }))}
                    />
                    <span>{decision}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <div className="row">
            <button className="btn btn-gold" type="button" onClick={apply} disabled={staleOpen}>
              Apply to this brief
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => {
                setOpen(false);
                setCapture(null);
              }}
            >
              Cancel
            </button>
            {staleOpen ? (
              <button className="btn btn-ghost" type="button" onClick={startReview}>
                Review again
              </button>
            ) : null}
          </div>
        </div>
      )}
    </aside>
  );
}
