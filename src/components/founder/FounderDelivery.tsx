"use client";

import { useEffect, useMemo, useState } from "react";
import { ListEditor } from "@/components/proposal/ListEditor";
import { ProposalDocument } from "@/components/proposal/ProposalDocument";
import { api } from "@/lib/client/api";
import { seedProposalScope } from "@/lib/domain/proposal";
import type {
  DeliveryMilestone,
  DeliveryVersionKind,
  FounderProjectView,
  ProposalScope
} from "@/lib/types";

function cloneScope(scope: ProposalScope): ProposalScope {
  return structuredClone(scope);
}

export function FounderDelivery({
  view,
  pending,
  onRun
}: {
  view: FounderProjectView;
  pending: string | null;
  onRun: (name: string, fn: () => Promise<void>) => Promise<void>;
}) {
  const drafts = view.proposals.filter((item) => item.status === "draft");
  const draft = drafts.at(-1) ?? null;
  const published = view.proposals.filter((item) => item.status !== "draft");
  const initialScope = useMemo(
    () =>
      draft?.scope ??
      seedProposalScope(view.submission?.snapshot ?? view.project.brief),
    [draft, view.project.brief, view.submission]
  );
  const [scope, setScope] = useState<ProposalScope>(cloneScope(initialScope));
  const [changeSummary, setChangeSummary] = useState(draft?.changeSummary ?? "");
  const [deliveryKind, setDeliveryKind] = useState<DeliveryVersionKind>("design");
  const [deliveryTitle, setDeliveryTitle] = useState("");
  const [deliverySummary, setDeliverySummary] = useState("");
  const [deliveryPreview, setDeliveryPreview] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [contentTitle, setContentTitle] = useState("");
  const [contentDetail, setContentDetail] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!draft) return;
    setScope(cloneScope(draft.scope));
    setChangeSummary(draft.changeSummary);
    // Hydrate only when the stored draft itself changes, not on unrelated founder reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- draft.scope is read for that stored revision only
  }, [draft?.id, draft?.updatedAt]);

  function patch<K extends keyof ProposalScope>(key: K, value: ProposalScope[K]) {
    setScope((current) => ({ ...current, [key]: value }));
  }

  function composerLooksPublishable(next: ProposalScope) {
    return Boolean(
      next.summary.trim() &&
        next.price.amount.trim() &&
        next.deliverables.some((item) => item.trim()) &&
        next.exclusions.some((item) => item.trim())
    );
  }

  async function saveDraft(seedFromBrief = false) {
    await onRun("proposal-draft", async () => {
      const result = await api<{ proposal: { scope: ProposalScope; changeSummary: string } }>(
        `/api/founder/projects/${view.project.id}/proposals`,
        {
          method: "POST",
          body: JSON.stringify({
            seedFromBrief,
            changeSummary,
            scope
          })
        }
      );
      setScope(cloneScope(result.proposal.scope));
      setChangeSummary(result.proposal.changeSummary);
    });
  }

  async function publish() {
    await onRun("proposal-publish", async () => {
      if (composerLooksPublishable(scope) || !draft) {
        await api(`/api/founder/projects/${view.project.id}/proposals`, {
          method: "POST",
          body: JSON.stringify({ changeSummary, scope })
        });
      }
      const latest = await api<FounderProjectView & { ok: boolean }>(`/api/founder/projects/${view.project.id}`);
      const toPublish = latest.proposals.find((item) => item.status === "draft");
      if (!toPublish) {
        throw new Error("Save the draft before publishing so the client reviews this exact version.");
      }
      await api(`/api/founder/projects/${view.project.id}/proposals/${toPublish.id}/publish`, { method: "POST" });
    });
  }

  async function saveDelivery(publishAfter: boolean) {
    await onRun("delivery-draft", async () => {
      const saved = await api<{ version: { id: string } }>(`/api/founder/projects/${view.project.id}/delivery-versions`, {
        method: "POST",
        body: JSON.stringify({
          kind: deliveryKind,
          title: deliveryTitle,
          summary: deliverySummary,
          previewUrl: deliveryPreview,
          notes: deliveryNotes
        })
      });
      if (publishAfter) {
        await api(`/api/founder/projects/${view.project.id}/delivery-versions/${saved.version.id}/publish`, {
          method: "POST"
        });
        setDeliveryTitle("");
        setDeliverySummary("");
        setDeliveryPreview("");
        setDeliveryNotes("");
      }
    });
  }

  async function askContent() {
    await onRun("content", async () => {
      await api(`/api/founder/projects/${view.project.id}/content-requests`, {
        method: "POST",
        body: JSON.stringify({ title: contentTitle, detail: contentDetail })
      });
      setContentTitle("");
      setContentDetail("");
    });
  }

  async function setMilestone(item: DeliveryMilestone, status: DeliveryMilestone["status"]) {
    await onRun(`milestone-${item.id}`, async () => {
      await api(`/api/founder/projects/${view.project.id}/milestones/${item.id}`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
    });
  }

  async function copyHandoff() {
    if (!view.handoff?.markdown) return;
    await navigator.clipboard.writeText(view.handoff.markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2400);
  }

  return (
    <div className="founder-delivery">
      <article className="surface-dimensional" style={{ padding: 24 }}>
        <p className="kicker">Needs attention</p>
        <h2>Delivery view</h2>
        <p className="muted">
          Proposals awaiting a response, missing client content, requested revisions, and the next milestone.
        </p>
        {view.nextStep ? <p className="notice">{view.nextStep.label}. {view.nextStep.detail}</p> : null}
        <ul className="attention-list">
          {view.contentRequests
            .filter((item) => item.status === "requested")
            .map((item) => (
              <li key={item.id}>Missing content: {item.title}</li>
            ))}
          {view.proposals
            .filter((item) => item.status === "published" || item.status === "changes_requested")
            .map((item) => (
              <li key={item.id}>
                Proposal v{item.version} {item.status.replaceAll("_", " ")}
              </li>
            ))}
          {view.deliveryVersions
            .filter((item) => item.status === "awaiting_review" || item.status === "changes_requested")
            .map((item) => (
              <li key={item.id}>
                {item.kind} v{item.version} {item.status.replaceAll("_", " ")}
              </li>
            ))}
          {view.milestones
            .filter((item) => item.status === "current" || item.status === "waiting_on_client")
            .map((item) => (
              <li key={item.id}>Next milestone: {item.title}</li>
            ))}
        </ul>
        {!view.contentRequests.some((item) => item.status === "requested") &&
        !view.proposals.some((item) => item.status === "published" || item.status === "changes_requested") &&
        !view.deliveryVersions.some((item) => item.status === "awaiting_review" || item.status === "changes_requested") &&
        !view.milestones.some((item) => item.status === "current" || item.status === "waiting_on_client") ? (
          <p className="muted">Nothing is waiting. Start review, then publish a proposal version when the brief is ready to scope.</p>
        ) : null}
      </article>

      <article className="surface-dense" style={{ padding: 24 }}>
        <p className="kicker">Structured proposal</p>
        <h2>Turn the brief into deliverable scope</h2>
        <p className="muted">
          Review this before publishing. The client sees only the published version. Later edits create v
          {(draft?.version ?? published.at(-1)?.version ?? 0) + (draft ? 0 : 1)} rather than changing an agreed text.
        </p>
        <div className="row">
          <button
            className="btn btn-ghost"
            type="button"
            disabled={pending !== null}
            onClick={() => {
              setScope(cloneScope(seedProposalScope(view.submission?.snapshot ?? view.project.brief)));
              void saveDraft(true);
            }}
          >
            Start from submitted brief
          </button>
        </div>
        <label>
          <span className="lbl">Summary</span>
          <textarea value={scope.summary} onChange={(event) => patch("summary", event.target.value)} />
        </label>
        <ListEditor label="Deliverables" values={scope.deliverables} onChange={(values) => patch("deliverables", values)} />
        <ListEditor label="Included pages" values={scope.includedPages} onChange={(values) => patch("includedPages", values)} />
        <ListEditor
          label="Included features"
          values={scope.includedFeatures}
          onChange={(values) => patch("includedFeatures", values)}
        />
        <ListEditor label="Exclusions" values={scope.exclusions} onChange={(values) => patch("exclusions", values)} />
        <ListEditor
          label="Client responsibilities"
          values={scope.clientResponsibilities}
          onChange={(values) => patch("clientResponsibilities", values)}
        />
        <label>
          <span className="lbl">Brand direction</span>
          <textarea value={scope.brandDirection} onChange={(event) => patch("brandDirection", event.target.value)} />
        </label>
        <fieldset className="list-editor">
          <legend className="lbl">Milestones</legend>
          {scope.milestones.map((item, index) => (
            <div className="milestone-editor" key={`ms-${index}`}>
              <input
                type="text"
                value={item.title}
                placeholder="Title"
                onChange={(event) => {
                  const next = [...scope.milestones];
                  next[index] = { ...item, title: event.target.value };
                  patch("milestones", next);
                }}
              />
              <input
                type="text"
                value={item.timing ?? ""}
                placeholder="Timing"
                onChange={(event) => {
                  const next = [...scope.milestones];
                  next[index] = { ...item, timing: event.target.value };
                  patch("milestones", next);
                }}
              />
              <textarea
                value={item.description}
                placeholder="What this milestone covers"
                onChange={(event) => {
                  const next = [...scope.milestones];
                  next[index] = { ...item, description: event.target.value };
                  patch("milestones", next);
                }}
              />
              <button
                className="btn btn-ghost btn-compact"
                type="button"
                onClick={() => patch("milestones", scope.milestones.filter((_, itemIndex) => itemIndex !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="btn btn-ghost btn-compact"
            type="button"
            onClick={() =>
              patch("milestones", [...scope.milestones, { title: "", description: "", timing: "" }])
            }
          >
            Add milestone
          </button>
        </fieldset>
        <label>
          <span className="lbl">Founder-set price (not collected)</span>
          <input
            type="text"
            value={scope.price.amount}
            onChange={(event) => patch("price", { ...scope.price, amount: event.target.value, paymentStatus: "not_collected" })}
          />
        </label>
        <label>
          <span className="lbl">Price terms</span>
          <textarea
            value={scope.price.terms}
            onChange={(event) => patch("price", { ...scope.price, terms: event.target.value, paymentStatus: "not_collected" })}
          />
        </label>
        <label>
          <span className="lbl">What changed in this version</span>
          <textarea value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} />
        </label>
        <div className="row">
          <button className="btn btn-ghost" type="button" disabled={pending !== null} onClick={() => void saveDraft(false)}>
            {pending === "proposal-draft" ? "Saving…" : "Save draft"}
          </button>
          <button className="btn btn-gold" type="button" disabled={pending !== null} onClick={() => void publish()}>
            {pending === "proposal-publish" ? "Publishing…" : "Publish this version"}
          </button>
        </div>
        {draft ? <p className="tiny">Editing draft v{draft.version}</p> : null}
        {published[0] ? (
          <div style={{ marginTop: 20 }}>
            <p className="tiny">Latest client-visible version</p>
            <ProposalDocument proposal={published.at(-1)!} decisions={view.proposalDecisions} compact />
          </div>
        ) : null}
      </article>

      <article className="surface-glass" style={{ padding: 24 }}>
        <p className="kicker">Review room</p>
        <h2>Publish a design or build version</h2>
        <p className="muted">Explain what changed. The client reviews this exact version in a private studio.</p>
        <div className="row">
          <button
            className="chip"
            type="button"
            aria-pressed={deliveryKind === "design"}
            onClick={() => setDeliveryKind("design")}
          >
            Design
          </button>
          <button
            className="chip"
            type="button"
            aria-pressed={deliveryKind === "build"}
            onClick={() => setDeliveryKind("build")}
          >
            Build
          </button>
        </div>
        <label>
          <span className="lbl">Title</span>
          <input type="text" value={deliveryTitle} onChange={(event) => setDeliveryTitle(event.target.value)} />
        </label>
        <label>
          <span className="lbl">What changed</span>
          <textarea value={deliverySummary} onChange={(event) => setDeliverySummary(event.target.value)} />
        </label>
        <label>
          <span className="lbl">Preview URL (optional)</span>
          <input type="url" value={deliveryPreview} onChange={(event) => setDeliveryPreview(event.target.value)} />
        </label>
        <label>
          <span className="lbl">Notes</span>
          <textarea value={deliveryNotes} onChange={(event) => setDeliveryNotes(event.target.value)} />
        </label>
        <div className="row">
          <button className="btn btn-ghost" type="button" disabled={pending !== null} onClick={() => void saveDelivery(false)}>
            Save draft
          </button>
          <button className="btn btn-gold" type="button" disabled={pending !== null} onClick={() => void saveDelivery(true)}>
            Publish to the client
          </button>
        </div>
        {view.deliveryVersions.map((item) => (
          <p className="tiny" key={item.id}>
            {item.kind} v{item.version} · {item.status.replaceAll("_", " ")} — {item.title}
          </p>
        ))}
      </article>

      <article className="surface-dense" style={{ padding: 24 }}>
        <h2>Ask for client content</h2>
        <label>
          <span className="lbl">Title</span>
          <input type="text" value={contentTitle} onChange={(event) => setContentTitle(event.target.value)} />
        </label>
        <label>
          <span className="lbl">What is missing</span>
          <textarea value={contentDetail} onChange={(event) => setContentDetail(event.target.value)} />
        </label>
        <button className="btn btn-emerald" type="button" disabled={pending !== null} onClick={() => void askContent()}>
          Request materials
        </button>
        {view.contentRequests.map((item) => (
          <article className="brief-item" key={item.id}>
            <p className="tiny">{item.status} · {item.title}</p>
            <p>{item.detail}</p>
            {item.response ? <p className="muted">Client: {item.response}</p> : null}
            {item.status === "requested" ? (
              <button
                className="btn btn-ghost btn-compact"
                type="button"
                onClick={() =>
                  void onRun("waive", async () => {
                    await api(`/api/founder/projects/${view.project.id}/content-requests/${item.id}`, {
                      method: "POST",
                      body: JSON.stringify({ status: "waived" })
                    });
                  })
                }
              >
                Waive
              </button>
            ) : null}
          </article>
        ))}
      </article>

      {view.milestones.length ? (
        <article className="surface-glass" style={{ padding: 24 }}>
          <h2>Milestones</h2>
          {view.milestones.map((item) => (
            <div className="row" key={item.id} style={{ marginBottom: 12 }}>
              <div>
                <strong>{item.title}</strong>
                <p className="tiny">{item.status.replaceAll("_", " ")}</p>
                <p>{item.description}</p>
              </div>
              <button
                className="btn btn-ghost btn-compact"
                type="button"
                onClick={() => void setMilestone(item, item.status === "complete" ? "current" : "complete")}
              >
                {item.status === "complete" ? "Reopen" : "Mark complete"}
              </button>
            </div>
          ))}
        </article>
      ) : null}

      <article className="surface-dimensional" style={{ padding: 24 }}>
        <p className="kicker">Build-ready handoff</p>
        <h2>Cursor / Codex brief</h2>
        <p className="muted">
          Agreed scope, brand direction, and approved revisions in one structured brief. Payments stay out of this
          handoff.
        </p>
        {view.handoff ? (
          <>
            <button className="btn btn-gold" type="button" onClick={() => void copyHandoff()}>
              {copied ? "Copied" : "Copy delivery brief"}
            </button>
            <pre className="handoff-pre">{view.handoff.markdown}</pre>
          </>
        ) : (
          <p className="notice">A handoff appears after the client agrees to a proposal version.</p>
        )}
      </article>
    </div>
  );
}
