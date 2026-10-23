import { presentationDraftSchema, slideSchema } from "./schema";
import type { PartialPresentation, PresentationDocument, PresentationSlide } from "./types";
import { containsForbiddenPayload } from "./contract";

function slideId(index: number, fallback?: string) {
  return fallback && fallback.length <= 40 ? fallback : `slide_${index + 1}`;
}

type PartialSlide = NonNullable<PartialPresentation["slides"]>[number];

export function normalizeSlide(partial: PartialSlide | undefined, index: number): PresentationSlide | null {
  if (!partial) return null;
  const candidate = {
    id: slideId(index, partial.id),
    layout: partial.layout ?? "manifesto",
    kicker: partial.kicker,
    headline: partial.headline,
    subhead: partial.subhead,
    body: partial.body,
    bullets: partial.bullets,
    columns: partial.columns,
    stats: partial.stats,
    steps: partial.steps,
    quote: partial.quote,
    attribution: partial.attribution,
    cta: partial.cta,
    enter: partial.enter ?? "rise",
    emphasis: partial.emphasis ?? "none"
  };
  const parsed = slideSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function mergePresentation(
  current: PresentationDocument | null,
  next: PartialPresentation
): PresentationDocument | null {
  if (containsForbiddenPayload(next)) return current;
  const slides = (next.slides ?? []).map((slide, index) => {
    const existing = current?.slides.find((item) => item.id === slide.id) ?? current?.slides[index];
    return normalizeSlide({ ...existing, ...slide }, index);
  }).filter((slide): slide is PresentationSlide => Boolean(slide));
  const document = {
    version: 1 as const,
    id: next.id ?? current?.id ?? "canvas_live",
    title: next.title ?? current?.title ?? "Aethelios sketch",
    thesis: next.thesis ?? current?.thesis ?? "A working sketch from the conversation.",
    theme: {
      mood: next.theme?.mood ?? current?.theme.mood ?? "obsidian",
      accent: next.theme?.accent ?? current?.theme.accent ?? "gold",
      density: next.theme?.density ?? current?.theme.density ?? "cinematic"
    },
    slides: slides.length ? slides : current?.slides ?? []
  };
  const parsed = presentationDraftSchema.safeParse(document);
  if (!parsed.success || containsForbiddenPayload(parsed.data)) return current;
  return parsed.data;
}

export function applySlide(current: PresentationDocument | null, slide: PresentationSlide): PresentationDocument | null {
  if (!current) {
    return mergePresentation(null, {
      version: 1,
      id: "canvas_live",
      title: "Aethelios sketch",
      thesis: "A working sketch from the conversation.",
      theme: { mood: "obsidian", accent: "gold", density: "cinematic" },
      slides: [slide]
    });
  }
  const index = current.slides.findIndex((item) => item.id === slide.id);
  const slides = [...current.slides];
  if (index >= 0) slides[index] = slide;
  else slides.push(slide);
  return mergePresentation(current, { ...current, slides });
}
