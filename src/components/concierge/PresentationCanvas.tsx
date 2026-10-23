"use client";

import type { PresentationDocument } from "@/lib/concierge/types";
import { SlideView } from "./SlideView";
import styles from "./concierge.module.css";

export function PresentationCanvas({
  document,
  index,
  onSelect
}: {
  document: PresentationDocument | null;
  index: number;
  onSelect: (index: number) => void;
}) {
  const safeIndex = document ? Math.min(Math.max(index, 0), Math.max(document.slides.length - 1, 0)) : 0;
  const slide = document?.slides[safeIndex];
  return (
    <div className={styles.canvasWrap}>
      <div className={styles.canvasHead}>
        <div>
          <p className={styles.kicker}>Live canvas</p>
          <h2>{document?.title ?? "Waiting for a business to describe"}</h2>
          <p>{document?.thesis ?? "When you talk about the work, Aethelios composes a presentation here."}</p>
        </div>
      </div>
      <div className={styles.stageFrame}>
        <div className={styles.stageScale}>
          {slide && document ? <SlideView slide={slide} theme={document.theme} /> : <div className={styles.slide} />}
        </div>
        {document?.slides.length ? (
          <div className={styles.film} role="tablist" aria-label="Presentation slides">
            {document.slides.map((item, slideIndex) => (
              <button
                key={item.id}
                className={styles.thumb}
                type="button"
                role="tab"
                data-active={slideIndex === safeIndex}
                aria-selected={slideIndex === safeIndex}
                onClick={() => onSelect(slideIndex)}
              >
                {item.kicker ?? item.layout}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
