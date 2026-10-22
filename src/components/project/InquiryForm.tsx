"use client";

import { useMemo, useState } from "react";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { INQUIRY_CONSENT_TEXT } from "@/lib/copy";
import type { Brief } from "@/lib/types";

type InquirySuccess = {
  receiptId: string;
  labeled: boolean;
  note: string;
};

export function InquiryForm({
  source,
  brief,
  consent,
  onConsentChange,
  showConsent = true,
  needLabel = "What do you need?",
  submitLabel = "Send inquiry"
}: {
  source: "brief" | "inquire";
  brief?: Brief;
  consent?: boolean;
  onConsentChange?: (value: boolean) => void;
  showConsent?: boolean;
  needLabel?: string;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [business, setBusiness] = useState("");
  const [need, setNeed] = useState("");
  const [honey, setHoney] = useState("");
  const [localConsent, setLocalConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");
  const [receipt, setReceipt] = useState<InquirySuccess | null>(null);
  const idempotencyKey = useMemo(
    () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `inq_${Date.now()}`),
    []
  );

  const consented = Boolean(consent ?? localConsent);

  async function submit() {
    if (pending || receipt) return;
    if (!consented) {
      setError("Consent is required before this inquiry is sent.");
      return;
    }
    setPending(true);
    setError("");
    setMailto("");
    try {
      const result = await api<InquirySuccess & { ok: boolean }>(`/api/inquiries`, {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          business,
          need: need.trim() || (source === "brief" ? briefNeedFallback(brief) : need),
          source,
          consent: true,
          honeypot: honey,
          brief: source === "brief" ? brief : undefined,
          idempotencyKey
        })
      });
      setReceipt({
        receiptId: result.receiptId,
        labeled: result.labeled,
        note: result.note
      });
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { mailto?: string; message?: string } | undefined) : undefined;
      setMailto(typeof body?.mailto === "string" ? body.mailto : "");
      setError(actionErrorMessage(err, "The inquiry could not be sent."));
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <article className="receipt-card surface-glass inquiry-receipt">
        <p className="tiny">{receipt.labeled ? "Local rehearsal receipt" : "Inquiry received"}</p>
        <p>Receipt {receipt.receiptId}. {receipt.note}</p>
      </article>
    );
  }

  return (
    <form
      className="inquiry-form stack"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label>
        <span className="lbl">Your name</span>
        <input
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label>
        <span className="lbl">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
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
        <span className="lbl">{needLabel}</span>
        <textarea
          className="inquiry-need"
          name="need"
          rows={4}
          value={need}
          onChange={(event) => setNeed(event.target.value)}
          required={source !== "brief"}
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
      {showConsent ? (
        <label className="notice" style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={consent ?? localConsent}
            onChange={(event) => {
              const checked = event.target.checked;
              if (onConsentChange) onConsentChange(checked);
              else setLocalConsent(checked);
            }}
          />{" "}
          {INQUIRY_CONSENT_TEXT}
        </label>
      ) : null}
      {error ? <p className="notice notice-warn">{error}</p> : null}
      <div className="row brief-actions">
        <button className="btn btn-gold" type="submit" disabled={pending || !consented}>
          {pending ? "Sending…" : submitLabel}
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

function briefNeedFallback(brief?: Brief) {
  const vision = brief?.vision.value?.trim();
  if (vision) return vision;
  const goals = brief?.goals.value?.trim();
  if (goals) return goals;
  return "Please review the attached brief.";
}
