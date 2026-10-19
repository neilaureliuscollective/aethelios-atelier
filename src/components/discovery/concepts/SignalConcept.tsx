"use client";

import { conceptSectionId, type ConceptContent, type PaletteId, type VisualDirectionId } from "@/lib/discovery";
import { paletteStyle } from "./paletteStyle";
import { platesFor } from "./plates";
import styles from "./signal.module.css";

export function SignalConcept({
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
      data-direction="signal"
      data-preview-root={instanceId}
      aria-label={`${content.businessName} — Signal direction`}
    >
      <div className={styles.main}>
        <div className={styles.bar}>
          <span>{content.businessName}</span>
          <nav aria-label={`${content.businessName} Signal preview sections`}>
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
        <section className={styles.hero} id={conceptSectionId(instanceId, "opening")}>
          <p className={styles.caption}>{content.kicker}</p>
          <h2 title={content.headline}>{content.headline}</h2>
          <div className={styles.rule} />
          <p>{content.opening}</p>
          <p>{content.atmosphere}</p>
        </section>
        <section className={styles.poster} id={conceptSectionId(instanceId, "image")}>
          <img src={plates.primary} alt={plates.alt} width={1200} height={900} loading="lazy" decoding="async" />
          <div className={styles.overlay}>
            <p className={styles.caption}>{content.imageCaption}</p>
          </div>
        </section>
        <section className={styles.tiles} id={conceptSectionId(instanceId, "services")}>
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
      <aside className={styles.rail} id={conceptSectionId(instanceId, "action")}>
        <p className={styles.caption}>Next step</p>
        <h3>{content.actionLabel}</h3>
        <p className={styles.hint}>{content.actionHint}</p>
        <button className={styles.cta} type="button" onClick={onAction} data-demo-direction="signal">
          {content.actionLabel}
        </button>
        <p className={styles.hint}>{content.closing}</p>
      </aside>
    </article>
  );
}
