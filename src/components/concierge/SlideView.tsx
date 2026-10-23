"use client";

import { AppLink } from "@/components/ui/AppLink";
import type { PresentationSlide, PresentationTheme } from "@/lib/concierge/types";
import styles from "./concierge.module.css";

function Plate({ title, body, mark }: { title: string; body?: string; mark?: string }) {
  return (
    <div className={styles.plate}>
      {mark ? <span className={styles.plateMark}>{mark}</span> : null}
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
    </div>
  );
}

export function SlideView({
  slide,
  theme,
  composing = false
}: {
  slide: PresentationSlide;
  theme: PresentationTheme;
  composing?: boolean;
}) {
  return (
    <article
      className={styles.slide}
      data-mood={theme.mood}
      data-accent={theme.accent}
      data-density={theme.density}
      data-enter={slide.enter}
      data-emphasis={slide.emphasis}
      data-layout={slide.layout}
      data-composing={composing ? "true" : undefined}
    >
      <div className={styles.slideCopy}>
        {slide.kicker ? <p className={styles.slideKicker}>{slide.kicker}</p> : null}
        {slide.headline ? <h3>{slide.headline}</h3> : null}
        {slide.subhead ? <p className={styles.slideSubhead}>{slide.subhead}</p> : null}
        {slide.body && slide.layout !== "split" && slide.layout !== "stats" ? (
          <p className={styles.slideBody}>{slide.body}</p>
        ) : null}
        {slide.quote ? (
          <p className={styles.quote}>
            {slide.quote}
            {slide.attribution ? <span> — {slide.attribution}</span> : null}
          </p>
        ) : null}
        {slide.columns?.length ? (
          <div className={styles.split}>
            {slide.columns.map((column) => (
              <Plate key={column.title} title={column.title} body={column.body} />
            ))}
          </div>
        ) : null}
        {slide.stats?.length ? (
          <div className={styles.statRow}>
            {slide.stats.map((stat) => (
              <div className={styles.stat} key={stat.label}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        {slide.steps?.length ? (
          <div className={styles.stepRow}>
            {slide.steps.map((step, index) => (
              <Plate key={step.title} mark={String(index + 1).padStart(2, "0")} title={step.title} body={step.body} />
            ))}
          </div>
        ) : null}
        {slide.bullets?.length ? (
          <ul className={styles.tenets}>
            {slide.bullets.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
        {slide.body && (slide.layout === "split" || slide.layout === "stats") ? (
          <p className={styles.slideFoot}>{slide.body}</p>
        ) : null}
        {slide.cta ? (
          <AppLink className={`btn btn-ghost ${styles.slideCta}`} href={slide.cta.href}>
            {slide.cta.label}
          </AppLink>
        ) : null}
      </div>
    </article>
  );
}
