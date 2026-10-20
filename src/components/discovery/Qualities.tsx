"use client";

import { QUALITY_COPY, QUALITY_ORDER, type DiscoveryDraft, type QualityId } from "@/lib/discovery";
import styles from "./DiscoveryStudio.module.css";

const SWATCH: Record<QualityId, string> = {
  refined: "linear-gradient(135deg, rgba(8, 12, 11, 0.18), transparent 48%), url('/atmosphere/lumen.webp')",
  welcoming: "linear-gradient(135deg, rgba(18, 26, 23, 0.12), transparent 50%), url('/atmosphere/hearth.webp')",
  bold: "linear-gradient(135deg, rgba(8, 12, 11, 0.28), transparent 42%), url('/atmosphere/signal.webp')",
  grounded: "linear-gradient(135deg, #121A17, #102E25 48%, #A7B6AC)",
  contemporary: "linear-gradient(135deg, #0B4635, #080C0B 55%, #E2C988)"
};

export function Qualities({
  draft,
  onToggle,
  onBack,
  onContinue
}: {
  draft: DiscoveryDraft;
  onToggle: (id: QualityId) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section>
      <p className={styles.kicker}>Direction qualities</p>
      <h2 className={styles.heading} data-discovery-heading tabIndex={-1}>What should it feel like?</h2>
      <p className={styles.lede}>
        Choose the qualities that belong to this business. The examples show the difference; they are
        not finished websites.
      </p>
      <div className={styles.qualityGrid}>
        {QUALITY_ORDER.map((id) => {
          const copy = QUALITY_COPY[id];
          const pressed = draft.qualities.includes(id);
          return (
            <button
              key={id}
              type="button"
              className={styles.quality}
              aria-pressed={pressed}
              onClick={() => onToggle(id)}
            >
              <span className={styles.swatch} style={{ background: SWATCH[id] }} aria-hidden="true" />
              <span className={styles.qualityCopy}>
                <strong>{copy.label}</strong>
                {pressed ? <span className={styles.badge}>Selected</span> : null}
                <em style={{ display: "block", color: "var(--d-muted, #5a6a62)", fontStyle: "normal", marginTop: 8 }}>
                  {copy.summary}
                </em>
                <em style={{ display: "block", color: "#8a6a32", fontStyle: "normal", marginTop: 8, fontSize: 13 }}>
                  {copy.example}
                </em>
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.footerNav}>
        <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onBack}>
          Back
        </button>
        <button className={`${styles.btn} ${styles.btnGold}`} type="button" onClick={onContinue}>
          Open the studio
        </button>
      </div>
    </section>
  );
}
