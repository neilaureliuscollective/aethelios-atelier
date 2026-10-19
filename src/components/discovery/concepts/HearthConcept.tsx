"use client";

import type { ConceptContent, PaletteId, VisualDirectionId } from "@/lib/discovery";
import { paletteStyle } from "./paletteStyle";
import { platesFor } from "./plates";
import styles from "./hearth.module.css";

export function HearthConcept({
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
    <article className={styles.root} style={paletteStyle(paletteId)} aria-label={`${content.businessName} — Hearth direction`}>
      <header className={styles.top}>
        <div className={styles.mark}>{content.businessName}</div>
        <nav aria-label="Hearth preview sections">
          {(
            [
              ["opening", "Welcome"],
              ["image", "Materials"],
              ["services", "Offer"],
              ["action", "Time"]
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => onSection(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <div className={styles.grid}>
        <section className={styles.story} id="opening">
          <p className={styles.kicker}>{content.kicker}</p>
          <h2>{content.headline}</h2>
          <p>{content.opening}</p>
          <p>{content.atmosphere}</p>
          <div className={styles.stack} id="image">
            <img src={plates.primary} alt={plates.alt} width={1200} height={900} loading="lazy" decoding="async" />
            <img src={plates.secondary} alt="" width={900} height={900} loading="lazy" decoding="async" />
          </div>
          <p className={styles.caption}>{content.imageCaption}</p>
        </section>
        <aside className={styles.welcome} id="action">
          <h3>A place is kept</h3>
          <p>By appointment. Hours stay with the business — this panel only shows how a welcome might feel.</p>
          <div className={styles.hours}>
            <div>First visit · a conversation</div>
            <div>Return visits · the work itself</div>
            <div>Booking · your existing provider</div>
          </div>
          <button className={styles.cta} type="button" onClick={onAction}>
            {content.actionLabel}
          </button>
          <p className={styles.hint}>{content.actionHint}</p>
        </aside>
        <section className={styles.services} id="services">
          {content.services.map((service) => (
            <details className={styles.card} key={service.id}>
              <summary>{service.title}</summary>
              <p>{service.detail}</p>
            </details>
          ))}
        </section>
      </div>
    </article>
  );
}
