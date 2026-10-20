"use client";

import { useEffect, useMemo, useState } from "react";
import {
  applyPlanInterest,
  clearStoredPlanInterest,
  createPlanInterestRecord,
  proposePlanInterest,
  readPlanInterestFromSearch,
  readStoredPlanInterest,
  writeStoredPlanInterest,
  type PlanInterestDecision
} from "@/lib/pricing/context";
import { PLAN_LABELS, parsePlanId, type PlanId } from "@/lib/pricing/ids";
import { fieldDecisionLabel } from "@/lib/copy";
import type { Brief } from "@/lib/types";

export function PlanInterest({
  brief,
  blocked,
  onApply
}: {
  brief: Brief;
  blocked?: boolean;
  onApply: (next: Brief) => void;
}) {
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<PlanInterestDecision>("append");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fromSearch = readPlanInterestFromSearch(window.location.search);
    if (fromSearch) {
      writeStoredPlanInterest(createPlanInterestRecord(fromSearch));
      setPlanId(fromSearch);
      return;
    }
    const stored = readStoredPlanInterest();
    setPlanId(stored?.planId ?? null);
  }, []);

  const proposal = useMemo(() => (planId ? proposePlanInterest(brief, planId) : null), [brief, planId]);

  if (!planId || !proposal) return null;

  function startReview() {
    if (!proposal) return;
    if (blocked) {
      setMessage("Resolve the recovery comparison before adding a plan discussion note.");
      return;
    }
    setDecision(proposal.defaultDecision);
    setOpen(true);
    setMessage("Review how this plan note is added. This does not start a subscription or submit the brief.");
  }

  function apply() {
    if (!planId) return;
    if (blocked) {
      setMessage("Resolve the recovery comparison before adding a plan discussion note.");
      return;
    }
    onApply(applyPlanInterest({ brief, planId, decision }));
    setOpen(false);
    setMessage("Plan discussion note updated on this brief. Review it before sending. Nothing was purchased.");
  }

  function forgetSearchPlan() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("plan")) return;
    url.searchParams.delete("plan");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }

  function dismiss() {
    clearStoredPlanInterest();
    forgetSearchPlan();
    setPlanId(null);
    setOpen(false);
    setMessage("");
  }

  function changePlan(next: string) {
    const parsed = parsePlanId(next);
    if (!parsed) return;
    writeStoredPlanInterest(createPlanInterestRecord(parsed));
    setPlanId(parsed);
    setDecision(proposePlanInterest(brief, parsed).defaultDecision);
  }

  return (
    <aside className="surface-glass plan-interest" style={{ padding: 16, marginBottom: 18 }}>
      <p className="tiny">Plan to discuss</p>
      <p>
        {PLAN_LABELS[planId]}. Selecting this did not create a subscription, accept terms, or
        overwrite the brief.
      </p>
      <p className="muted">
        The note is offered for the constraints field. You can add it to existing notes, replace
        those notes, or leave them unchanged.
      </p>
      {message ? <p className="notice">{message}</p> : null}
      {!open ? (
        <div className="row">
          <button className="btn btn-ghost btn-compact" type="button" onClick={startReview}>
            Review this plan note
          </button>
          <button className="btn btn-ghost btn-compact" type="button" onClick={dismiss}>
            Dismiss
          </button>
        </div>
      ) : (
        <div className="stack">
          <label>
            <span className="lbl">Plan</span>
            <select
              value={planId}
              onChange={(event) => changePlan(event.target.value)}
              aria-label="Plan to discuss"
            >
              {(Object.keys(PLAN_LABELS) as PlanId[]).map((id) => (
                <option key={id} value={id}>
                  {PLAN_LABELS[id]}
                </option>
              ))}
            </select>
          </label>
          {proposal.existingValue.trim() ? (
            <p className="muted">Already in the brief: {proposal.existingValue}</p>
          ) : (
            <p className="muted">The constraints field is currently empty.</p>
          )}
          <p>{proposal.proposedValue}</p>
          <div className="row" role="radiogroup" aria-label="Plan note decision">
            {(["append", "replace", "skip"] as PlanInterestDecision[]).map((option) => (
              <label className="chip" key={option}>
                <input
                  type="radio"
                  name="plan-interest-decision"
                  checked={decision === option}
                  onChange={() => setDecision(option)}
                />
                <span>{fieldDecisionLabel(option)}</span>
              </label>
            ))}
          </div>
          <div className="row">
            <button className="btn btn-gold" type="button" onClick={apply} disabled={Boolean(blocked)}>
              Apply to this brief
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-ghost" type="button" onClick={dismiss}>
              Dismiss plan
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
