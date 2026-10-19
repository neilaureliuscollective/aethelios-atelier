"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { briefTitle } from "@/lib/brief";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { LivingBrief } from "@/components/project/LivingBrief";
import { useSession } from "@/components/shell/SessionShell";
import type { ClientProjectView, Project } from "@/lib/types";

export function WorkspaceHome() {
  const { user, loading, generation } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    const gen = generation;
    void (async () => {
      try {
        const list = await api<{ projects: Project[] }>("/api/projects");
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setProjects(list.projects);
      } catch (err) {
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setError(actionErrorMessage(err, "Workspace could not be loaded."));
      }
    })();
  }, [generation, user]);

  if (loading) {
    return (
      <section className="container section">
        <p className="kicker">Workspace</p>
        <h1>Loading your commissions…</h1>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="container section">
        <h1>Client workspace</h1>
        <p className="lede">Sign in to resume saved commissions. Guest drafts stay on the brief page until you adopt them.</p>
        <a className="btn btn-gold" href="/account?next=/workspace">
          Sign in
        </a>
      </section>
    );
  }

  return (
    <section className="container section">
      <p className="kicker">Your commissions</p>
      <h1>Workspace</h1>
      <p className="muted">Signed in as {user.email}. This list is owned by this account only.</p>
      {error ? <p className="notice notice-warn">{error}</p> : null}
      <div className="stack" style={{ marginTop: 20 }}>
        {projects.length === 0 ? (
          <p className="notice">No saved commissions yet. Start a brief or adopt a guest draft.</p>
        ) : (
          projects.map((project) => (
            <AppLink className="surface-dimensional workspace-card" href={`/workspace/${project.id}`} key={project.id}>
              <p className="tiny">{project.status.replaceAll("_", " ")}</p>
              <h2 style={{ fontSize: 28 }}>{briefTitle(project.brief)}</h2>
              <p className="muted">Updated {new Date(project.updatedAt).toLocaleString()}</p>
            </AppLink>
          ))
        )}
        <div className="row">
          <AppLink className="btn btn-gold" href="/project/new">
            New project
          </AppLink>
          <AppLink className="btn btn-ghost" href="/account/adopt">
            Review guest draft
          </AppLink>
        </div>
      </div>
    </section>
  );
}

