"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { AppLink } from "@/components/ui/AppLink";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import type { WorkItem } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

export function WorkClient() {
  const { user, generation } = useSession();
  const search = useSearchParams();
  const [items, setItems] = useState<WorkItem[]>([]);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<WorkItem | null>(null);
  const [businessId, setBusinessId] = useState<string>();

  async function load(gen = generation) {
    const workspace = await api<{ business: { id: string } }>("/api/companion/workspace");
    const data = await api<{ items: WorkItem[] }>(
      `/api/companion/work?businessId=${encodeURIComponent(workspace.business.id)}`
    );
    if (!ownerFence.isCurrent(gen, user?.id ?? null)) return;
    setBusinessId(workspace.business.id);
    const visible = data.items.filter((item) => item.status !== "archived");
    setItems(visible);
    const requested = search.get("workItemId");
    if (requested) {
      const match = visible.find((item) => item.id === requested);
      if (match) setEditing(match);
    }
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => setError(actionErrorMessage(err, "Work could not load.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id]);

  async function addTask() {
    await api("/api/companion/tasks", {
      method: "POST",
      body: JSON.stringify({ title, detail, status: "open" })
    });
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
        title: editing.title,
        body: String(editing.payload.body ?? "")
      })
    });
    setEditing(null);
    await load();
  }

  return (
    <CompanionShell
      title="Saved work"
      lede="Drafts, generated assets, and next actions stay in this workspace. Reopen them after refresh or another signed-in session."
    >
      {error ? <p className="notice notice-warn">{error}</p> : null}
      <div className={styles.grid}>
        <article className={`surface-dimensional ${styles.card}`}>
          <div className={styles.list}>
            {items.length === 0 ? <p className="muted">No saved work yet.</p> : null}
            {items.map((item) => (
              <div key={item.id} className="surface-read" style={{ padding: 16 }}>
                <p className="tiny">
                  {item.kind} · {item.status.replaceAll("_", " ")}
                </p>
                <h3>{item.title}</h3>
                <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                  {String(item.payload.body ?? item.payload.detail ?? "")}
                </p>
                <div className={styles.actions}>
                  {item.status === "awaiting_review" && item.payload.proposed ? (
                    <button
                      className="btn btn-gold btn-compact"
                      type="button"
                      onClick={() =>
                        void api("/api/companion/work", {
                          method: "PATCH",
                          body: JSON.stringify({ workItemId: item.id, action: "confirm" })
                        }).then(() => load())
                      }
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
                  {item.status === "exported" && typeof item.payload.export === "object" && item.payload.export && "assetId" in item.payload.export && businessId ? (
                    <a
                      className="btn btn-emerald btn-compact"
                      href={`/api/companion/assets/${String((item.payload.export as { assetId?: string }).assetId)}?businessId=${encodeURIComponent(businessId)}`}
                    >
                      Download finished file
                    </a>
                  ) : null}
                  <button
                    className="btn btn-ghost btn-compact"
                    type="button"
                    onClick={() =>
                      void api("/api/companion/work", {
                        method: "PATCH",
                        body: JSON.stringify({ workItemId: item.id })
                      }).then(() => load())
                    }
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
        <aside className={`panel ${styles.card}`}>
          {editing ? (
            <>
              <p className="tiny">Edit draft</p>
              <input className={styles.field} value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              <textarea
                className={styles.field}
                value={String(editing.payload.body ?? "")}
                onChange={(event) =>
                  setEditing({ ...editing, payload: { ...editing.payload, body: event.target.value } })
                }
              />
              <button className="btn btn-gold" type="button" onClick={() => void saveDraft()}>
                Save exact wording
              </button>
            </>
          ) : (
            <>
              <p className="tiny">Owner task</p>
              <input className={styles.field} placeholder="Follow up on the announcement" value={title} onChange={(event) => setTitle(event.target.value)} />
              <textarea className={styles.field} placeholder="Optional detail" value={detail} onChange={(event) => setDetail(event.target.value)} />
              <button className="btn btn-gold" type="button" disabled={!title.trim()} onClick={() => void addTask()}>
                Add task
              </button>
            </>
          )}
        </aside>
      </div>
    </CompanionShell>
  );
}
