"use client";

import { useEffect, useState } from "react";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { useSession } from "@/components/shell/SessionShell";
import { AppLink } from "@/components/ui/AppLink";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { DIRECTIONS, parseSelection, readDiscoveryHandoff, type DiscoverySelection } from "@/lib/discovery";
import { clearGuestIntent, readGuestIntent } from "@/lib/guest/intent";
import type { Business, BusinessConfirmation } from "@/lib/cofounder/types";
import styles from "./companion.module.css";

function selectionFromDevice(): DiscoverySelection | null {
  const handoff = readDiscoveryHandoff();
  if (handoff) return handoff;
  try {
    const raw = window.localStorage.getItem("aethelios.atelier.discovery.v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { confirmed?: unknown };
    return parseSelection(parsed.confirmed);
  } catch {
    return null;
  }
}

export function ConfirmClient() {
  const { user } = useSession();
  const [business, setBusiness] = useState<Business | null>(null);
  const [confirmation, setConfirmation] = useState<BusinessConfirmation | null>(null);
  const [selection, setSelection] = useState<DiscoverySelection | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [conflict, setConflict] = useState<BusinessConfirmation | null>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const next = selectionFromDevice();
    setSelection(next);
    const intent = readGuestIntent();
    if (next && user) {
      void api("/api/companion/guest-claim", {
        method: "POST",
        body: JSON.stringify({
          guestWorkId: next.selectionId,
          kind: "discovery",
          destination: intent?.destination ?? "/companion/confirm",
          payload: {
            selectionId: next.selectionId,
            localRevision: next.localRevision,
            selectedDirectionId: next.selectedDirectionId
          }
        })
      }).catch((err) => setError(actionErrorMessage(err, "This Discovery direction could not be claimed.")));
    }
    if (!user) return;
    void api<{ business: Business; confirmation: BusinessConfirmation | null; rawProfile: { fields: { name: { value: string }; audience: { value: string } } } }>(
      "/api/companion/workspace"
    )
      .then((data) => {
        setBusiness(data.business);
        setConfirmation(data.confirmation);
        const existingName = data.confirmation?.businessName || data.rawProfile.fields.name.value || data.business.name;
        setBusinessName(existingName === "Your business" && next?.businessName ? next.businessName : existingName);
        setBusinessContext(
          data.confirmation?.businessContext ||
            data.rawProfile.fields.audience.value ||
            [next?.audience, next?.intentNote].filter(Boolean).join(" ").trim()
        );
      })
      .catch((err) => setError(actionErrorMessage(err, "The workspace could not open.")));
  }, [user]);

  async function submit(replace = false) {
    if (pending || !business) return;
    setPending(true);
    setError("");
    setStatus("");
    try {
      const result = await api<{ ok: true; confirmation: BusinessConfirmation }>("/api/companion/confirm", {
        method: "POST",
        body: JSON.stringify({
          businessId: business.id,
          businessName,
          businessContext,
          sourceSelectionId: selection?.selectionId ?? null,
          sourceRevision: selection?.localRevision ?? null,
          directionId: selection?.selectedDirectionId ?? null,
          replaceConfirmedDirection: replace
        })
      });
      setConfirmation(result.confirmation);
      setConflict(null);
      setSaved(true);
      setStatus("Business and direction confirmed. You can open Studio with this exact selection.");
      clearGuestIntent();
    } catch (err) {
      const conflictCurrent = err instanceof ApiError ? (err.currentBrief as BusinessConfirmation | undefined) : null;
      if (conflictCurrent) {
        setConflict(conflictCurrent);
        setError(actionErrorMessage(err, "A different Discovery direction is already confirmed."));
      } else {
        setError(actionErrorMessage(err, "Confirmation did not save."));
      }
    } finally {
      setPending(false);
    }
  }

  const direction = selection ? DIRECTIONS[selection.selectedDirectionId] : null;

  return (
    <CompanionShell
      title="Confirm this business"
      lede="Review the business and the Discovery direction before Studio uses them. Existing businesses keep their name unless you change it here."
    >
      {error ? <p className="notice notice-warn">{error}</p> : null}
      {status ? <p className="notice">{status}</p> : null}
      <div className={styles.grid}>
        <article className={`${styles.glassCard} on-glass`}>
          <p className={styles.label}>Business</p>
          <label className={styles.composer}>
            <span className={styles.label}>Business name</span>
            <input className={styles.field} value={businessName} maxLength={160} onChange={(event) => setBusinessName(event.target.value)} />
          </label>
          <label className={styles.composer}>
            <span className={styles.label}>Context Aethelios may use</span>
            <textarea
              className={styles.field}
              value={businessContext}
              maxLength={2000}
              onChange={(event) => setBusinessContext(event.target.value)}
            />
          </label>
          <p className={styles.meta}>
            Confirmed facts stay grounded in what you write. Client names, outcomes, and branding
            decisions are not invented here.
          </p>
          <div className={styles.actions}>
            <button className="btn btn-gold" type="button" disabled={pending || !business} onClick={() => void submit(false)}>
              {pending ? "Saving…" : saved ? "Confirmed" : "Confirm and continue"}
            </button>
            {conflict ? (
              <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => void submit(true)}>
                Replace the previous direction
              </button>
            ) : null}
          </div>
        </article>
        <aside className={`${styles.inspector} on-glass`}>
          <p className={styles.label}>Discovery direction</p>
          {selection && direction ? (
            <>
              <p>
                <strong>{direction.name}</strong> — {direction.epithet}
              </p>
              <p className={styles.meta}>
                Selection {selection.selectionId} · revision {selection.localRevision}
              </p>
              <p>{selection.businessName || "Business name was not specified in Discovery."}</p>
              <p className={styles.meta}>
                {selection.audience.trim() || "Audience not specified."}
              </p>
            </>
          ) : (
            <p className="muted">No Discovery direction is waiting on this device. You can still confirm the business name.</p>
          )}
          {confirmation ? (
            <p className={styles.meta} style={{ marginTop: 16 }}>
              Last confirmed {new Date(confirmation.confirmedAt).toLocaleString()}
              {confirmation.sourceRevision != null ? ` · revision ${confirmation.sourceRevision}` : ""}.
            </p>
          ) : null}
          {saved ? (
            <AppLink className="btn btn-gold" href="/companion/studio">
              Open Studio
            </AppLink>
          ) : (
            <AppLink className="btn btn-ghost" href="/companion">
              Return to Today
            </AppLink>
          )}
        </aside>
      </div>
    </CompanionShell>
  );
}
