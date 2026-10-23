import type { ConciergePageContext, ConciergeSuggestion } from "@/lib/concierge/types";

const PAGES: Record<string, { title: string; summary: string; awareness: string; starters: ConciergeSuggestion[] }> = {
  "/": {
    title: "Home",
    summary: "The public entrance. Founder-led websites, custom platforms, storefronts, and digital infrastructure.",
    awareness: "You are on the Atelier home page.",
    starters: [
      { id: "website", label: "I need a better website" },
      { id: "presence", label: "I want a stronger digital presence" },
      { id: "explore", label: "I'm not sure what my business needs" },
      { id: "handoff", label: "I want to discuss a project with Neil" }
    ]
  },
  "/services": {
    title: "Services",
    summary: "Four commission paths: branded websites, custom apps and platforms, e-commerce storefronts, and exploratory digital infrastructure.",
    awareness: "You are viewing the services page.",
    starters: [
      { id: "website", label: "Help me choose a website direction" },
      { id: "application", label: "I have an idea for a custom application" },
      { id: "ecommerce", label: "I need a storefront" },
      { id: "infrastructure", label: "I need to connect business systems" }
    ]
  },
  "/services/barbers-salons": {
    title: "Barbers and salons",
    summary: "A focused website offer for barbers and salons. Fix It Shop is the verified public example. Atelier does not become the booking product.",
    awareness: "You are on the barbers and salons service page.",
    starters: [
      { id: "website", label: "I run a shop that needs a better site" },
      { id: "proof", label: "What is Fix It Shop?" },
      { id: "handoff", label: "Start a shop website brief" }
    ]
  },
  "/approach": {
    title: "Approach",
    summary: "Discover a direction, shape a living brief, send a request, then Neil reviews. Sending is never a booking.",
    awareness: "You are reading how Atelier works.",
    starters: [
      { id: "process", label: "Walk me through the process" },
      { id: "explore", label: "I know I have a problem, not the service" },
      { id: "handoff", label: "I want Neil to review a project" }
    ]
  },
  "/about": {
    title: "About",
    summary: "Aethelios Atelier is the practice of Neil Stutes. One accountable founder. Aethelios is the in-app intelligence, not a human employee.",
    awareness: "You are on the about page.",
    starters: [
      { id: "about", label: "What does Atelier actually do?" },
      { id: "handoff", label: "How do I reach Neil?" }
    ]
  },
  "/pricing": {
    title: "Pricing",
    summary: "Plan prices, when shown, describe a studio relationship and are not finalized. They are not a project quote. Payments are not collected here.",
    awareness: "You are on the pricing page.",
    starters: [
      { id: "pricing", label: "How does investment actually work?" },
      { id: "explore", label: "Help me understand what I would be asking for" }
    ]
  },
  "/discover": {
    title: "Discover",
    summary: "Curated, on-device directions. They are not live model output. You can explore without sending anything.",
    awareness: "You are in discovery.",
    starters: [
      { id: "explore", label: "Help me name what I actually need" },
      { id: "website", label: "I think I need a website" },
      { id: "application", label: "I think I need a tool" }
    ]
  },
  "/inquire": {
    title: "Inquire",
    summary: "A short request to Neil. Consent is required. This is not a booking or payment.",
    awareness: "You are on the inquiry page.",
    starters: [
      { id: "contact", label: "Help me describe the project first" },
      { id: "explore", label: "I'm not sure what to write" }
    ]
  },
  "/custom-projects": {
    title: "Other projects",
    summary: "Non-core custom digital projects can be requested through the same path when they are a fit. Business clients remain the central audience.",
    awareness: "You are viewing other project examples.",
    starters: [
      { id: "application", label: "I have a specific tool in mind" },
      { id: "explore", label: "Is this the right path?" }
    ]
  },
  "/concierge": {
    title: "Aethelios",
    summary: "The dedicated concierge view. Same conversation as the site-wide panel.",
    awareness: "You opened the dedicated Aethelios view.",
    starters: [
      { id: "website", label: "I need a better website" },
      { id: "presence", label: "I want to improve our digital presence" },
      { id: "application", label: "I have an idea for a custom application" },
      { id: "infrastructure", label: "I need to connect or automate systems" },
      { id: "explore", label: "I'm exploring what my business actually needs" },
      { id: "handoff", label: "I want to discuss a project with the founder" }
    ]
  }
};

const DEFAULT_STARTERS: ConciergeSuggestion[] = [
  { id: "website", label: "I need a better website" },
  { id: "explore", label: "I'm not sure what I need" },
  { id: "handoff", label: "I want to talk with Neil" }
];

export function normalizeConciergePath(path: string | null | undefined): string {
  if (!path) return "/";
  const clean = path.split("?")[0]?.split("#")[0] || "/";
  if (clean.length > 1 && clean.endsWith("/")) return clean.slice(0, -1);
  return clean || "/";
}

export function conciergePageContext(path: string | null | undefined): ConciergePageContext {
  const normalized = normalizeConciergePath(path);
  const match = PAGES[normalized];
  if (match) {
    return {
      path: normalized,
      title: match.title,
      summary: match.summary,
      awareness: match.awareness
    };
  }
  return {
    path: normalized,
    title: "Aethelios Atelier",
    summary: "A founder-led digital studio. Aethelios can explain services, help name the problem, and prepare a request for Neil.",
    awareness: `You are on ${normalized}.`
  };
}

export function startersForPath(path: string | null | undefined): ConciergeSuggestion[] {
  const normalized = normalizeConciergePath(path);
  return PAGES[normalized]?.starters ?? DEFAULT_STARTERS;
}

export function conciergeVisibleOnPath(path: string | null | undefined): boolean {
  const normalized = normalizeConciergePath(path);
  if (
    normalized.startsWith("/companion") ||
    normalized.startsWith("/founder") ||
    normalized.startsWith("/workspace") ||
    normalized.startsWith("/project") ||
    normalized.startsWith("/account") ||
    normalized.startsWith("/offline")
  ) {
    return false;
  }
  return true;
}

export function conciergeInlineOnPath(path: string | null | undefined): boolean {
  return normalizeConciergePath(path) === "/concierge";
}
