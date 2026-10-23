"use client";

import { useMemo, useState } from "react";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { briefFromConcierge, inquiryNeedFromFacts } from "@/lib/concierge/brief";
import { trackConciergeEvent } from "@/lib/concierge/analytics";
import type { ConciergeFacts, ConciergeMessage } from "@/lib/concierge/types";
import { INQUIRY_CONSENT_TEXT } from "@/lib/copy";

type InquirySuccess = {
  receiptId: string;
  labeled: boolean;
  note: string;
};

export function ConciergeInquiry({
  facts,
  messages,
  path,
  onClose,
  onSubmitted
}: {
  facts: ConciergeFacts;
  messages: ConciergeMessage[];
  path: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const brief = useMemo(() => briefFromConcierge(facts, messages), [facts, messages]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState(facts.business ?? "");
  const [need, setNeed] = useState(() => inquiryNeedFromFacts(facts));
  const [honey, setHoney] = useState("");
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");
  const [receipt, setReceipt] = useState<InquirySuccess | null>(null);
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `cinq_${Date.now()}`),
    []
  );

  async function submit() {
    if (pending || receipt) return;
    if (!consent) {
      setError("Consent is required before this inquiry is sent.");
      return;
    }
    setPending(true);
    setError("");
    setMailto("");
    try {
      const result = await api<InquirySuccess>(`/api/inquiries`, {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          business,
          need: need.trim(),
          source: "concierge",
          consent: true,
          honeypot: honey,
          brief,
          idempotencyKey
        })
      });
      setReceipt(result);
      void trackConciergeEvent("inquiry_submitted", path);
      onSubmitted();
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { mailto?: string } | undefined) : undefined;
      setMailto(typeof body?.mailto === "string" ? body.mailto : "");
      setError(actionErrorMessage(err, "The inquiry could not be sent."));
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <div className="concierge-inquiry">
        <p className="tiny">{receipt.labeled ? "Local rehearsal receipt" : "Inquiry received"}</p>
        <p>Receipt {receipt.receiptId}. {receipt.note}</p>
        <button type="button" className="btn btn-ghost btn-compact" onClick={onClose}>
          Return to conversation
        </button>
      </div>
    );
  }

  return (
    <form
      className="concierge-inquiry stack"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className="tiny">Review before sending</p>
      <p className="muted">
        This uses the existing Atelier inquiry path. Nothing is sent until you consent. It is a request,
        not a booking.
      </p>
      <label>
        <span className="lbl">Your name</span>
        <input type="text" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        <span className="lbl">Email</span>
        <input type="email" name="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label>
        <span className="lbl">Business (optional)</span>
        <input
          type="text"
          name="business"
          autoComplete="organization"
          value={business}
          onChange={(event) => setBusiness(event.target.value)}
        />
      </label>
      <label>
        <span className="lbl">Project note</span>
        <textarea
          className="inquiry-need"
          name="need"
          rows={5}
          value={need}
          onChange={(event) => setNeed(event.target.value)}
          required
        />
      </label>
      <label className="inquiry-honey" aria-hidden="true">
        <span>Company website</span>
        <input
          type="text"
          name="company_website"
          tabIndex={-1}
          autoComplete="off"
          value={honey}
          onChange={(event) => setHoney(event.target.value)}
        />
      </label>
      <label className="notice" style={{ display: "block" }}>
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> {INQUIRY_CONSENT_TEXT}
      </label>
      {error ? <p className="notice notice-warn">{error}</p> : null}
      <div className="row brief-actions">
        <button className="btn btn-gold" type="submit" disabled={pending || !consent}>
          {pending ? "Sending…" : "Send inquiry"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onClose}>
          Back
        </button>
        {mailto ? (
          <a className="btn btn-ghost" href={mailto}>
            Open email app
          </a>
        ) : null}
      </div>
    </form>
  );
}
