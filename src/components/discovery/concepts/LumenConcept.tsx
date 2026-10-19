"use client";

import { conceptSectionId, type ConceptContent, type PaletteId, type VisualDirectionId } from "@/lib/discovery";
import { paletteStyle } from "./paletteStyle";
import { platesFor } from "./plates";
import styles from "./lumen.module.css";

export function LumenConcept({
  instanceId,
  content,
  paletteId,
  visualDirectionId,
  onAction,
  onSection
}: {
  instanceId: string;
  content: ConceptContent;
  paletteId: PaletteId;
  visualDirectionId: VisualDirectionId;
  onAction: () => void;
  onSection: (section: string) => void;
}) {
  const plates = platesFor(visualDirectionId);
  return (
    <article
      className={styles.root}
      style={paletteStyle(paletteId)}
      data-direction="lumen"
      data-preview-root={instanceId}
      aria-label={`${content.businessName} — Lumen direction`}
    >
      <header className={styles.mast}>
        <div className={styles.word}>{content.businessName}</div>
        <nav className={styles.nav} aria-label={`${content.businessName} Lumen preview sections`}>
          {(
            [
              ["opening", "Opening"],
              ["image", "Atmosphere"],
              ["services", "Offer"],
              ["action", "Continue"]
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => onSection(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <section className={styles.opening} id={conceptSectionId(instanceId, "opening")}>
        <p className={styles.kicker}>{content.kicker}</p>
        <h2>{content.headline}</h2>
        <p>{content.opening}</p>
        <p>{content.atmosphere}</p>
      </section>
      <figure className={styles.plate} id={conceptSectionId(instanceId, "image")}>
        <img src={plates.primary} alt={plates.alt} width={1200} height={900} loading="lazy" decoding="async" />
        <figcaption>{content.imageCaption}</figcaption>
      </figure>
      <section className={styles.services} id={conceptSectionId(instanceId, "services")}>
        {content.services.map((service, index) => (
          <div className={styles.service} key={service.id}>
            <div className={styles.index}>{String(index + 1).padStart(2, "0")}</div>
            <div>
              <h3>{service.title}</h3>
              <p>{service.detail}</p>
            </div>
          </div>
        ))}
      </section>
      <section className={styles.journey} aria-label="Customer path">
        {content.journey.map((step) => (
          <details key={step.id}>
            <summary>{step.title}</summary>
            <p>{step.detail}</p>
          </details>
        ))}
      </section>
      <section className={styles.action} id={conceptSectionId(instanceId, "action")}>
        <button className={styles.cta} type="button" onClick={onAction}>
          {content.actionLabel}
        </button>
        <p className={styles.hint}>{content.actionHint}</p>
      </section>
      <p className={styles.closing}>{content.closing}</p>
    </article>
  );
}
