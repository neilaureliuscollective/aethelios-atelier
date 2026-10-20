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
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setToday(null);
    setPreviewUrl("");
    setError("");
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
        const linked = data.today.continuePreviewAssetId
          ? (studio.assets ?? []).find(
              (item) =>
                item.id === data.today.continuePreviewAssetId &&
                item.status === "ready" &&
                Boolean(item.blobId)
            )
          : undefined;
        setPreviewUrl(linked ? assetUrl(workspace.business.id, linked.id) : "");
      } catch (err) {
        if (!ownerFence.isCurrent(gen, user.id)) return;
        setError(actionErrorMessage(err, "Today could not be loaded."));
      }
    })();
  }, [generation, user, retry]);

  const continueItem = today
    ? today.unfinishedDrafts.find((item) => item.id === today.continueItemId) ??
      [...today.unfinishedDrafts].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    : undefined;

  return (
    <CompanionShell
      title="What is actually waiting"
      lede="Continue the project in front of you. Today is derived from unfinished drafts, owner-created tasks, and pending approvals."
    >
      {error ? <div className="notice notice-warn" role="alert"><p>{error}</p><button className="btn btn-ghost" type="button" onClick={() => setRetry((value) => value + 1)}>Retry loading Today</button></div> : null}
      {!today && !error ? <p className="muted">Gathering saved work…</p> : null}
      {today ? (
        <div className={styles.grid}>
          <article className={`${styles.glassCard} on-glass`}>
            <p className={styles.label}>Continue</p>
            {continueItem ? (
              <div className={styles.list}>
                {previewUrl ? (
                  <div className={styles.continuePreview}>
                    <img src={previewUrl} alt="" />
                  </div>
                ) : (
                  <p className="muted">No Studio image is linked to this draft yet.</p>
                )}
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
              <div className={styles.list}>
                <h2>Make your first useful piece</h2>
                <p className="muted">{today.emptyReason ?? "No open drafts yet."}</p>
                <ol>
                  <li>Add your business name, audience, and offering in Business context.</li>
                  <li>Prepare an announcement in Talk, then review its exact wording.</li>
                  <li>Open the saved draft in Studio to edit, save, and export it.</li>
                </ol>
                <div className={styles.actions}>
                  <AppLink className="btn btn-gold" href="/companion/business">Add business facts</AppLink>
                  <AppLink className="btn btn-ghost" href="/companion/talk">Prepare an announcement</AppLink>
                </div>
              </div>
            )}
          </article>
          <aside className={`${styles.inspector} on-glass`}>
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
