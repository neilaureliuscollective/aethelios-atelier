"use client";

import { useCallback, useEffect, useState } from "react";
import { briefTitle } from "@/lib/brief";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { LivingBrief } from "@/components/project/LivingBrief";
import { useSession } from "@/components/shell/SessionShell";
import type { FounderProjectView } from "@/lib/types";

type QueueItem = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  reviewStartedAt: string | null;
  owner: { email: string; displayName: string } | null;
};

export function FounderHome() {
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const data = await api<{ queue: QueueItem[] }>("/api/founder/queue");
        setQueue(data.queue);
      } catch (err) {
        setError(actionErrorMessage(err, "Founder access denied."));
      }
    })();
  }, []);

  if (error) {
    return (
      <section className="container section">
        <h1>Founder workspace</h1>
        <p className="notice notice-warn">{error}</p>
      </section>
    );
  }

  return (
    <section className="container section">
      <p className="kicker">Private founder workspace</p>
      <h1>Review queue</h1>
      <p className="lede">
        Only submitted commissions appear here. Starting review is a deliberate action. Private notes
        never appear on client surfaces.
      </p>
      <div className="stack" style={{ marginTop: 20 }}>
        {queue?.length ? (
          queue.map((item) => (
            <a className="surface-dimensional workspace-card" href={`/founder/${item.id}`} key={item.id}>
              <p className="tiny">{item.status.replaceAll("_", " ")}</p>
              <h2 style={{ fontSize: 28 }}>{item.title}</h2>
              <p className="muted">
                {item.owner?.email} · {item.reviewStartedAt ? "Review started" : "Submitted, not yet reviewing"}
              </p>
            </a>
          ))
        ) : (
          <p className="notice">No submitted commissions in this local store.</p>
        )}
      </div>
    </section>
  );
}

export function FounderDetail({ id }: { id: string }) {
  const [view, setView] = useState<FounderProjectView | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [proposal, setProposal] = useState("");
  const [update, setUpdate] = useState("");
  const [clarification, setClarification] = useState("");
  const [status, setStatus] = useState("");
  const [actionError, setActionError] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<FounderProjectView & { ok: boolean }>(`/api/founder/projects/${id}`);
    setView(data);
  }, [id]);

  useEffect(() => {
    void load().catch((err) => setError(actionErrorMessage(err, "Denied")));
  }, [load]);

  if (error) {
    return (
      <section className="container section">
        <h1>Restricted</h1>
        <p className="notice notice-warn">{error}</p>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="container section">
        <p className="kicker">Founder review</p>
        <h1>Loading this submission…</h1>
      </section>
    );
  }

  async function run(name: string, fn: () => Promise<void>) {
    if (pending) return;
    setPending(name);
    setActionError("");
    try {
      await fn();
      await load();
    } catch (err) {
      setActionError(actionErrorMessage(err, "That action did not complete. Your text is still here."));
    } finally {
      setPending(null);
    }
  }

  async function startReview() {
    await run("review", async () => {
      await api(`/api/founder/projects/${id}/review`, { method: "POST" });
      setStatus("Review started. The owner may now see founder-review progress.");
    });
  }

  async function saveNote(kind: "private_note" | "internal_proposal", body: string) {
    if (!body.trim()) return;
    await run(kind, async () => {
      await api(`/api/founder/projects/${id}/notes`, {
        method: "POST",
        body: JSON.stringify({ kind, body })
      });
      if (kind === "private_note") setNote("");
      else setProposal("");
      setStatus("Private note stored. It is not client-visible.");
    });
  }

  async function publish(kind: "progress_note" | "clarification" | "decision", body: string) {
    if (!body.trim()) return;
    await run(kind, async () => {
      await api(`/api/founder/projects/${id}/updates`, {
        method: "POST",
        body: JSON.stringify({ kind, body })
      });
      if (kind === "clarification") setClarification("");
      else setUpdate("");
      setStatus(`Published a labeled client-visible ${kind.replaceAll("_", " ")}.`);
    });
  }

  return (
    <section className="container section">
      <p className="kicker">Founder review</p>
      <h1>{briefTitle(view.project.brief)}</h1>
      <p className="muted">
        Owner {view.owner.email} · persistence labeled local · private notes stay on this page
      </p>
      <div className="row" style={{ marginTop: 16 }}>
        {!view.reviewStartedAt ? (
          <button className="btn btn-gold" type="button" disabled={pending !== null} onClick={() => void startReview()}>
            {pending === "review" ? "Starting…" : "Start founder review"}
          </button>
        ) : (
          <span className="badge badge-founder">Review started {new Date(view.reviewStartedAt).toLocaleString()}</span>
        )}
      </div>
      {status ? <p className="notice">{status}</p> : null}
      {actionError ? <p className="notice notice-warn">{actionError}</p> : null}

      <div className="founder-review-grid" style={{ marginTop: 24 }}>
        <article className="surface-dense" style={{ padding: 20 }}>
          <h2>Submitted snapshot</h2>
          <p className="tiny">Immutable client brief</p>
          {view.submission ? (
            <LivingBrief brief={view.submission.snapshot} suggestions={[]} />
          ) : (
            <p>No snapshot.</p>
          )}
        </article>
        <article className="surface-dimensional" style={{ padding: 20 }}>
          <h2>Private notes</h2>
          <p className="notice notice-warn">Founder only. These controls never publish to the client.</p>
          {view.privateNotes.map((item) => (
            <p key={item.id}>
              <span className="tiny">{item.kind.replaceAll("_", " ")}</span>
              <br />
              {item.body}
            </p>
          ))}
          <label>
            <span className="lbl">Private note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={pending !== null}
            onClick={() => void saveNote("private_note", note)}
          >
            {pending === "private_note" ? "Saving…" : "Save private note"}
          </button>
          <label>
            <span className="lbl">Internal proposal draft</span>
            <textarea value={proposal} onChange={(event) => setProposal(event.target.value)} />
          </label>
          <button
            className="btn btn-ghost"
            type="button"
            disabled={pending !== null}
            onClick={() => void saveNote("internal_proposal", proposal)}
          >
            {pending === "internal_proposal" ? "Saving…" : "Save internal proposal"}
          </button>
        </article>
        <article className="surface-glass" style={{ padding: 20 }}>
          <h2>Client-visible updates</h2>
          <p className="muted">Publishing sends a labeled note the owner can read. This is not a private note.</p>
          <label>
            <span className="lbl">Progress note</span>
            <textarea value={update} onChange={(event) => setUpdate(event.target.value)} />
          </label>
          <button
            className="btn btn-gold"
            type="button"
            disabled={pending !== null}
            onClick={() => void publish("progress_note", update)}
          >
            {pending === "progress_note" ? "Publishing…" : "Publish labeled update"}
          </button>
          <label>
            <span className="lbl">Clarification request</span>
            <textarea value={clarification} onChange={(event) => setClarification(event.target.value)} />
          </label>
          <button
            className="btn btn-emerald"
            type="button"
            disabled={pending !== null}
            onClick={() => void publish("clarification", clarification)}
          >
            {pending === "clarification" ? "Publishing…" : "Request clarification"}
          </button>
        </article>
      </div>
    </section>
  );
}

export function FounderGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useSession();
  if (loading) return <section className="container section">Loading…</section>;
  if (!user || user.role !== "founder") {
    return (
      <section className="container section">
        <h1>Founder authorization required</h1>
        <p className="lede">This workspace is enforced on the server. Sign in with an authorized founder account to continue.</p>
        <a className="btn btn-gold" href="/account">
          Sign in
        </a>
      </section>
    );
  }
  return <>{children}</>;
}
