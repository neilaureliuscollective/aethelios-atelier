"use client";

import { BUSINESS_TYPES, INTENT_COPY, type DiscoveryDraft } from "@/lib/discovery";
import styles from "./DiscoveryStudio.module.css";

const TYPE_LABELS: Record<(typeof BUSINESS_TYPES)[number], string> = {
  appointment: "Appointments and bookings",
  local_service: "Local service",
  independent: "Independent practice or studio",
  not_sure: "Not sure yet"
};

export function ConfirmBusiness({
  draft,
  onPatch,
  onBack,
  onContinue
}: {
  draft: DiscoveryDraft;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section>
      <p className={styles.kicker}>Confirm the business</p>
      <h2 className={styles.heading} data-discovery-heading tabIndex={-1}>
        Review this context before the studio.
      </h2>
      <p className={styles.lede}>
        The concepts will use exactly what you confirm here. Empty fields stay empty — they are not
        invented. You can still change them later.
      </p>
      <div className={styles.solid} style={{ padding: 22, display: "grid", gap: 16 }}>
        <label className={styles.field}>
          <span>Business name</span>
          <input
            className={styles.input ?? styles.textarea}
            value={draft.businessName}
            maxLength={80}
            onChange={(event) => onPatch({ businessName: event.target.value })}
          />
        </label>
        <label className={styles.field}>
          <span>What this business is</span>
          <div className={styles.options} role="radiogroup" aria-label="Business type">
            {BUSINESS_TYPES.map((id) => (
              <label className={styles.option} key={id}>
                <input
                  type="radio"
                  name="confirm-type"
                  checked={draft.businessType === id}
                  onChange={() => onPatch({ businessType: id })}
                />
                <span>
                  <strong>
                    {TYPE_LABELS[id]}
                    {draft.businessType === id ? " · selected" : ""}
                  </strong>
                </span>
              </label>
            ))}
          </div>
        </label>
        <label className={styles.field}>
          <span>Written intent</span>
          <textarea
            className={styles.textarea}
            value={draft.intentNote}
            maxLength={160}
            onChange={(event) => onPatch({ intentNote: event.target.value })}
          />
          <span className={styles.fine}>
            {draft.intent ? INTENT_COPY[draft.intent].label : "Aim not specified"}
          </span>
        </label>
        <label className={styles.field}>
          <span>Audience</span>
          <textarea
            className={styles.textarea}
            value={draft.audience}
            maxLength={280}
            onChange={(event) => onPatch({ audience: event.target.value })}
          />
        </label>
      </div>
      <div className={styles.footerNav}>
        <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onBack}>
          Back
        </button>
        <button className={`${styles.btn} ${styles.btnGold}`} type="button" onClick={onContinue}>
          Confirm and open the studio
        </button>
      </div>
    </section>
  );
}
