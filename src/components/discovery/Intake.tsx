"use client";

import {
  BUSINESS_TYPE_COPY,
  BUSINESS_TYPES,
  FEELING_COPY,
  FEELING_IDS,
  INTENT_COPY,
  INTENT_IDS,
  type DiscoveryDraft
} from "@/lib/discovery";
import styles from "./DiscoveryStudio.module.css";

export function Intake({
  draft,
  step,
  onPatch,
  onStep,
  onContinue
}: {
  draft: DiscoveryDraft;
  step: number;
  onPatch: (patch: Partial<DiscoveryDraft>) => void;
  onStep: (step: number) => void;
  onContinue: () => void;
}) {
  return (
    <section className={styles.panel}>
      <p className={styles.kicker}>About the business · {step + 1} of 4</p>
      {step === 0 ? (
        <>
          <h2>What is the name of the business?</h2>
          <p className={styles.lede}>You can leave this open. The preview will say “Your business” until you name it.</p>
          <label className={styles.field}>
            <span>Business name</span>
            <input
              className={styles.input}
              type="text"
              value={draft.businessName}
              maxLength={80}
              autoComplete="organization"
              onChange={(event) => onPatch({ businessName: event.target.value })}
            />
          </label>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <h2>What kind of business is this?</h2>
          <p className={styles.lede}>Start with an appointment-based practice if that is closest. Unknown is allowed.</p>
          <div className={styles.options} role="radiogroup" aria-label="Type of business">
            {BUSINESS_TYPES.map((id) => (
              <label className={styles.option} key={id}>
                <input
                  type="radio"
                  name="businessType"
                  value={id}
                  checked={draft.businessType === id}
                  onChange={() => onPatch({ businessType: id })}
                />
                <span>
                  <strong>{BUSINESS_TYPE_COPY[id].label}</strong>
                  <em>{BUSINESS_TYPE_COPY[id].summary}</em>
                </span>
              </label>
            ))}
          </div>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <h2>What should this make possible?</h2>
          <p className={styles.lede}>Choose the closest aim. You can add a sentence if you already know more.</p>
          <div className={styles.options} role="radiogroup" aria-label="What they want to achieve">
            {INTENT_IDS.map((id) => (
              <label className={styles.option} key={id}>
                <input
                  type="radio"
                  name="intent"
                  value={id}
                  checked={draft.intent === id}
                  onChange={() => onPatch({ intent: id })}
                />
                <span>
                  <strong>{INTENT_COPY[id].label}</strong>
                  <em>{INTENT_COPY[id].summary}</em>
                </span>
              </label>
            ))}
          </div>
          <label className={styles.field}>
            <span>Optional note</span>
            <textarea
              className={styles.textarea}
              value={draft.intentNote}
              maxLength={160}
              onChange={(event) => onPatch({ intentNote: event.target.value })}
            />
          </label>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <h2>How should customers feel?</h2>
          <p className={styles.lede}>This shapes atmosphere. It is not a growth promise.</p>
          <div className={styles.options} role="radiogroup" aria-label="How customers should feel">
            {FEELING_IDS.map((id) => (
              <label className={styles.option} key={id}>
                <input
                  type="radio"
                  name="feeling"
                  value={id}
                  checked={draft.customerFeeling === id}
                  onChange={() => onPatch({ customerFeeling: id })}
                />
                <span>
                  <strong>{FEELING_COPY[id].label}</strong>
                  <em>{FEELING_COPY[id].summary}</em>
                </span>
              </label>
            ))}
          </div>
          <label className={styles.field}>
            <span>Who is this for? Optional.</span>
            <textarea
              className={styles.textarea}
              value={draft.audience}
              maxLength={280}
              onChange={(event) => onPatch({ audience: event.target.value })}
            />
          </label>
        </>
      ) : null}
      <div className={styles.footerNav}>
        <button
          className={`${styles.btn} ${styles.btnGhost}`}
          type="button"
          onClick={() => onStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          Back
        </button>
        <button
          className={`${styles.btn} ${styles.btnGold}`}
          type="button"
          onClick={() => (step >= 3 ? onContinue() : onStep(step + 1))}
        >
          {step >= 3 ? "Choose qualities" : "Continue"}
        </button>
      </div>
    </section>
  );
}
