import type { BusinessKind, BusinessSketch } from "./types";

const KIND_RULES: Array<{ kind: Exclude<BusinessKind, "unknown">; re: RegExp }> = [
  { kind: "barber", re: /\b(barber|barbershop|barber shop|fade|clipper)\b/i },
  { kind: "salon", re: /\b(salon|colorist|stylist|blowout)\b/i },
  { kind: "studio", re: /\b(studio|atelier|workshop|custom home|architecture)\b/i },
  { kind: "shop", re: /\b(shop|storefront|boutique|retail)\b/i },
  { kind: "clinic", re: /\b(clinic|wellness|therapy)\b/i },
  { kind: "restaurant", re: /\b(restaurant|cafe|kitchen|dining)\b/i },
  { kind: "practice", re: /\b(practice|firm|counsel|advisor)\b/i },
  { kind: "service", re: /\b(service|trade|craft)\b/i }
];

const QUALITY_WORDS = [
  "quiet",
  "considered",
  "luxury",
  "warm",
  "modern",
  "precise",
  "editorial",
  "intimate",
  "refined",
  "bold",
  "calm"
];

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function extractBusinessSketch(message: string): BusinessSketch {
  const raw = message.trim();
  const kind = KIND_RULES.find((rule) => rule.re.test(raw))?.kind ?? "unknown";
  const named =
    raw.match(/(?:called|named)\s+["“]?([A-Za-z][A-Za-z0-9'&-]{1,32})/i) ??
    raw.match(/\b(?:i(?:'| a)?m|we(?:'| a)?re)\s+([A-Z][A-Za-z0-9'&-]{1,32})\b/);
  const place = raw.match(/\bin\s+([A-Z][A-Za-z.'-]{1,32})\b/);
  const qualities = QUALITY_WORDS.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(raw));
  const name = named?.[1]?.replace(/[.!?].*$/, "").trim();
  return {
    name: name && name.length > 1 ? titleCase(name) : undefined,
    kind,
    place: place?.[1]?.replace(/[.!?].*$/, "").trim(),
    qualities,
    raw
  };
}

export function sketchLabel(sketch: BusinessSketch) {
  const kindLabel: Record<BusinessKind, string> = {
    barber: "barbershop",
    salon: "salon",
    studio: "studio",
    shop: "shop",
    clinic: "clinic",
    restaurant: "restaurant",
    practice: "practice",
    service: "service business",
    unknown: "business"
  };
  const noun = sketch.name ?? `this ${kindLabel[sketch.kind]}`;
  return sketch.place ? `${noun} in ${sketch.place}` : noun;
}
