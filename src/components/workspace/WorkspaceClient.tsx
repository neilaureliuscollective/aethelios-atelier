"use client";

import { useCallback, useEffect, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { briefTitle } from "@/lib/brief";
import { api } from "@/lib/client/api";
import { LivingBrief } from "@/components/project/LivingBrief";
import type { ClientProjectView, Project, User } from "@/lib/types";

export function WorkspaceHome() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    void (async () => {
      const session = await api<{ user: User | null }>("/api/session");
      setUser(session.user);
      if (!session.user) return;
      const list = await api<{ projects: Project[] }>("/api/projects");
      setProjects(list.projects);
    })();
  }, []);

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
      <div className="stack" style={{ marginTop: 20 }}>
        {projects.length === 0 ? (
          <p className="notice">No saved commissions yet. Start a brief or adopt a guest draft.</p>
        ) : (
          projects.map((project) => (
            <a className="panel" style={{ padding: 20, display: "block" }} href={`/workspace/${project.id}`} key={project.id}>
              <p className="tiny">{project.status.replaceAll("_", " ")}</p>
              <h2 style={{ fontSize: 28 }}>{briefTitle(project.brief)}</h2>
              <p className="muted">Updated {new Date(project.updatedAt).toLocaleString()}</p>
            </a>
          ))
        )}
        <div className="row">
          <a className="btn btn-gold" href="/project">
            Continue brief
          </a>
          <a className="btn btn-ghost" href="/account/adopt">
            Review guest draft
          </a>
        </div>
      </div>
    </section>
  );
}

export function WorkspaceDetail({ id }: { id: string }) {
  const [view, setView] = useState<ClientProjectView | null>(null);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [mode, setMode] = useState<"status" | "snapshot" | "draft">("status");

  const load = useCallback(async () => {
    try {
      const data = await api<ClientProjectView & { ok: boolean }>(`/api/projects/${id}`);
      setView(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load this commission.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <section className="container section">
        <h1>Commission unavailable</h1>
        <p className="notice notice-warn">{error}</p>
      </section>
    );
  }
  if (!view) return <section className="container section">Loading…</section>;

  const openClarification = view.updates.find(
    (update) =>
      update.kind === "clarification" &&
      update.requiresResponse &&
      !view.clarificationResponses.some((item) => item.updateId === update.id)
  );

  async function respond() {
    if (!openClarification || !reply.trim()) return;
    await api(`/api/projects/${id}/clarifications/${openClarification.id}`, {
      method: "POST",
      body: JSON.stringify({ body: reply })
    });
    setReply("");
    await load();
  }

  const submitted = Boolean(view.submission);
  const reviewing = Boolean(view.reviewStartedAt);

  return (
    <section className="container section">
      <p className="kicker">Your commission</p>
      <h1>{briefTitle(view.project.brief)}</h1>
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
      <article className="panel" style={{ padding: 24, marginTop: 16 }}>
        <h2>{view.nextStep.label}</h2>
        <div className="timeline" aria-label="Commission progress">
          <div className="timeline-step">
            <span className="dot done" />
            Brief saved
          </div>
          <div className="timeline-step">
            <span className={`dot ${submitted ? "done" : ""}`} />
            Submitted
          </div>
          <div className="timeline-step">
            <span className={`dot ${reviewing ? "current" : ""}`} />
            {reviewing ? "Founder review" : "Not yet under review"}
          </div>
        </div>
        {view.submission ? (
          <p className="muted">
            Receipt {view.submission.receiptId} · {new Date(view.submission.createdAt).toLocaleString()}
          </p>
        ) : (
          <p className="muted">No snapshot has been sent.</p>
        )}
        <p className="notice">Edits to the working draft do not change a submitted snapshot.</p>
      </article>

      {openClarification ? (
        <article className="panel" style={{ padding: 24, marginTop: 16 }}>
          <p className="tiny">Clarification requested</p>
          <h2>Neil asked a question</h2>
          <p>{openClarification.body}</p>
          <label>
            <span className="lbl">Your response</span>
            <textarea value={reply} onChange={(event) => setReply(event.target.value)} />
          </label>
          <button className="btn btn-gold" type="button" onClick={() => void respond()}>
            Respond
          </button>
        </article>
      ) : null}

      <div className="panel" style={{ padding: 24, marginTop: 16 }}>
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
      {mode === "draft" ? (
        <div style={{ marginTop: 16 }}>
          <LivingBrief brief={view.project.brief} suggestions={view.suggestions} />
          <a className="btn btn-ghost" href="/project">
            Edit working draft
          </a>
        </div>
      ) : null}

      <nav className="bottom-nav" aria-label="Workspace">
        <AppLink href="/workspace" aria-current="page">
          Projects
        </AppLink>
        <AppLink href="/project">Brief</AppLink>
        <AppLink href="/account">Account</AppLink>
      </nav>
    </section>
  );
}
