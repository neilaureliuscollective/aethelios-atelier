"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { AppLink } from "@/components/ui/AppLink";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import { assetUrl, STUDIO_LAYOUTS } from "@/lib/cofounder/composition";
import type { StudioAsset, StudioLayoutId, WorkItem } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

const PAGE_SIZE = 12;

function exportMeta(item: WorkItem) {
  const exported = item.payload.export;
  if (!exported || typeof exported !== "object") return {};
  const record = exported as { assetId?: string; format?: string; layout?: string };
  return {
    assetId: typeof record.assetId === "string" ? record.assetId : undefined,
    format: typeof record.format === "string" ? record.format : typeof record.layout === "string" ? record.layout : undefined
  };
}

function formatLabel(id?: string) {
  if (!id) return "Copy";
  const spec = STUDIO_LAYOUTS[id as StudioLayoutId];
  return spec?.label ?? id.replaceAll("_", " ");
}

export function WorkClient() {
  const { user, generation } = useSession();
  const search = useSearchParams();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [assets, setAssets] = useState<StudioAsset[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [businessId, setBusinessId] = useState<string>();
  const [projectName, setProjectName] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [status, setStatus] = useState("");
  const inFlight = useRef(false);
  const actionSequence = useRef(0);
  const retryAction = useRef<(() => Promise<void>) | null>(null);

  async function perform(label: string, action: () => Promise<void>, success: string, retrySafe = true) {
    if (inFlight.current) return;
    inFlight.current = true;
    const sequence = ++actionSequence.current;
    setPending(label);
    setError("");
    setStatus("");
    retryAction.current = retrySafe ? () => perform(label, action, success, retrySafe) : null;
    const gen = generation;
    const owner = user?.id ?? null;
    try {
      await action();
      if (ownerFence.isCurrent(gen, owner)) {
        if (success) setStatus(success);
        retryAction.current = null;
      }
    } catch (err) {
      if (ownerFence.isCurrent(gen, owner)) setError(actionErrorMessage(err, "The action did not confirm. Review saved work before retrying."));
    } finally {
      if (actionSequence.current === sequence) {
        inFlight.current = false;
        if (ownerFence.isCurrent(gen, owner)) setPending("");
      }
    }
  }

  async function reload() {
    setLoading(true);
    try { await load(); } finally { if (ownerFence.isCurrent(generation, user?.id ?? null)) setLoading(false); }
  }

  async function updateItem(id: string, action?: "confirm") {
    if (action === "confirm") {
      const current = await api<{ items: WorkItem[] }>(`/api/companion/work?businessId=${encodeURIComponent(businessId ?? "")}`);
      const item = current.items.find((entry) => entry.id === id);
      if (!item) throw new Error("The requested item is unavailable. Refresh saved work.");
      if (item.status !== "awaiting_review") { await load(); return; }
    }
    await api("/api/companion/work", {
      method: "PATCH", body: JSON.stringify({ workItemId: id, action, businessId })
    });
    await load();
  }

  async function load(gen = generation) {
    const workspace = await api<{ business: { id: string; name: string } }>("/api/companion/workspace");
    const data = await api<{ items: WorkItem[] }>(
      `/api/companion/work?businessId=${encodeURIComponent(workspace.business.id)}`
    );
    const studio = await api<{ assets?: StudioAsset[] }>(
      `/api/companion/studio?businessId=${encodeURIComponent(workspace.business.id)}`
    );
    if (!ownerFence.isCurrent(gen, user?.id ?? null)) return;
    setBusinessId(workspace.business.id);
    setProjectName(workspace.business.name);
    const visible = data.items.filter((item) => item.status !== "archived");
    setItems(visible);
    setAssets(studio.assets ?? []);
    const requested = search.get("workItemId");
    if (requested) {
      const match = visible.find((item) => item.id === requested);
      if (match) setEditing(match);
      else setStatus("The requested item is unavailable in this business or was archived. Other saved work is shown below.");
    }
  }

  useEffect(() => {
    actionSequence.current += 1;
    inFlight.current = false;
    retryAction.current = null;
    setTitle("");
    setDetail("");
    setBusinessId(undefined);
    setProjectName("");
    setItems([]);
    setAssets([]);
    setEditing(null);
    setStatus("");
    setError("");
    setPending("");
    if (!user) return;
    void perform("Loading saved work…", reload, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id]);

  async function addTask() {
    await api("/api/companion/tasks", {
      method: "POST",
      body: JSON.stringify({ title, detail, status: "open", businessId })
    });
    if (!ownerFence.isCurrent(generation, user?.id ?? null)) return;
    setTitle("");
    setDetail("");
    await load();
  }

  async function saveDraft() {
    if (!editing) return;
    await api("/api/companion/work", {
      method: "POST",
      body: JSON.stringify({
        workItemId: editing.id,
        businessId,
        title: editing.title,
        body: String(editing.payload.body ?? "")
      })
    });
    if (!ownerFence.isCurrent(generation, user?.id ?? null)) return;
    setEditing(null);
    await load();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      const kindOk =
        kindFilter === "all" ||
        (kindFilter === "exported" ? item.status === "exported" : item.kind === kindFilter);
      const textOk = !q || item.title.toLowerCase().includes(q) || item.id.toLowerCase().includes(q);
      return kindOk && textOk;
    });
  }, [items, kindFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const groups = useMemo(() => {
    const map = new Map<string, WorkItem[]>();
    for (const item of visible) {
      const key = item.title.trim().toLowerCase() || item.id;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [visible]);

  function thumbFor(item: WorkItem) {
    const fromExport = exportMeta(item).assetId;
    if (fromExport && businessId) return assetUrl(businessId, fromExport);
    const linked = assets.find((asset) => asset.workItemId === item.id && asset.status === "ready" && asset.blobId);
    return linked && businessId ? assetUrl(businessId, linked.id) : "";
  }

  return (
    <CompanionShell
      title="Saved work"
      lede="Drafts, generated assets, and next actions stay in this workspace. Every record remains visible."
    >
      {pending ? <p role="status" className="notice">{pending}</p> : null}
      {status ? <p role="status" className="notice">{status}</p> : null}
      {error ? <div role="alert" className="notice notice-warn"><p>{error}</p>{retryAction.current ? <button className="btn btn-ghost" type="button" disabled={Boolean(pending)} onClick={() => void retryAction.current?.()}>Retry action</button> : <p>Refresh saved work before adding this task again; the previous save may have completed.</p>}<button className="btn btn-ghost" type="button" disabled={Boolean(pending)} onClick={() => void perform("Refreshing saved work…", reload, "Saved work refreshed.")}>Refresh saved work</button></div> : null}
      <div className={styles.grid}>
        <article className={`${styles.glassCard} on-glass`}>
          <div className={styles.libraryToolbar}>
            <label className={styles.label}>
              Filter
              <select className={styles.select} value={kindFilter} onChange={(event) => { setKindFilter(event.target.value); setPage(0); }}>
                <option value="all">All {items.length} records</option>
                <option value="draft">Drafts</option>
                <option value="estimate">Estimates</option>
                <option value="task">Tasks</option>
                <option value="exported">Exported</option>
              </select>
            </label>
            <label className={styles.label}>
              Find
              <input className={styles.field} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Title or id" />
            </label>
          </div>
          <div className={styles.library}>
            {!loading && !error && filtered.length === 0 ? <div className="muted">{items.length === 0 ? <><p>No saved work yet. Prepare a draft in Talk or compose one in Studio.</p><AppLink className="btn btn-ghost" href="/companion/talk">Start a draft</AppLink></> : <><p>No work matches these filters. Your {items.length} saved records are still here.</p><button className="btn btn-ghost" type="button" onClick={() => { setQuery(""); setKindFilter("all"); setPage(0); }}>Clear filters</button></>}</div> : null}
            {groups.map(([key, group]) => (
              <section key={key} className={styles.group}>
                {group.length > 1 ? <p className={styles.meta}>{group.length} separate records titled “{group[0]?.title}” — each record is kept</p> : null}
                <div className={styles.cards}>
                  {group.map((item) => {
                    const meta = exportMeta(item);
                    const thumb = thumbFor(item);
                    return (
                      <article key={item.id} className={`${styles.workCard} surface-read`}>
                        {thumb ? <img className={styles.thumb} src={thumb} alt="" /> : null}
                        <p className={styles.meta}>
                          {item.kind} · {item.status.replaceAll("_", " ")} · {formatLabel(meta.format)}
                        </p>
                        <h3>{item.title}</h3>
                        <p className={styles.meta}>
                          {projectName || "Project"} · updated {new Date(item.updatedAt).toLocaleString()}
                        </p>
                        <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                          {String(item.payload.body ?? item.payload.detail ?? "").slice(0, 160)}
                        </p>
                        <div className={styles.actions}>
                          {item.status === "awaiting_review" && item.payload.proposed ? (
                            <button
                              className="btn btn-gold btn-compact"
                              type="button"
                              disabled={Boolean(pending)}
                              onClick={() => void perform("Confirming proposed action…", () => updateItem(item.id, "confirm"), "Proposed action confirmed.")}
                            >
                              Confirm proposed action
                            </button>
                          ) : null}
                          {item.kind === "draft" || item.kind === "estimate" ? (
                            <>
                              <button className="btn btn-ghost btn-compact" type="button" onClick={() => setEditing(item)}>
                                Edit
                              </button>
                              <AppLink className="btn btn-ghost btn-compact" href={`/companion/studio?workItemId=${encodeURIComponent(item.id)}`}>
                                Open this copy in Studio
                              </AppLink>
                            </>
                          ) : null}
                          {item.status === "exported" && meta.assetId && businessId ? (
                            <a
                              className="btn btn-emerald btn-compact"
                              href={`/api/companion/assets/${meta.assetId}?businessId=${encodeURIComponent(businessId)}`}
                            >
                              Download finished file
                            </a>
                          ) : null}
                          <button
                            className="btn btn-ghost btn-compact"
                            type="button"
                            disabled={Boolean(pending)}
                            onClick={() => void perform("Archiving…", () => updateItem(item.id), "Item archived.")}
                          >
                            Archive
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          {filtered.length > PAGE_SIZE ? (
            <div className={styles.pager}>
              <button className="btn btn-ghost btn-compact" type="button" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Previous
              </button>
              <p className={styles.meta}>
                {safePage + 1} / {pageCount} · {filtered.length} records
              </p>
              <button className="btn btn-ghost btn-compact" type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                Next
              </button>
            </div>
          ) : (
            <p className={styles.meta}>{filtered.length} records shown</p>
          )}
        </article>
        <aside className={`${styles.inspector} on-glass`}>
          {editing ? (
            <>
              <p className={styles.label}>Edit draft</p>
              <input className={styles.field} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              <textarea
                className={styles.field}
                value={String(editing.payload.body ?? "")}
                onChange={(event) =>
                  setEditing({ ...editing, payload: { ...editing.payload, body: event.target.value } })
                }
              />
              <button className="btn btn-gold" type="button" disabled={Boolean(pending)} onClick={() => void perform("Saving wording…", saveDraft, "Exact wording saved.")}>
                Save exact wording
              </button>
            </>
          ) : (
            <>
              <p className={styles.label}>Owner task</p>
              <input className={styles.field} placeholder="Follow up on the announcement" value={title} onChange={(event) => setTitle(event.target.value)} />
              <textarea className={styles.field} placeholder="Optional detail" value={detail} onChange={(event) => setDetail(event.target.value)} />
              <button className="btn btn-gold" type="button" disabled={!title.trim() || Boolean(pending)} onClick={() => void perform("Adding task…", addTask, "Task saved.", false)}>
                Add task
              </button>
            </>
          )}
        </aside>
      </div>
    </CompanionShell>
  );
}
