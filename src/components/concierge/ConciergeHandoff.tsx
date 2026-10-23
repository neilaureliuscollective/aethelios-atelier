"use client";

import { useMemo, useState } from "react";
import { useAethelios } from "@/components/aethelios/AetheliosProvider";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { INQUIRY_CONSENT_TEXT } from "@/lib/copy";
import styles from "./concierge.module.css";

type HandoffResult = {
  receiptId: string;
  note: string;
};

export function ConciergeHandoff() {
  const { messages, document, preview, sessionId } = useAethelios();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");
  const [receipt, setReceipt] = useState<HandoffResult | null>(null);
  const canSend = useMemo(() => messages.some((item) => item.role === "user"), [messages]);

  if (!canSend) return null;

  async function submit() {
    if (pending || receipt) return;
    setPending(true);
    setError("");
    setMailto("");
    try {
      const result = await api<HandoffResult & { ok: boolean }>(`/api/concierge/handoff`, {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          sessionId,
          messages: messages.map((item) => ({ role: item.role, content: item.body })),
          document: document ?? undefined,
          previewGenerated: Boolean(preview),
          honeypot: honey
        })
      });
      setReceipt({ receiptId: result.receiptId, note: result.note });
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { mailto?: string; message?: string } | undefined) : undefined;
      setMailto(typeof body?.mailto === "string" ? body.mailto : "");
      setError(actionErrorMessage(err, "This conversation could not be sent."));
    } finally {
      setPending(false);
    }
  }

  if (receipt) {
    return (
      <article className={styles.handoffReceipt}>
        <p className={styles.meta}>Sent to Neil</p>
        <p>
          Receipt {receipt.receiptId}. {receipt.note}
        </p>
      </article>
    );
  }

  if (!open) {
    return (
      <div className={styles.handoff}>
        <button className="btn btn-gold" type="button" onClick={() => setOpen(true)}>
          Send this to Neil
        </button>
        <p className={styles.fine}>No account is required. He reviews the conversation — this is not a booking.</p>
      </div>
    );
  }

  return (
    <form
      className={styles.handoffForm}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <p className={styles.handoffLead}>Leave how Neil can reply. Your conversation stays a request, not a booking.</p>
      <label>
        <span>Your name</span>
        <input type="text" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        <span>Your email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className={styles.honey} aria-hidden="true">
        <span>Company website</span>
        <input type="text" tabIndex={-1} autoComplete="off" value={honey} onChange={(event) => setHoney(event.target.value)} />
      </label>
      <p className={styles.fine}>{INQUIRY_CONSENT_TEXT}</p>
      {error ? <p className="notice notice-warn">{error}</p> : null}
      <div className={styles.handoffActions}>
        <button className="btn btn-gold" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send this to Neil"}
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
