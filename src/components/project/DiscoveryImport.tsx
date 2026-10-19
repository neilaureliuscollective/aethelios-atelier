"use client";

import { useEffect, useMemo, useState } from "react";
import { FIELD_LABELS } from "@/lib/brief";
import {
  applyDiscoveryImport,
  browserStorage,
  prepareDiscoveryImport,
  readDiscovery,
  readDiscoveryHandoff,
  type ApplyDecision,
  type DiscoveryBriefMapping,
  type DiscoverySelection
} from "@/lib/discovery";
import type { Brief, BriefFieldKey } from "@/lib/types";

export function DiscoveryImport({
  brief,
  revision,
  blocked,
  onApply
}: {
  brief: Brief;
  revision?: number | null;
  blocked?: boolean;
  onApply: (next: Brief) => void;
}) {
  const [selection, setSelection] = useState<DiscoverySelection | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [decisions, setDecisions] = useState<Partial<Record<BriefFieldKey, ApplyDecision>>>({});
  const [boundRevision, setBoundRevision] = useState<number | null>(null);

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

  const prepared = useMemo(() => {
    if (!selection) return null;
    return prepareDiscoveryImport({ rawSelection: selection, currentBrief: brief });
  }, [selection, brief]);

  const mapping: DiscoveryBriefMapping | null = prepared && prepared.ok ? prepared.mapping : null;

  if (!selection) return null;

  function startReview() {
    if (blocked) {
      setMessage("Resolve the recovery comparison before adding a prepared direction.");
      return;
    }
    setOpen(true);
    setBoundRevision(typeof revision === "number" ? revision : null);
    setMessage("Choose append, replace, or skip for each proposed field. This is not a submission.");
    if (mapping) {
      setDecisions(Object.fromEntries(mapping.proposals.map((item) => [item.field, item.conflict ? "skip" : "replace"])));
    }
  }

  function apply() {
    if (!selection) return;
    const result = applyDiscoveryImport({
      rawSelection: selection,
      currentBrief: brief,
      decisions,
      expectedRevision: boundRevision,
      currentRevision: typeof revision === "number" ? revision : boundRevision
    });
    if (!result.ok) {
      setMessage(result.reason);
      return;
    }
    onApply(result.brief);
    setOpen(false);
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
      {message ? <p className="notice">{message}</p> : null}
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
            <button className="btn btn-gold" type="button" onClick={apply}>
              Apply to this brief
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
