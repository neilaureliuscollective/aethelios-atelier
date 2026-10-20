"use client";

import { conceptSectionId, type ConceptContent, type PaletteId, type VisualDirectionId } from "@/lib/discovery";
import { paletteStyle } from "./paletteStyle";
import { platesFor } from "./plates";
import { ScenePlate } from "./ScenePlate";
import styles from "./hearth.module.css";

export function HearthConcept({
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
  const plates = platesFor(visualDirectionId, "hearth");
  return (
    <article
      className={styles.root}
      style={paletteStyle(paletteId)}
      data-direction="hearth"
      data-preview-root={instanceId}
      aria-label={`${content.businessName} — Hearth direction`}
    >
      <header className={styles.top}>
        <div className={styles.mark}>{content.businessName}</div>
        <nav aria-label={`${content.businessName} Hearth preview sections`}>
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
        <section className={styles.story} id={conceptSectionId(instanceId, "opening")}>
          <p className={styles.kicker}>{content.kicker}</p>
          <h2>{content.headline}</h2>
          <div className={styles.stack} id={conceptSectionId(instanceId, "image")}>
            <ScenePlate
              src={plates.primary}
              fallbackSrc={plates.fallback}
              alt={plates.alt}
              width={plates.width}
              height={plates.height}
            />
            <ScenePlate
              src={plates.secondary}
              fallbackSrc={plates.fallback}
              alt=""
              width={1200}
              height={900}
            />
          </div>
          <p className={styles.caption}>{content.imageCaption}</p>
          <p>{content.opening}</p>
          <p>{content.atmosphere}</p>
        </section>
        <aside className={styles.welcome} id={conceptSectionId(instanceId, "action")}>
          <p className={styles.kicker}>Visit</p>
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
        <section className={styles.services} id={conceptSectionId(instanceId, "services")}>
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
