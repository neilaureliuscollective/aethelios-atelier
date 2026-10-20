"use client";

import { useState } from "react";
import { IllustrativeBadge } from "@/components/marketing/ExampleBusinesses";
import styles from "@/components/marketing/customDemos.module.css";

type Topic = {
  id: string;
  title: string;
  misses: number;
};

const SYNTHETIC: Topic[] = [
  { id: "s1", title: "Present tense irregulars", misses: 2 },
  { id: "s2", title: "Listening: short dialogues", misses: 1 },
  { id: "s3", title: "Vocabulary: travel", misses: 0 }
];

export function StudyOrganizer({ compact = false }: { compact?: boolean }) {
  const [topics, setTopics] = useState(SYNTHETIC);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const review = topics.find((topic) => topic.id === reviewing) ?? topics.find((topic) => topic.misses > 0);

  function logMiss(id: string) {
    setTopics((current) =>
      current.map((topic) => (topic.id === id ? { ...topic, misses: topic.misses + 1 } : topic))
    );
  }

  function clearMiss(id: string) {
    setTopics((current) => current.map((topic) => (topic.id === id ? { ...topic, misses: 0 } : topic)));
    if (reviewing === id) setReviewing(null);
  }

  return (
    <div className={`${styles.panel} ${styles.study}`}>
      <IllustrativeBadge />
      <header className={styles.header}>
        <strong className={styles.word}>Study list</strong>
      </header>
      <div className={styles.body}>
        {topics.map((topic) => (
          <article className={styles.card} key={topic.id}>
            <p className={styles.meta}>{topic.misses ? `${topic.misses} practice misses` : "Ready"}</p>
            <strong>{topic.title}</strong>
            {!compact ? (
              <div className={styles.actions}>
                <button className={styles.action} type="button" onClick={() => logMiss(topic.id)}>
                  Log a miss
                </button>
                <button className={styles.action} type="button" onClick={() => setReviewing(topic.id)}>
                  Review
                </button>
              </div>
            ) : null}
          </article>
        ))}
        {!compact && review ? (
          <article className={styles.card}>
            <p className={styles.meta}>Review pass</p>
            <strong>{review.title}</strong>
            <p>
              {review.misses
                ? `This example asks you to try the missed item again. ${review.misses} logged.`
                : "Nothing is waiting on this topic."}
            </p>
            <button className={styles.action} type="button" onClick={() => clearMiss(review.id)}>
              Mark reviewed
            </button>
          </article>
        ) : null}
      </div>
      <p className={styles.note}>Illustrative topics only. Not a school account or live tutor.</p>
    </div>
  );
}
