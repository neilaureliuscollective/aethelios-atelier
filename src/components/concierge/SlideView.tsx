import { AppLink } from "@/components/ui/AppLink";
import type { PresentationSlide, PresentationTheme } from "@/lib/concierge/types";
import styles from "./concierge.module.css";

export function SlideView({
  slide,
  theme
}: {
  slide: PresentationSlide;
  theme: PresentationTheme;
}) {
  return (
    <article
      className={styles.slide}
      data-mood={theme.mood}
      data-enter={slide.enter}
      data-emphasis={slide.emphasis}
      data-layout={slide.layout}
    >
      {slide.kicker ? <p className={styles.slideKicker}>{slide.kicker}</p> : null}
      {slide.headline ? <h3>{slide.headline}</h3> : null}
      {slide.subhead ? <p>{slide.subhead}</p> : null}
      {slide.body ? <p>{slide.body}</p> : null}
      {slide.quote ? (
        <p className={styles.quote}>
          {slide.quote}
          {slide.attribution ? <span> — {slide.attribution}</span> : null}
        </p>
      ) : null}
      {slide.columns?.length ? (
        <div className={styles.split}>
          {slide.columns.map((column) => (
            <div className={styles.column} key={column.title}>
              <strong>{column.title}</strong>
              <p>{column.body}</p>
            </div>
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
          {slide.steps.map((step) => (
            <div className={styles.step} key={step.title}>
              <strong>{step.title}</strong>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      ) : null}
      {slide.bullets?.length ? (
        <ul>
          {slide.bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {slide.cta ? (
        <AppLink className="btn btn-gold" href={slide.cta.href}>
          {slide.cta.label}
        </AppLink>
      ) : null}
    </article>
  );
}
