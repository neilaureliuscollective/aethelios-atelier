"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { useSession } from "@/components/shell/SessionShell";
import { AppLink } from "@/components/ui/AppLink";
import { ApiError, api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { PALETTES, VISUAL_DIRECTION_COPY } from "@/lib/discovery/catalog";
import { DIRECTIONS, parseSelection, readDiscoveryHandoff, type DiscoverySelection } from "@/lib/discovery";
import { clearGuestIntent, readGuestIntent } from "@/lib/guest/intent";
import type { Business, BusinessConfirmation, StudioDraft } from "@/lib/cofounder/types";
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
  const router = useRouter();
  const [phase, setPhase] = useState<"checking" | "ready" | "blocked">("checking");
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
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [claimState, setClaimState] = useState<"idle" | "claimed" | "failed">("idle");

  useEffect(() => {
    const next = selectionFromDevice();
    setSelection(next);
    if (!user) {
      setPhase("ready");
      return;
    }

    const intent = readGuestIntent();
    const claim = next
      ? api("/api/companion/guest-claim", {
          method: "POST",
          body: JSON.stringify({
            guestWorkId: next.selectionId,
            kind: "discovery",
            destination: intent?.destination ?? "/companion/confirm",
            payload: next
          })
        })
          .then(() => setClaimState("claimed"))
          .catch((err) => {
            setClaimState("failed");
            setError(actionErrorMessage(err, "This Discovery direction could not be claimed."));
            throw err;
          })
      : Promise.resolve(setClaimState("idle"));

    const workspace = api<{
      business: Business;
      confirmation: BusinessConfirmation | null;
      rawProfile: { fields: { name: { value: string }; audience: { value: string } } };
    }>("/api/companion/workspace")
      .then((data) => {
        setBusiness(data.business);
        setConfirmation(data.confirmation);
        if (data.confirmation?.studioDraftId) {
          setDraft({ id: data.confirmation.studioDraftId } as StudioDraft);
        }
        const existingName = data.confirmation?.businessName || data.rawProfile.fields.name.value || data.business.name;
        setBusinessName(existingName === "Your business" && next?.businessName ? next.businessName : existingName);
        setBusinessContext(
          data.confirmation?.businessContext ||
            data.rawProfile.fields.audience.value ||
            [next?.audience, next?.intentNote].filter(Boolean).join(" ").trim()
        );
      });

    void Promise.allSettled([claim, workspace]).then(([claimResult, workspaceResult]) => {
      if (workspaceResult.status === "rejected") {
        setError(actionErrorMessage(workspaceResult.reason, "The workspace could not open."));
        setPhase("blocked");
        return;
      }
      if (next && claimResult.status === "rejected") {
        setPhase("blocked");
        return;
      }
      setPhase("ready");
    });
  }, [user]);

  async function submit(replace = false) {
    if (pending || !business || phase !== "ready") return;
    if (selection && claimState !== "claimed") return;
    setPending(true);
    setError("");
    setStatus("");
    try {
      const result = await api<{
        ok: true;
        confirmation: BusinessConfirmation;
        draft: StudioDraft | null;
        studioHref?: string;
      }>("/api/companion/confirm", {
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
      setDraft(result.draft);
      setConflict(null);
      setSaved(true);
      setStatus(
        result.draft
          ? "Business and direction confirmed. Opening the matching Studio draft."
          : "Business confirmed. You can open Studio when a Discovery direction is claimed."
      );
      clearGuestIntent();
      if (result.studioHref && result.draft) {
        router.push(result.studioHref as Route);
        return;
      }
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
  const palette = selection ? PALETTES[selection.visualPreferences.paletteId] : null;
  const visual = selection ? VISUAL_DIRECTION_COPY[selection.visualPreferences.visualDirectionId] : null;
  const replacing =
    Boolean(confirmation?.sourceSelectionId && selection) &&
    (confirmation?.sourceSelectionId !== selection?.selectionId ||
      confirmation?.sourceRevision !== selection?.localRevision ||
      confirmation?.directionId !== selection?.selectedDirectionId);
  const canSubmit =
    phase === "ready" && Boolean(business) && !pending && (!selection || claimState === "claimed");

  if (phase === "checking") {
    return (
      <CompanionShell
        title="Confirm this business"
        lede="Checking the signed-in owner, claimed Discovery snapshot, and target workspace before anything is adopted."
      >
        <p className="notice">Checking authorization and any claimed Discovery direction…</p>
      </CompanionShell>
    );
  }

  return (
    <CompanionShell
      title="Confirm this business"
      lede="Review the business and the Discovery direction before Studio uses them. Existing businesses keep their name unless you change it here."
    >
      {error ? <p className="notice notice-warn">{error}</p> : null}
      {status ? <p className="notice">{status}</p> : null}
      {phase === "blocked" && selection ? (
        <p className="notice notice-warn">
          A failed guest claim stops adoption. Sign in as the owner of this Discovery direction, or start a new
          selection.
        </p>
      ) : null}
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
            <button className="btn btn-gold" type="button" disabled={!canSubmit || replacing} onClick={() => void submit(false)}>
              {pending ? "Saving…" : saved ? "Confirmed" : "Confirm and continue"}
            </button>
            {conflict || replacing ? (
              <button className="btn btn-ghost" type="button" disabled={!canSubmit} onClick={() => void submit(true)}>
                Adopt the newer revision and keep the first draft
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
              <p data-visual-palette={selection.visualPreferences.paletteId}>
                {palette?.label ?? selection.visualPreferences.paletteId} · {visual?.label ?? selection.visualPreferences.visualDirectionId}
              </p>
              <p>{selection.visualPreferences.headline || selection.businessName || "Business name was not specified in Discovery."}</p>
              <p className={styles.meta}>
                {selection.audience.trim() || "Audience not specified."}
              </p>
              {replacing ? (
                <p className="notice notice-warn" data-revision-replace="pending">
                  A newer Discovery revision is waiting. The first confirmed draft stays saved. Confirm
                  replacement to adopt revision {selection.localRevision} without overwriting revision{" "}
                  {confirmation?.sourceRevision}.
                </p>
              ) : null}
            </>
          ) : (
            <p className="muted">No Discovery direction is waiting on this device. You can still confirm the business name.</p>
          )}
          {confirmation ? (
            <p className={styles.meta} style={{ marginTop: 16 }}>
              Last confirmed {new Date(confirmation.confirmedAt).toLocaleString()}
              {confirmation.sourceRevision != null ? ` · revision ${confirmation.sourceRevision}` : ""}
              {confirmation.studioDraftId ? ` · draft ${confirmation.studioDraftId.slice(0, 12)}` : ""}.
            </p>
          ) : null}
          {saved && draft ? (
            <AppLink className="btn btn-gold" href={`/companion/studio?draftId=${encodeURIComponent(draft.id)}`}>
              Open the matching Studio draft
            </AppLink>
          ) : saved ? (
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
