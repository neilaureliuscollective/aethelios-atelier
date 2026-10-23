import { aetheliosComposeReply } from "@/lib/aethelios/persona";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { extractBusinessSketch, sketchLabel } from "./extract";
import { isRevisionRequest } from "./intent";
import type { BusinessKind, BusinessSketch, PresentationDocument, PresentationSlide, PresentationTheme } from "./types";

function idFor(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function qualityLine(sketch: BusinessSketch, fallback: string) {
  if (!sketch.qualities.length) return fallback;
  return `${fallback} You asked for something ${sketch.qualities.slice(0, 2).join(" and ")}.`;
}

export function atelierDocumentTheme(): PresentationTheme {
  return { mood: "obsidian", accent: "gold", density: "editorial" };
}

const KIND_COPY: Record<
  BusinessKind,
  { subject: string; promise: string; craft: string; rooms: [string, string]; path: string }
> = {
  barber: {
    subject: "a barbershop with a considered chair",
    promise: "The site should feel as precise as the cut — quiet, local, and easy to book.",
    craft: "Keep the booking system you already use. The website becomes the presence in front of it.",
    rooms: ["Chair and craft", "Visit without friction"],
    path: "A specialist website brief can start from this sketch."
  },
  salon: {
    subject: "a salon with its own atmosphere",
    promise: "The digital rooms should hold the same calm as the floor — not a template marketplace.",
    craft: "Photography, hours, and the booking tool you already trust stay distinct from invented offers.",
    rooms: ["Atmosphere and work", "A clear next visit"],
    path: "A salon brief can carry this direction into founder review."
  },
  studio: {
    subject: "a studio that already has a point of view",
    promise: "The site should read like the work: measured, specific, and hard to confuse with a catalog.",
    craft: "Selected work, a living brief, and a request path — not a stock portfolio.",
    rooms: ["The work", "How a commission begins"],
    path: "Discover can turn this sketch into a direction Neil can review."
  },
  shop: {
    subject: "a shop with a particular floor",
    promise: "The storefront online should feel like walking in — not like a generic retail theme.",
    craft: "Hours, place, and a next step stay honest. Inventory claims stay out until you write them.",
    rooms: ["The floor", "How to visit"],
    path: "A project brief can hold the facts you already know."
  },
  clinic: {
    subject: "a clinic that needs a calm first impression",
    promise: "The first screen should lower the pulse: clear, private, and easy to continue.",
    craft: "No invented outcomes. Hours, place, and a request path are enough to begin.",
    rooms: ["Arrival", "What happens next"],
    path: "A brief can collect what is already true before anyone designs a page."
  },
  restaurant: {
    subject: "a dining room with its own temperature",
    promise: "The site should taste like the room — paced, local, and unwilling to shout.",
    craft: "Menu claims stay yours. The sketch holds atmosphere, place, and how to inquire.",
    rooms: ["The room", "A reservation path later"],
    path: "Write the facts into a brief. Neil reviews what can be built."
  },
  practice: {
    subject: "a practice that has to feel trustworthy on arrival",
    promise: "The first impression should be exact: who you are, who you serve, how to begin.",
    craft: "No invented credentials. The sketch stays a direction, not a brochure of results.",
    rooms: ["The practice", "How someone starts"],
    path: "A living brief can keep statements and unknowns separate."
  },
  service: {
    subject: "a service business that needs a clearer public face",
    promise: "The site should say what you do, who it is for, and how a request begins.",
    craft: "Scope stays unconfirmed until founder review. This is a sketch of the presence, not a quote.",
    rooms: ["The work", "The request"],
    path: "Start a brief from this conversation when you are ready."
  },
  unknown: {
    subject: "a business with its own point of view",
    promise: "A digital presence that says exactly what you do, who it is for, and how to begin — in your voice, not a template's.",
    craft: "Aethelios writes from what you said and leaves room for what only you know. Neil fills the gaps with you.",
    rooms: ["What you do", "How someone begins"],
    path: "Send this to Neil and he will take it from here."
  }
};

const GENERIC_SOURCE = /^write a first document from this conversation\.?$/i;

/** The visitor's own words, trimmed to a quotable length. */
function visitorWords(raw: string) {
  const text = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !GENERIC_SOURCE.test(line))
    .join(" ");
  if (text.length < 18) return null;
  if (text.length <= 260) return text;
  const cut = text.slice(0, 260);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

function slidesFor(sketch: BusinessSketch): PresentationSlide[] {
  const copy = KIND_COPY[sketch.kind];
  const label = sketchLabel(sketch);
  const place = sketch.place ? ` in ${sketch.place}` : "";
  const words = visitorWords(sketch.raw);
  const headline = sketch.name ?? (sketch.kind === "unknown" ? "Your business, considered." : label.replace(/^this /, ""));
  return [
    {
      id: "slide_hero",
      layout: "hero",
      kicker: `${INTELLIGENCE_DISPLAY_NAME} · direction`,
      headline: headline.slice(0, 1).toUpperCase() + headline.slice(1),
      subhead: qualityLine(sketch, `For ${copy.subject}${place}.`),
      body: copy.promise,
      enter: "rise",
      emphasis: "headline"
    },
    {
      id: "slide_words",
      layout: "quote",
      kicker: "In your words",
      quote: words ?? "Add a sentence about the business and it will appear here, in your own words.",
      attribution: words ? "You, to Aethelios" : INTELLIGENCE_DISPLAY_NAME,
      enter: "fade",
      emphasis: "quote"
    },
    {
      id: "slide_manifesto",
      layout: "manifesto",
      kicker: "Point of view",
      headline: "A presence that matches the work.",
      body: copy.craft,
      bullets: [
        "Built around the booking, payment, and tools you already use.",
        "Your facts and your voice — nothing invented.",
        "Reviewed personally by Neil Stutes, the founder."
      ],
      enter: "fade",
      emphasis: "none"
    },
    {
      id: "slide_split",
      layout: "split",
      kicker: "What the site holds",
      headline: "Two rooms the first site has to get right.",
      columns: [
        { title: copy.rooms[0], body: "The craft, the atmosphere, and the words you already use." },
        { title: copy.rooms[1], body: "One clear next step, so a visitor knows exactly how to begin." }
      ],
      enter: "split",
      emphasis: "none"
    },
    {
      id: "slide_path",
      layout: "path",
      kicker: "What happens next",
      headline: copy.path,
      steps: [
        { title: "Send it to Neil", body: "Your name and email are all it takes. No account, no payment." },
        { title: "Neil reviews it", body: "He reads the direction and this conversation personally." },
        { title: "A proposal, if it fits", body: "Scope, price, and timing come from Neil — nothing is assumed." }
      ],
      enter: "fade",
      emphasis: "none"
    },
    {
      id: "slide_next",
      layout: "next",
      kicker: "Ready when you are",
      headline: "Send this direction to Neil.",
      body: `Keep talking and ${INTELLIGENCE_DISPLAY_NAME} will keep refining it, or send it now from the bar below. Neil Stutes reviews every commission he accepts.`,
      enter: "rise",
      emphasis: "none"
    }
  ];
}

export function composeReply(sketch: BusinessSketch, presented: boolean) {
  return aetheliosComposeReply(sketchLabel(sketch), presented);
}

export function composePresentation(
  message: string,
  existing?: PresentationDocument | null
): PresentationDocument {
  const sketch = extractBusinessSketch(
    [existing?.thesis, existing?.title, message].filter(Boolean).join("\n")
  );
  const theme = atelierDocumentTheme();
  const slides = slidesFor(sketch);
  if (isRevisionRequest(message, Boolean(existing)) && existing) {
    return {
      ...existing,
      theme,
      thesis: qualityLine(sketch, existing.thesis),
      slides: existing.slides.map((slide, index) => ({
        ...slide,
        ...slides[index],
        id: slide.id
      }))
    };
  }
  return {
    version: 1,
    id: existing?.id ?? idFor("canvas"),
    title: sketch.name
      ? `${sketch.name} · direction`
      : sketch.kind === "unknown" && !sketch.place
        ? "Your direction"
        : `${sketchLabel(sketch).replace(/^this /, "Your ")} · direction`,
    thesis: qualityLine(sketch, KIND_COPY[sketch.kind].promise),
    theme,
    slides
  };
}
