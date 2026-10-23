"use client";

import { DEFAULT_THEME } from "@/lib/concierge/slideField";
import type { PresentationDocument, PresentationSlide, SitePreview } from "@/lib/concierge/types";
import { ConciergeHandoff } from "./ConciergeHandoff";
import { SitePreviewFrame } from "./SitePreviewFrame";
import { SlideView } from "./SlideView";
import styles from "./concierge.module.css";

const COMPOSING: PresentationSlide = {
  id: "slide_composing",
  layout: "hero",
  kicker: "Aethelios · document",
  headline: "A direction is being written.",
  subhead: "Keep talking. This becomes a document you can send to Neil.",
  enter: "fade",
  emphasis: "headline"
};

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
  const slides = document?.slides.length ? document.slides : [COMPOSING];
  const safeIndex = Math.min(Math.max(index, 0), Math.max(slides.length - 1, 0));
  const theme = document?.theme ?? DEFAULT_THEME;
  return (
    <div className={styles.canvasWrap}>
      <div className={styles.canvasHead}>
        <div>
          <p className={styles.kicker}>Live document</p>
          <h2>{document?.title ?? "Your direction"}</h2>
          <p>
            {document?.thesis ??
              "When you describe the business, Aethelios writes a document here. You can send it to Neil."}
          </p>
        </div>
        <ConciergeHandoff />
      </div>
      <div className={styles.stageFrame} data-theme={theme.mood} data-preview={preview ? "site" : "brief"}>
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
                onClick={() => onSelect(slideIndex)}
              >
                <span>{item.kicker ?? item.layout}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
