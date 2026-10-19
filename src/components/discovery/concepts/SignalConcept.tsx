"use client";

import type { ConceptContent, PaletteId, VisualDirectionId } from "@/lib/discovery";
import { paletteStyle } from "./paletteStyle";
import { platesFor } from "./plates";
import styles from "./signal.module.css";

export function SignalConcept({
  content,
  paletteId,
  visualDirectionId,
  onAction,
  onSection
}: {
  content: ConceptContent;
  paletteId: PaletteId;
  visualDirectionId: VisualDirectionId;
  onAction: () => void;
  onSection: (id: string) => void;
}) {
  const plates = platesFor(visualDirectionId);
  return (
    <article className={styles.root} style={paletteStyle(paletteId)} aria-label={`${content.businessName} — Signal direction`}>
      <div className={styles.main}>
        <div className={styles.bar}>
          <span>{content.businessName}</span>
          <nav aria-label="Signal preview sections">
            {(
              [
                ["opening", "Mark"],
                ["image", "Crop"],
                ["services", "Offer"],
                ["action", "Reserve"]
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" onClick={() => onSection(id)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
        <section className={styles.hero} id="opening">
          <p className={styles.caption}>{content.kicker}</p>
          <h2 title={content.businessName}>{content.headline}</h2>
          <div className={styles.rule} />
          <p>{content.opening}</p>
          <p>{content.atmosphere}</p>
        </section>
        <section className={styles.poster} id="image">
          <img src={plates.primary} alt={plates.alt} width={1200} height={900} loading="lazy" decoding="async" />
          <div className={styles.overlay}>
            <p className={styles.caption}>{content.imageCaption}</p>
          </div>
        </section>
        <section className={styles.tiles} id="services">
          {content.services.map((service) => (
            <article className={styles.tile} key={service.id}>
              <h3>{service.title}</h3>
              <p>{service.detail}</p>
            </article>
          ))}
        </section>
        <ol className={styles.timeline}>
          {content.journey.map((step) => (
            <li key={step.id}>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </div>
      <aside className={styles.rail} id="action">
        <p className={styles.caption}>Next step</p>
        <h3>{content.actionLabel}</h3>
        <p className={styles.hint}>{content.actionHint}</p>
        <button className={styles.cta} type="button" onClick={onAction}>
          {content.actionLabel}
        </button>
        <p className={styles.hint}>{content.closing}</p>
      </aside>
    </article>
  );
}
