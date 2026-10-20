"use client";

import { useEffect, useState } from "react";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { AppLink } from "@/components/ui/AppLink";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import type { TodayView } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

export function TodayClient() {
  const { user, generation } = useSession();
  const [today, setToday] = useState<TodayView | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const gen = generation;
    void (async () => {
      try {
        const data = await api<{ today: TodayView }>("/api/companion/today");
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setToday(data.today);
      } catch (err) {
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setError(actionErrorMessage(err, "Today could not be loaded."));
      }
    })();
  }, [generation, user]);

  return (
    <CompanionShell
      title="What is actually waiting"
      lede="Today is derived from unfinished drafts, owner-created tasks, and pending approvals. Nothing here is invented."
    >
      {error ? <p className="notice notice-warn">{error}</p> : null}
      {!today ? <p className="muted">Gathering saved work…</p> : null}
      {today ? (
        <div className={styles.grid}>
          <article className={`surface-dimensional ${styles.card}`}>
            <p className="tiny">Unfinished drafts</p>
            <div className={styles.list}>
              {today.unfinishedDrafts.length === 0 ? (
                <p className="muted">No open drafts.</p>
              ) : (
                today.unfinishedDrafts.map((item) => (
                  <AppLink key={item.id} href="/companion/work" className="surface-read">
                    <strong>{item.title}</strong>
                    <p className="tiny">{item.status.replaceAll("_", " ")}</p>
                  </AppLink>
                ))
              )}
            </div>
          </article>
          <aside className={`panel ${styles.card}`}>
            <p className="tiny">Tasks and approvals</p>
            {today.openTasks.map((item) => (
              <p key={item.id}>{item.title}</p>
            ))}
            {today.pendingApprovals.length ? (
              <p className="muted">{today.pendingApprovals.length} pending review item(s).</p>
            ) : (
              <p className="muted">No pending memory or work approvals.</p>
            )}
            {today.pendingAssets.length ? (
              <p className="muted">{today.pendingAssets.length} Studio generation(s) still pending or failed.</p>
            ) : null}
            {today.emptyReason ? <p className="notice">{today.emptyReason}</p> : null}
            <div className={styles.actions} style={{ marginTop: 16 }}>
              <AppLink className="btn btn-gold" href="/companion/talk">
                Talk with Aethelios
              </AppLink>
              <AppLink className="btn btn-ghost" href="/workspace">
                Commission portal
              </AppLink>
            </div>
          </aside>
        </div>
      ) : null}
    </CompanionShell>
  );
}
