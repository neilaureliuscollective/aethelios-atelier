"use client";

import { useState } from "react";
import { DEFAULT_THEME } from "@/lib/concierge/slideField";
import type { PresentationDocument, PresentationSlide, SitePreview } from "@/lib/concierge/types";
import { ConciergeHandoff } from "./ConciergeHandoff";
import { SitePreviewFrame } from "./SitePreviewFrame";
import { SlideView } from "./SlideView";
import styles from "./concierge.module.css";

const COMPOSING: PresentationSlide = {
  id: "slide_composing",
  layout: "hero",
  kicker: "Aethelios · direction",
  headline: "Your direction is being written.",
  subhead: "Each section appears as it is composed. When it is ready, send it to Neil from the bar below.",
  enter: "fade",
  emphasis: "headline"
};

const STEPS = ["Talk", "Review", "Send"] as const;

export function PresentationCanvas({
  document,
  preview,
  index,
  onSelect
}: {
  document: PresentationDocument | null;
  preview?: SitePreview | null;
  index: number;
  onSelect: (index: number) => void;
}) {
  const [sent, setSent] = useState(false);
  const slides = document?.slides.length ? document.slides : [COMPOSING];
  const safeIndex = Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0));
  const theme = document?.theme ?? DEFAULT_THEME;
  const step = sent ? 3 : document?.slides.length ? 2 : 1;

  function jumpTo(slideIndex: number, id: string) {
    onSelect(slideIndex);
    globalThis.document?.getElementById(`document-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className={styles.canvasWrap} id="live-document" data-step={step}>
      <div className={styles.canvasHead}>
        <ol className={styles.steps} aria-label="Progress">
          {STEPS.map((label, stepIndex) => {
            const number = stepIndex + 1;
            const state = number < step ? "done" : number === step ? "current" : "next";
            return (
              <li key={label} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                <span className={styles.stepMark}>{state === "done" ? "✓" : `0${number}`}</span>
                {label}
              </li>
            );
          })}
        </ol>
        <p className={styles.kicker}>Live document</p>
        <h2>{document?.title ?? "Your direction"}</h2>
        {document?.thesis ? <p>{document.thesis}</p> : null}
      </div>
      <div
        className={styles.stageFrame}
        data-theme={theme.mood}
        data-preview={preview ? "site" : "brief"}
        data-writing={document?.slides.length ? undefined : "true"}
      >
        {!preview && document?.slides.length ? (
          <div className={styles.film} role="tablist" aria-label="Document sections">
            {document.slides.map((item, slideIndex) => (
              <button
                key={item.id}
                className={styles.thumb}
                type="button"
                role="tab"
                data-active={slideIndex === safeIndex}
                data-layout={item.layout}
                aria-selected={slideIndex === safeIndex}
                onClick={() => jumpTo(slideIndex, item.id)}
              >
                <span>{item.kicker ?? item.layout}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className={styles.stageScale}>
          {preview ? (
            <SitePreviewFrame preview={preview} />
          ) : (
            <div className={styles.brief} data-document="atelier-brief">
              {slides.map((slide, slideIndex) => (
                <div
                  key={slide.id}
                  className={styles.briefSection}
                  data-active={slideIndex === safeIndex}
                  id={`document-section-${slide.id}`}
                >
                  <SlideView slide={slide} theme={theme} composing={!document} />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={styles.sendDock}>
          <ConciergeHandoff onSent={() => setSent(true)} />
        </div>
      </div>
    </div>
  );
}
