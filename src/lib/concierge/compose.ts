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

function themeFor(sketch: BusinessSketch, instruction: string): PresentationTheme {
  const text = `${sketch.raw} ${instruction}`.toLowerCase();
  if (/\b(luxury|gold|editorial|quiet)\b/.test(text)) {
    return { mood: "obsidian", accent: "gold", density: "editorial" };
  }
  if (/\b(warm|ember|hearth)\b/.test(text)) {
    return { mood: "ember", accent: "gold", density: "cinematic" };
  }
  if (/\b(modern|emerald|signal)\b/.test(text)) {
    return { mood: "aurora", accent: "emerald", density: "cinematic" };
  }
  if (sketch.kind === "salon" || sketch.kind === "studio") {
    return { mood: "obsidian", accent: "gold", density: "editorial" };
  }
  if (sketch.kind === "barber" || sketch.kind === "shop") {
    return { mood: "ember", accent: "gold", density: "cinematic" };
  }
  return { mood: "obsidian", accent: "emerald", density: "cinematic" };
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
    subject: "a business that is still being named",
    promise: "We can still compose a direction from what you have said, and leave blanks where facts are missing.",
    craft: "Aethelios will not invent prices, clients, or completed work.",
    rooms: ["What is known", "What still needs you"],
    path: "Keep talking, or move the sketch into Discover or a brief."
  }
};

function slidesFor(sketch: BusinessSketch): PresentationSlide[] {
  const copy = KIND_COPY[sketch.kind];
  const label = sketchLabel(sketch);
  const place = sketch.place ? ` in ${sketch.place}` : "";
  return [
    {
      id: "slide_hero",
      layout: "hero",
      kicker: `${INTELLIGENCE_DISPLAY_NAME} · live sketch`,
      headline: sketch.name ? sketch.name : label.replace(/^this /, ""),
      subhead: qualityLine(sketch, `${copy.subject}${place}.`),
      body: copy.promise,
      enter: "rise",
      emphasis: "headline"
    },
    {
      id: "slide_manifesto",
      layout: "manifesto",
      kicker: "Point of view",
      headline: "A presence that matches the work.",
      body: copy.craft,
      bullets: [
        "Confirmed facts stay labeled as facts.",
        "Suggestions stay suggestions.",
        "Nothing here is a quote, booking, or finished website."
      ],
      enter: "fade",
      emphasis: "none"
    },
    {
      id: "slide_split",
      layout: "split",
      kicker: "Two rooms",
      headline: "What the first site has to hold.",
      columns: [
        { title: copy.rooms[0], body: "The craft, the atmosphere, and the words you already use." },
        { title: copy.rooms[1], body: "A next step that is a request — not an invented checkout." }
      ],
      enter: "split",
      emphasis: "none"
    },
    {
      id: "slide_stats",
      layout: "stats",
      kicker: "How this conversation is held",
      headline: "A sketch has a shape before it has a contract.",
      stats: [
        { value: "01", label: "Listen to the business you actually run" },
        { value: "02", label: "Compose a direction you can see" },
        { value: "03", label: "Move it into a brief Neil can review" }
      ],
      body: "These are process marks, not client results.",
      enter: "rise",
      emphasis: "stat"
    },
    {
      id: "slide_path",
      layout: "path",
      kicker: "From this room",
      headline: copy.path,
      steps: [
        { title: "Stay here", body: "Keep talking. The canvas revises as you add facts." },
        { title: "Discover a direction", body: "Turn the sketch into a labeled exploration." },
        { title: "Begin a brief", body: "Write what is true. Sending is a request, not a booking." }
      ],
      enter: "fade",
      emphasis: "none"
    },
    {
      id: "slide_next",
      layout: "next",
      kicker: "Next",
      headline: "When you want this to leave the sketch.",
      body: `${INTELLIGENCE_DISPLAY_NAME} can keep composing here. Neil Stutes reviews every commission he accepts.`,
      cta: { label: "Begin a brief", href: "/project" },
      enter: "rise",
      emphasis: "none"
    }
  ];
}

export function composeReply(sketch: BusinessSketch, presented: boolean) {
  const label = sketchLabel(sketch);
  if (!presented) {
    return `I can keep this in conversation. If you describe the business — what you run, where, and what the public face should feel like — I will open a presentation beside us and compose it live.`;
  }
  return `I am composing a presentation for ${label}. It is a visual sketch from what you said, not a finished website or a quote. Keep talking and I will revise the canvas.`;
}

export function composePresentation(
  message: string,
  existing?: PresentationDocument | null
): PresentationDocument {
  const sketch = extractBusinessSketch(
    [existing?.thesis, existing?.title, message].filter(Boolean).join("\n")
  );
  const theme = themeFor(sketch, message);
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
    title: sketch.name ? `${sketch.name} · direction` : `${sketchLabel(sketch)} · direction`,
    thesis: qualityLine(sketch, KIND_COPY[sketch.kind].promise),
    theme,
    slides
  };
}
