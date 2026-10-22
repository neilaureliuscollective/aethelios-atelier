"use client";

import { useEffect, useState } from "react";
import { CompanionShell } from "@/components/cofounder/CompanionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { useSession } from "@/components/shell/SessionShell";
import { LIFESTYLE_PROJECT, lifestyleMissingCopy } from "@/lib/cofounder/lifestyle";
import type { ApprovedRate, BusinessProfile, DocumentFactCandidate, MemoryProposal, UsageSnapshot } from "@/lib/cofounder/types";
import { DocumentIntake, type IntakeDocument } from "@/components/cofounder/DocumentIntake";
import styles from "./companion.module.css";

const FIELD_LABELS: Record<string, string> = {
  name: "Project or business name",
  audience: "Audience",
  services: "Services",
  products: "Products",
  approvedPrices: "Approved price notes",
  tone: "Tone",
  priorities: "Priorities",
  brandNotes: "Brand notes"
};

export function BusinessClient() {
  const { user, generation } = useSession();
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [pending, setPending] = useState<MemoryProposal[]>([]);
  const [documents, setDocuments] = useState<IntakeDocument[]>([]);
  const [candidates, setCandidates] = useState<DocumentFactCandidate[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [rateLabel, setRateLabel] = useState("Hourly strategy");
  const [rateCents, setRateCents] = useState("15000");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function load(gen = generation) {
    const data = await api<{
      rawProfile: BusinessProfile;
      usage: UsageSnapshot;
      memoryPending: MemoryProposal[];
      documents: IntakeDocument[];
      documentCandidates: DocumentFactCandidate[];
    }>("/api/companion/workspace");
    if (!ownerFence.isCurrent(gen, user?.id ?? null)) return;
    setProfile(data.rawProfile);
    setUsage(data.usage);
    setPending(data.memoryPending);
    setDocuments(data.documents);
    setCandidates(data.documentCandidates ?? []);
  }

  useEffect(() => {
    if (!user) return;
    void load().catch((err) => setError(actionErrorMessage(err, "Business profile could not load.")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, user?.id]);

  async function save() {
    if (!profile) return;
    await api("/api/companion/workspace", {
      method: "PATCH",
      body: JSON.stringify({
        fields: profile.fields,
        approvedRates: profile.approvedRates
      })
    });
    setStatus("Confirmed facts and preferences saved. Suggestions stay separate until you accept them.");
    await load();
  }

  async function addRate() {
    if (!profile) return;
    const rate: ApprovedRate = {
      id: `rate_${crypto.randomUUID()}`,
      label: rateLabel,
      unit: "hour",
      amountCents: Number(rateCents),
      currency: "USD",
      source: "owner",
      updatedAt: new Date().toISOString()
    };
    if (!Number.isInteger(rate.amountCents) || rate.amountCents < 0) return;
    setProfile({ ...profile, approvedRates: [...profile.approvedRates, rate] });
  }

  return (
    <CompanionShell
      title="Workspace context"
      lede="This is the saved project or brand home. Studio placement and crop stay on the draft until you save them there. Individuals can keep Project workspace without inventing a company."
    >
      {error ? <p className="notice notice-warn">{error}</p> : null}
      {profile ? (
        <div className={styles.grid}>
          <article className={`${styles.glassCard} on-glass`}>
            <p className={styles.label}>Saved defaults</p>
            {/lifestyle/i.test(profile.fields.name.value) ? (
              <p className="notice">
                Selected project: {LIFESTYLE_PROJECT.brandName}. {LIFESTYLE_PROJECT.story} Missing
                assets: {lifestyleMissingCopy()}.
              </p>
            ) : null}
            {Object.values(profile.fields).map((field) => (
              <label key={field.key} className={styles.composer}>
                <span className={styles.label}>
                  {FIELD_LABELS[field.key] ?? field.key}
                </span>
                <span className={styles.meta}>
                  {field.kind}
                  {field.source ? ` · ${field.source}` : ""}
                  {field.sourcePage ? ` · ${field.sourcePage}` : ""}
                  {field.sourceStatus && field.sourceStatus !== "live" ? ` · ${field.sourceStatus}` : ""}
                  {field.updatedAt ? ` · updated ${new Date(field.updatedAt).toLocaleString()}` : ""}
                </span>
                <textarea
                  className={styles.field}
                  value={field.value}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      fields: {
                        ...profile.fields,
                        [field.key]: { ...field, value: event.target.value }
                      }
                    })
                  }
                />
                <button
                  className="btn btn-ghost btn-compact"
                  type="button"
                  onClick={() =>
                    setProfile({
                      ...profile,
                      fields: {
                        ...profile.fields,
                        [field.key]: {
                          ...field,
                          kind: field.kind === "preference" ? "confirmed" : "preference",
                          source: "owner"
                        }
                      }
                    })
                  }
                >
                  Mark as {field.kind === "preference" ? "confirmed fact" : "preference"}
                </button>
              </label>
            ))}
            <button className="btn btn-gold" type="button" onClick={() => void save()}>
              Save profile
            </button>
            {status ? <p className="notice">{status}</p> : null}
          </article>
          <aside className={`${styles.inspector} on-glass`}>
            <p className={styles.label}>Brand assets</p>
            <p className={styles.meta}>
              Logos and source files stored here are business defaults. Temporary Studio crop, placement, and selected images stay on the open draft.
            </p>
            <p className={styles.label}>Approved rates</p>
            {profile.approvedRates.map((rate) => (
              <p key={rate.id}>
                {rate.label}: ${(rate.amountCents / 100).toFixed(2)} / {rate.unit}
              </p>
            ))}
            <input className={styles.field} value={rateLabel} onChange={(event) => setRateLabel(event.target.value)} />
            <input className={styles.field} value={rateCents} onChange={(event) => setRateCents(event.target.value)} />
            <button className="btn btn-ghost" type="button" onClick={() => addRate()}>
              Add approved rate (cents)
            </button>
            <DocumentIntake
              documents={documents}
              sourceDocumentIds={profile.sourceDocumentIds}
              candidates={candidates}
              onChanged={load}
            />
            <p className={styles.label}>Pending memory</p>
            {pending.length === 0 ? <p className="muted">No suggestions waiting.</p> : null}
            {pending.map((item) => (
              <div key={item.id} className={styles.resultCard} style={{ marginBottom: 8 }}>
                <p>
                  {item.fieldKey}: {item.proposedValue}
                </p>
                <textarea
                  className={styles.field}
                  value={edits[item.id] ?? item.proposedValue}
                  onChange={(event) => setEdits({ ...edits, [item.id]: event.target.value })}
                />
                <div className={styles.actions}>
                  {(["accept", "edit", "reject", "delete"] as const).map((action) => (
                    <button
                      key={action}
                      className="btn btn-ghost btn-compact"
                      type="button"
                      onClick={() =>
                        void api("/api/companion/memory", {
                          method: "POST",
                          body: JSON.stringify({
                            proposalId: item.id,
                            action,
                            editedValue: edits[item.id] ?? item.proposedValue
                          })
                        }).then(() => load())
                      }
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {usage ? (
              <p className="muted" style={{ marginTop: 16 }}>
                Period usage: Talk {usage.talkUsed}/{usage.talkLimit}, images {usage.imagesUsed}/{usage.imageLimit}, voice{" "}
                {usage.voiceMinutesUsed}/{usage.voiceMinuteLimit}. These are configured budgets, not a promise of unlimited
                work.
              </p>
            ) : null}
          </aside>
        </div>
      ) : null}
    </CompanionShell>
  );
}
