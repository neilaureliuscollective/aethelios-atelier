"use client";

import { useState } from "react";
import { IllustrativeBadge } from "@/components/marketing/ExampleBusinesses";
import styles from "@/components/marketing/customDemos.module.css";

type Item = {
  id: string;
  title: string;
  today: "open" | "done" | "skipped";
};

const SYNTHETIC: Item[] = [
  { id: "p1", title: "Write for twenty minutes", today: "open" },
  { id: "p2", title: "Walk after lunch", today: "done" },
  { id: "p3", title: "Put the kettle list away", today: "open" }
];

export function PersonalTracker({ compact = false }: { compact?: boolean }) {
  const [items, setItems] = useState(SYNTHETIC);

  function setToday(id: string, today: Item["today"]) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, today } : item)));
  }

  const remaining = items.filter((item) => item.today === "open").length;

  return (
    <div className={`${styles.panel} ${styles.personal}`}>
      <IllustrativeBadge />
      <header className={styles.header}>
        <strong className={styles.word}>Today</strong>
        <span className={styles.meta}>{remaining} still open</span>
      </header>
      <div className={styles.body}>
        {items.map((item) => (
          <article className={styles.card} key={item.id}>
            <p className={styles.meta}>{item.today}</p>
            <strong>{item.title}</strong>
            {!compact ? (
              <div className={styles.actions}>
                <button
                  className={styles.action}
                  type="button"
                  aria-pressed={item.today === "done"}
                  onClick={() => setToday(item.id, "done")}
                >
                  Done
                </button>
                <button
                  className={styles.action}
                  type="button"
                  aria-pressed={item.today === "skipped"}
                  onClick={() => setToday(item.id, "skipped")}
                >
                  Skip
                </button>
                <button
                  className={styles.action}
                  type="button"
                  aria-pressed={item.today === "open"}
                  onClick={() => setToday(item.id, "open")}
                >
                  Open
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <p className={styles.note}>Synthetic commitments only. Not a health or finance service.</p>
    </div>
  );
}
