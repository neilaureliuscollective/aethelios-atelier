"use client";

import { useEffect, useRef, useState } from "react";
import { useAethelios, type AetheliosMessage } from "@/components/aethelios/AetheliosProvider";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { INQUIRY_CONSENT_TEXT, INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import styles from "./concierge.module.css";

type HandoffResult = {
  receiptId: string;
  note: string;
};

const MAX_TURNS = 24;
const MAX_TURN_CHARS = 2000;

/** Keeps the opening turn and the latest ones inside the handoff limits, with the visitor's note last. */
function handoffTurns(messages: AetheliosMessage[], note: string) {
  const turns = messages
    .filter((item) => item.body.trim())
    .map((item) => ({ role: item.role, content: item.body.trim().slice(0, MAX_TURN_CHARS) }));
  const extra = note.trim() ? [{ role: "user" as const, content: `Note for Neil: ${note.trim()}`.slice(0, MAX_TURN_CHARS) }] : [];
  const room = MAX_TURNS - extra.length;
  const kept = turns.length > room ? [turns[0]!, ...turns.slice(-(room - 1))] : turns;
  return [...kept, ...extra];
}

/** The single way a visitor sends the conversation and its document to Neil. */
export function ConciergeHandoff({ onSent }: { onSent?: () => void }) {
  const { messages, document, preview, sessionId, pending } = useAethelios();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [honey, setHoney] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mailto, setMailto] = useState("");
  const [receipt, setReceipt] = useState<HandoffResult | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const hasWords = messages.some((item) => item.role === "user");
  const writing = pending && !document?.slides.length;

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  async function submit() {
    if (sending || receipt) return;
    setSending(true);
    setError("");
    setMailto("");
    try {
      const result = await api<HandoffResult & { ok: boolean }>(`/api/concierge/handoff`, {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          sessionId,
          messages: handoffTurns(messages, note),
          document: document ?? undefined,
          previewGenerated: Boolean(preview),
          honeypot: honey
        })
      });
      setReceipt({ receiptId: result.receiptId, note: result.note });
      onSent?.();
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { mailto?: string; message?: string } | undefined) : undefined;
      setMailto(typeof body?.mailto === "string" ? body.mailto : "");
      setError(actionErrorMessage(err, "This conversation could not be sent."));
    } finally {
      setSending(false);
    }
  }

  if (receipt) {
    return (
      <div className={styles.sendBar} data-state="sent" role="status">
        <span className={styles.sendSeal} aria-hidden="true">
          ✓
        </span>
        <div className={styles.sendCopy}>
          <p className={styles.sendTitle}>Delivered to Neil.</p>
          <p className={styles.sendNote}>
            He reviews it personally and replies to <strong>{email.trim()}</strong>. Receipt {receipt.receiptId}.
          </p>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className={styles.sendBar} data-state={writing ? "writing" : "ready"}>
        <div className={styles.sendCopy}>
          <p className={styles.sendTitle}>
            {writing
              ? `${INTELLIGENCE_DISPLAY_NAME} is writing your direction…`
              : document
                ? "Your direction is ready."
                : "Ready when you are."}
          </p>
          <p className={styles.sendNote}>
            Send it with this conversation. No account, no payment — Neil reviews it personally.
          </p>
        </div>
        <button
          className="btn btn-gold"
          type="button"
          onClick={() => setOpen(true)}
          disabled={writing || !hasWords}
          data-send-to-neil
        >
          Send to Neil
          <span className="btn-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    );
  }

  return (
    <form
      className={styles.sendBar}
      data-state="open"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className={styles.sendCopy}>
        <p className={styles.sendTitle}>Where should Neil reply?</p>
        <p className={styles.sendNote}>The direction and your conversation travel with it.</p>
      </div>
      <div className={styles.sendFields}>
        <label>
          <span>Name</span>
          <input
            ref={nameRef}
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className={styles.sendWide}>
          <span>Anything to add? (optional)</span>
          <input
            type="text"
            name="note"
            maxLength={600}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Timeline, a link to your current site, the best time to talk…"
          />
        </label>
        <label className={styles.honey} aria-hidden="true">
          <span>Company website</span>
          <input type="text" tabIndex={-1} autoComplete="off" value={honey} onChange={(event) => setHoney(event.target.value)} />
        </label>
      </div>
      {error ? <p className="notice notice-warn">{error}</p> : null}
      <div className={styles.sendActions}>
        <button className="btn btn-gold" type="submit" disabled={sending}>
          {sending ? "Sending…" : "Send to Neil"}
        </button>
        {mailto ? (
          <a className="btn btn-ghost" href={mailto}>
            Open email app
          </a>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={() => setOpen(false)} disabled={sending}>
            Not yet
          </button>
        )}
      </div>
      <p className={styles.sendConsent}>By sending, you agree: {INQUIRY_CONSENT_TEXT}</p>
    </form>
  );
}
