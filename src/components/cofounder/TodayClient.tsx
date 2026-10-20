"use client";

import { useEffect, useState } from "react";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { AppLink } from "@/components/ui/AppLink";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import { assetUrl } from "@/lib/cofounder/composition";
import type { StudioAsset, StudioDraft, TodayView } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

export function TodayClient() {
  const { user, generation } = useSession();
  const [today, setToday] = useState<TodayView | null>(null);
  const [businessId, setBusinessId] = useState<string>();
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const gen = generation;
    void (async () => {
      try {
        const workspace = await api<{ business: { id: string } }>("/api/companion/workspace");
        const data = await api<{ today: TodayView }>(
          `/api/companion/today?businessId=${encodeURIComponent(workspace.business.id)}`
        );
        const studio = await api<{ drafts: StudioDraft[]; assets?: StudioAsset[] }>(
          `/api/companion/studio?businessId=${encodeURIComponent(workspace.business.id)}`
        );
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setBusinessId(workspace.business.id);
        setToday(data.today);
        const latest = [...studio.drafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        const ready = (studio.assets ?? []).find((item) => item.id === latest?.selectedAssetId && item.blobId);
        setPreviewUrl(ready ? assetUrl(workspace.business.id, ready.id) : "");
      } catch (err) {
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setError(actionErrorMessage(err, "Today could not be loaded."));
      }
    })();
  }, [generation, user]);

  const continueItem = today
    ? [...today.unfinishedDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    : undefined;

  return (
    <CompanionShell
      title="What is actually waiting"
      lede="Continue the project in front of you. Today is derived from unfinished drafts, owner-created tasks, and pending approvals."
    >
      {error ? <p className="notice notice-warn">{error}</p> : null}
      {!today ? <p className="muted">Gathering saved work…</p> : null}
      {today ? (
        <div className={styles.grid}>
          <article className={styles.glassCard}>
            <p className={styles.label}>Continue</p>
            {continueItem ? (
              <div className={styles.list}>
                {previewUrl ? (
                  <div className={styles.continuePreview}>
                    <img src={previewUrl} alt="" />
                  </div>
                ) : null}
                <h2>{continueItem.title}</h2>
                <p className={styles.meta}>
                  {continueItem.status.replaceAll("_", " ")}
                  {continueItem.updatedAt ? ` · updated ${new Date(continueItem.updatedAt).toLocaleString()}` : ""}
                </p>
                <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
                  {String(continueItem.payload.body ?? continueItem.payload.detail ?? "").slice(0, 220)}
                </p>
                <div className={styles.actions}>
                  <AppLink
                    className="btn btn-emerald-glass"
                    href={`/companion/studio?workItemId=${encodeURIComponent(continueItem.id)}`}
                  >
                    Open in Studio
                  </AppLink>
                  <AppLink className="btn btn-ghost" href={`/companion/work?workItemId=${encodeURIComponent(continueItem.id)}`}>
                    Open in Work
                  </AppLink>
                </div>
              </div>
            ) : (
              <p className="muted">{today.emptyReason ?? "No open drafts. Start in Talk or Studio."}</p>
            )}
          </article>
          <aside className={styles.inspector}>
            <p className={styles.label}>Next actions</p>
            <div className={styles.actions}>
              <AppLink className="btn btn-gold" href="/companion/talk">
                Talk with Aethelios
              </AppLink>
              <AppLink className="btn btn-ghost" href="/companion/studio">
                Open Studio
              </AppLink>
              <AppLink className="btn btn-ghost" href="/companion/business">
                Business home
              </AppLink>
            </div>
            <p className={styles.label}>Waiting</p>
            {today.openTasks.map((item) => (
              <p key={item.id}>{item.title}</p>
            ))}
            {today.pendingApprovals.length ? (
              <p className={styles.meta}>{today.pendingApprovals.length} pending review item(s).</p>
            ) : (
              <p className={styles.meta}>No pending memory or work approvals.</p>
            )}
            {today.pendingAssets.length ? (
              <p className={styles.meta}>{today.pendingAssets.length} Studio generation(s) still pending or failed.</p>
            ) : null}
            {today.emptyReason ? <p className="notice">{today.emptyReason}</p> : null}
            {businessId ? <p className={styles.meta}>Signed-in business context is active.</p> : null}
          </aside>
        </div>
      ) : null}
    </CompanionShell>
  );
}
