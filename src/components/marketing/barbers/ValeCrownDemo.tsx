"use client";

import { DEMO_VIEW_LABELS, DEMO_VIEWS, VALE_CROWN_DEMO, type DemoView } from "@/lib/offers/demo";
import styles from "./valeCrown.module.css";

export function ValeCrownDemo({
  view,
  onView,
  density = "desktop",
  compact = false
}: {
  view: DemoView;
  onView: (view: DemoView) => void;
  density?: "desktop" | "phone";
  compact?: boolean;
}) {
  return (
    <div
      className={`${styles.site} ${density === "phone" ? styles.phone : styles.desktop}`}
      data-demo="vale-crown"
      data-demo-view={view}
    >
      <p className={styles.badge}>Fictional demonstration · not a completed commission</p>
      <header className={styles.header}>
        <strong className={styles.word}>{VALE_CROWN_DEMO.name}</strong>
        <div className={styles.nav} role="navigation" aria-label="Demonstration sections">
          {DEMO_VIEWS.map((item) => (
            <button
              key={item}
              type="button"
              aria-current={view === item ? "page" : undefined}
              onClick={() => onView(item)}
            >
              {DEMO_VIEW_LABELS[item]}
            </button>
          ))}
        </div>
        <button className={styles.bookChip} type="button" onClick={() => onView("book")}>
          Book
        </button>
      </header>
      <div className={styles.body}>
        {view === "story" ? <Story compact={compact} onView={onView} /> : null}
        {view === "gallery" ? <Gallery /> : null}
        {view === "services" ? <Services onView={onView} /> : null}
        {view === "visit" ? <Visit /> : null}
        {view === "book" ? <Book /> : null}
      </div>
    </div>
  );
}

function Story({ compact, onView }: { compact: boolean; onView: (view: DemoView) => void }) {
  return (
    <section className={styles.hero}>
      <div>
        <p className={styles.kicker}>{VALE_CROWN_DEMO.kicker}</p>
        <h3>{VALE_CROWN_DEMO.tagline}</h3>
        <p className={styles.lede}>{VALE_CROWN_DEMO.story}</p>
        {compact ? null : <p className={styles.lede}>{VALE_CROWN_DEMO.team}</p>}
        <button className={styles.action} type="button" onClick={() => onView("gallery")}>
          View the work
        </button>
      </div>
      <figure className={styles.figure}>
        <img src={VALE_CROWN_DEMO.gallery[0].src} alt={VALE_CROWN_DEMO.gallery[0].alt} width={800} height={520} />
      </figure>
    </section>
  );
}

function Gallery() {
  return (
    <section className={styles.panel}>
      <p className={styles.kicker}>The work</p>
      <h3>A gallery of atmosphere, not invented results.</h3>
      <div className={styles.gallery}>
        {VALE_CROWN_DEMO.gallery.map((item) => (
          <figure key={item.src}>
            <img src={item.src} alt={item.alt} width={400} height={280} />
          </figure>
        ))}
      </div>
      <p className={styles.note}>Sample interiors only. No client faces, reviews, or claimed before-and-afters.</p>
    </section>
  );
}

function Services({ onView }: { onView: (view: DemoView) => void }) {
  return (
    <section className={styles.panel}>
      <p className={styles.kicker}>Services</p>
      <h3>What the chair is for.</h3>
      <ul className={styles.list}>
        {VALE_CROWN_DEMO.services.map((item) => (
          <li key={item.name}>
            <strong>{item.name}</strong>
            <span>{item.note}</span>
          </li>
        ))}
      </ul>
      <button className={styles.action} type="button" onClick={() => onView("book")}>
        Continue to booking
      </button>
    </section>
  );
}

function Visit() {
  return (
    <section className={styles.panel}>
      <p className={styles.kicker}>Visit</p>
      <h3>
        {VALE_CROWN_DEMO.location}
        <br />
        {VALE_CROWN_DEMO.hours}
      </h3>
      <p className={styles.lede}>{VALE_CROWN_DEMO.visit.address}</p>
      <p className={styles.lede}>{VALE_CROWN_DEMO.visit.hours}</p>
      <p className={styles.note}>{VALE_CROWN_DEMO.visit.note}</p>
    </section>
  );
}

function Book() {
  return (
    <section className={`${styles.panel} ${styles.handoff}`}>
      <p className={styles.kicker}>{VALE_CROWN_DEMO.booking.provider}</p>
      <h3>Book with the system already in use.</h3>
      <p className={styles.lede}>{VALE_CROWN_DEMO.booking.explanation}</p>
      <p className={styles.note}>
        This control explains the handoff. It does not invent available times, confirmations, or a
        customer account.
      </p>
    </section>
  );
}
