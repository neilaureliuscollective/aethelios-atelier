"use client";

import { useEffect, useMemo, useState } from "react";
import { fieldDecisionLabel, type FieldDecision } from "@/lib/copy";
import { isServiceOfferId } from "@/lib/offers/ids";
import { isFocusedOffer, offerImportNotice } from "@/lib/offers/registry";
import { applyOfferImportDecisions, dismissOfferImport, proposeOfferImport } from "@/lib/offers/intake";
import { parseCommissionIntent } from "@/lib/commissionContext";
import type { Brief, BriefFieldKey } from "@/lib/types";

function forgetOfferSearch() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("offer")) return;
  url.searchParams.delete("offer");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function OfferImport({
  brief,
  blocked,
  onApply
}: {
  brief: Brief;
  blocked?: boolean;
  onApply: (next: Brief) => void;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [searchOffer, setSearchOffer] = useState("");
  const [decisions, setDecisions] = useState<Partial<Record<BriefFieldKey, FieldDecision>>>({});

  useEffect(() => {
    setSearchOffer(parseCommissionIntent(new URLSearchParams(window.location.search)).context.offerId);
  }, []);

  const offerId = brief.context?.offerId || searchOffer;
  const proposal = useMemo(
    () => (isServiceOfferId(offerId) ? proposeOfferImport(brief, offerId) : null),
    [brief, offerId]
  );

  useEffect(() => {
    if (!proposal) return;
    setDecisions((current) => {
      const next = { ...current };
      for (const field of proposal.fields) {
        if (!next[field.key]) next[field.key] = field.defaultDecision;
      }
      return next;
    });
  }, [proposal]);

  if (!proposal || !offerId) return null;

  function startReview() {
    if (blocked) {
      setMessage("Resolve the recovery comparison before changing imported offer details.");
      return;
    }
    setOpen(true);
    setMessage("Review each imported note. Existing wording stays unless you choose to add or replace it.");
  }

  function apply() {
    if (blocked) {
      setMessage("Resolve the recovery comparison before changing imported offer details.");
      return;
    }
    onApply(applyOfferImportDecisions(brief, decisions, isServiceOfferId(offerId) ? offerId : "barbers_salons"));
    setOpen(false);
    setMessage("Offer details updated on this brief. Review them before sending. Nothing was purchased or scheduled.");
  }

  function dismiss() {
    onApply(dismissOfferImport(brief));
    forgetOfferSearch();
    setOpen(false);
    setMessage("");
  }

  return (
    <aside className="surface-glass plan-interest" style={{ padding: 16, marginBottom: 18 }}>
      <p className="tiny">Focused offer</p>
      <p>
        {proposal.title}. {offerImportNotice(proposal.offerId)}
      </p>
      <p className="muted">
        Imported notes are offered for review. You can add them to existing wording, replace that
        wording, leave it unchanged, or dismiss the offer context.
      </p>
      {isFocusedOffer(brief) ? (
        <p className="notice">This brief is marked as {proposal.title}.</p>
      ) : (
        <p className="notice">Offer details are available to review. They have not overwritten this brief.</p>
      )}
      {message ? <p className="notice">{message}</p> : null}
      {!open ? (
        <div className="row">
          <button className="btn btn-ghost btn-compact" type="button" onClick={startReview}>
            Review imported details
          </button>
          <button className="btn btn-ghost btn-compact" type="button" onClick={dismiss}>
            Dismiss offer
          </button>
        </div>
      ) : (
        <div className="stack">
          {proposal.fields.map((field) => (
            <div key={field.key} className="brief-item">
              <strong>{field.label}</strong>
              {field.current ? (
                <p className="muted">Already in the brief: {field.current}</p>
              ) : (
                <p className="muted">This field is currently empty. Unknown can stay unknown.</p>
              )}
              <p>{field.proposed}</p>
              <div className="row" role="radiogroup" aria-label={`${field.label} decision`}>
                {(["append", "replace", "skip"] as FieldDecision[]).map((option) => (
                  <label className="chip" key={option}>
                    <input
                      type="radio"
                      name={`offer-import-${field.key}`}
                      checked={(decisions[field.key] ?? field.defaultDecision) === option}
                      onChange={() => setDecisions((current) => ({ ...current, [field.key]: option }))}
                    />
                    <span>{fieldDecisionLabel(option)}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
          <div className="row">
            <button className="btn btn-gold" type="button" onClick={apply} disabled={Boolean(blocked)}>
              Apply to this brief
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-ghost" type="button" onClick={dismiss}>
              Dismiss offer
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
