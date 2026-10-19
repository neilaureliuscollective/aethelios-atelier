"use client";

import { useState } from "react";
import { DELIVERY_APPROVAL_TEXT } from "@/lib/copy";
import type { DeliveryFeedback, DeliveryVersion } from "@/lib/types";

export function ReviewRoom({
  versions,
  feedback,
  pending,
  onComment,
  onRequestChanges,
  onApprove
}: {
  versions: DeliveryVersion[];
  feedback: DeliveryFeedback[];
  pending: boolean;
  onComment: (version: DeliveryVersion, body: string) => Promise<void>;
  onRequestChanges: (version: DeliveryVersion, body: string) => Promise<void>;
  onApprove: (version: DeliveryVersion) => Promise<void>;
}) {
  const visible = versions
    .slice()
    .sort((a, b) => b.version - a.version || a.kind.localeCompare(b.kind));
  const current =
    visible.find((item) => item.status === "awaiting_review" || item.status === "changes_requested") ??
    visible[0] ??
    null;
  const [selectedId, setSelectedId] = useState(current?.id ?? "");
  const selected = visible.find((item) => item.id === selectedId) ?? current;
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const history = selected ? feedback.filter((item) => item.deliveryVersionId === selected.id) : [];

  async function run(fn: () => Promise<void>) {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action did not complete.");
    }
  }

  if (!visible.length) {
    return (
      <article className="surface-glass review-room">
        <p className="kicker">Review room</p>
        <h2>Private design studio</h2>
        <p className="muted">When Neil publishes a design or build version, it will appear here with its own history.</p>
      </article>
    );
  }

  return (
    <article className="surface-dimensional review-room">
      <p className="kicker">Review room</p>
      <h2>Private design studio</h2>
      <div className="row">
        {visible.map((item) => (
          <button
            className="chip"
            type="button"
            key={item.id}
            aria-pressed={selected?.id === item.id}
            onClick={() => {
              setSelectedId(item.id);
              setConsent(false);
            }}
          >
            {item.kind} v{item.version}
          </button>
        ))}
      </div>
      {selected ? (
        <>
          <p className="tiny">
            {selected.status.replaceAll("_", " ")} · {new Date(selected.publishedAt ?? selected.createdAt).toLocaleString()}
          </p>
          <h3>{selected.title}</h3>
          <p>{selected.summary}</p>
          {selected.notes ? <p className="muted">{selected.notes}</p> : null}
          {selected.previewUrl ? (
            <p>
              <a className="btn btn-ghost" href={selected.previewUrl} target="_blank" rel="noreferrer">
                Open this version
              </a>
            </p>
          ) : (
            <p className="muted">No preview link on this version yet — the written record still stands.</p>
          )}
          <div className="review-history">
            <h3>History for this version</h3>
            {history.length ? (
              history.map((item) => (
                <article className="brief-item" key={item.id}>
                  <p className="tiny">
                    {item.kind.replaceAll("_", " ")} · {item.authorKind} · v{item.expectedVersion} ·{" "}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                  <p>{item.body}</p>
                </article>
              ))
            ) : (
              <p className="muted">No comments on this version yet.</p>
            )}
          </div>
          {selected.status === "awaiting_review" ? (
            <div className="proposal-actions">
              <label>
                <span className="lbl">Feedback on v{selected.version}</span>
                <textarea value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              {error ? <p className="notice notice-warn">{error}</p> : null}
              <div className="row">
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={pending || !note.trim()}
                  onClick={() =>
                    void run(async () => {
                      await onComment(selected, note);
                      setNote("");
                    })
                  }
                >
                  Leave feedback
                </button>
                <button
                  className="btn btn-emerald"
                  type="button"
                  disabled={pending || !note.trim()}
                  onClick={() =>
                    void run(async () => {
                      await onRequestChanges(selected, note);
                      setNote("");
                    })
                  }
                >
                  Request changes
                </button>
              </div>
              <label className="consent-box">
                <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                <span>{DELIVERY_APPROVAL_TEXT}</span>
              </label>
              <button
                className="btn btn-gold"
                type="button"
                disabled={pending || !consent}
                onClick={() => void run(() => onApprove(selected))}
              >
                Approve this version
              </button>
            </div>
          ) : selected.status === "approved" ? (
            <p className="notice">This exact version is approved.</p>
          ) : (
            <p className="notice">Changes were requested on this version. A later version will replace it.</p>
          )}
        </>
      ) : null}
    </article>
  );
}