export function WorkspaceDetail({ id }: { id: string }) {
  const { user, generation } = useSession();
  const [view, setView] = useState<ClientProjectView | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [mode, setMode] = useState<"status" | "snapshot" | "draft">("status");

  const load = useCallback(async () => {
    const gen = generation;
    try {
      const data = await api<ClientProjectView & { ok: boolean }>(`/api/projects/${id}`);
      if (!ownerFence.isCurrent(gen, user?.id ?? null)) return;
      setView(data);
      setError("");
    } catch (err) {
      if (!ownerFence.isCurrent(gen, user?.id ?? null)) return;
      setView(null);
      setError(actionErrorMessage(err, "Unable to load this commission."));
    }
  }, [generation, id, user?.id]);

  useEffect(() => {
    setView(null);
    void load();
  }, [load]);

  if (error) {
    return (
      <section className="container section">
        <h1>Commission unavailable</h1>
        <p className="notice notice-warn">{error}</p>
        <AppLink className="btn btn-gold" href="/workspace">
          Back to workspace
        </AppLink>
      </section>
    );
  }
  if (!view) {
    return (
      <section className="container section">
        <p className="kicker">Your commission</p>
        <h1>Loading this project…</h1>
      </section>
    );
  }

  const openClarification = view.updates.find(
    (update) =>
      update.kind === "clarification" &&
      update.requiresResponse &&
      !view.clarificationResponses.some((item) => item.updateId === update.id)
  );

  async function respond() {
    if (!openClarification || !reply.trim() || replyPending) return;
    setReplyPending(true);
    setReplyError("");
    try {
      await api(`/api/projects/${id}/clarifications/${openClarification.id}`, {
        method: "POST",
        body: JSON.stringify({ body: reply })
      });
      setReply("");
      await load();
    } catch (err) {
      setReplyError(actionErrorMessage(err, "The reply was not stored. Your text is still here."));
    } finally {
      setReplyPending(false);
    }
  }

  const submitted = Boolean(view.submission);
  const reviewing = Boolean(view.reviewStartedAt);

  return (
    <section className="container section workspace-detail">
      <p className="kicker">Your commission</p>
      <h1>{briefTitle(view.project.brief)}</h1>
      <p className="tiny">Project {view.project.id}</p>
      <p className="lede">{view.nextStep.detail}</p>
      <div className="row">
        <button className="chip" type="button" aria-pressed={mode === "status"} onClick={() => setMode("status")}>
          Status
        </button>
        <button className="chip" type="button" aria-pressed={mode === "snapshot"} onClick={() => setMode("snapshot")}>
          Submitted snapshot
        </button>
        <button className="chip" type="button" aria-pressed={mode === "draft"} onClick={() => setMode("draft")}>
          Working draft
        </button>
      </div>
      <article className="surface-dimensional workspace-status">
        <h2>{view.nextStep.label}</h2>
        <div className="timeline" aria-label="Commission progress">
          <div className="timeline-step">
            <span className="dot done" />
            Brief saved
          </div>
          <div className="timeline-step">
            <span className={`dot ${submitted ? "done" : ""}`} />
            {submitted ? "Sent for Neil’s review" : "Not sent"}
          </div>
          <div className="timeline-step">
            <span className={`dot ${reviewing ? "current" : ""}`} />
            {reviewing ? "Founder review" : "Not yet under review"}
          </div>
        </div>
        {view.submission ? (
          <article className="receipt-card">
            <p className="tiny">Confirmed receipt</p>
            <p>
              Receipt {view.submission.receiptId} · {new Date(view.submission.createdAt).toLocaleString()}
            </p>
            <p className="muted">
              Reviewed revision {view.submission.reviewedVersion}. This is a stored request for review, not
              acceptance or a delivery date.
            </p>
          </article>
        ) : (
          <p className="muted">No snapshot has been sent. Submission is a request for review, not acceptance or a delivery date.</p>
        )}
        <p className="notice">Edits to the working draft do not change a submitted snapshot.</p>
        <div className="row" style={{ marginTop: 16 }}>
          {view.submission ? (
            <button className="btn btn-ghost" type="button" onClick={() => setMode("snapshot")}>
              View confirmed receipt
            </button>
          ) : null}
          <AppLink className="btn btn-ghost" href={`/project/${view.project.id}`}>
            Edit the current working draft
          </AppLink>
          {view.submission ? (
            <AppLink className="btn btn-gold" href={`/project/${view.project.id}`}>
              Review a new revision
            </AppLink>
          ) : (
            <AppLink className="btn btn-gold" href={`/project/${view.project.id}`}>
              Review and send
            </AppLink>
          )}
        </div>
      </article>

      {openClarification ? (
        <article className="surface-dense" style={{ padding: 24, marginTop: 16 }}>
          <p className="tiny">Clarification requested</p>
          <h2>Neil asked a question</h2>
          <p>{openClarification.body}</p>
          <label>
            <span className="lbl">Your response</span>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          {replyError ? <p className="notice notice-warn">{replyError}</p> : null}
          <button className="btn btn-gold" type="button" disabled={replyPending} onClick={() => void respond()}>
            {replyPending ? "Sending…" : "Respond"}
          </button>
        </article>
      ) : null}

      <div className="surface-glass" style={{ padding: 24, marginTop: 16 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2>Project updates</h2>
          <span className="tiny">Client-visible only</span>
        </div>
        {view.updates.length === 0 ? (
          <p className="muted">No founder updates yet. Return here to read them — this local candidate does not send notifications.</p>
        ) : (
          view.updates.map((update) => (
            <article key={update.id} className="brief-item">
              <p className="tiny">{update.kind.replaceAll("_", " ")} · {new Date(update.createdAt).toLocaleString()}</p>
              <p>{update.body}</p>
            </article>
          ))
        )}
      </div>

      {mode === "snapshot" && view.submission ? (
        <div style={{ marginTop: 16 }}>
          <LivingBrief brief={view.submission.snapshot} suggestions={[]} />
        </div>
      ) : null}
      {mode === "snapshot" && !view.submission ? (
        <p className="notice" style={{ marginTop: 16 }}>
          There is no submitted snapshot yet.
        </p>
      ) : null}
      {mode === "draft" ? (
        <div style={{ marginTop: 16 }}>
          <LivingBrief brief={view.project.brief} suggestions={view.suggestions} />
          <AppLink className="btn btn-ghost" href={`/project/${view.project.id}`}>
            Edit this commission
          </AppLink>
        </div>
      ) : null}

      <nav className="bottom-nav" aria-label="Workspace">
        <AppLink href="/workspace" aria-current="page">
          Projects
        </AppLink>
        <AppLink href={`/project/${view.project.id}`}>Brief</AppLink>
        <AppLink href="/account">Account</AppLink>
      </nav>
    </section>
  );
}
