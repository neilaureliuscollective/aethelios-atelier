import { conciergePageContext, startersForPath } from "@/lib/concierge/pages";
import { conciergeDisclosure, conciergeWelcomeBody, CONCIERGE_NAME } from "@/lib/concierge/identity";
import type { ConciergeWelcome } from "@/lib/concierge/types";

export const STARTER_MESSAGES: Record<string, string> = {
  website: "My website looks outdated and I get almost no inquiries.",
  presence: "I want to improve my business's digital presence.",
  application: "I have an idea for a custom application.",
  ecommerce: "I need a storefront that can sell what we offer.",
  infrastructure: "I need to connect or automate the systems we already use.",
  explore: "I'm exploring what my business actually needs.",
  about: "What does Aethelios Atelier actually do?",
  pricing: "How does pricing work?",
  proof: "Do you have examples of work I can see?",
  process: "How does a project with Atelier actually work?",
  contact: "I want to send a project inquiry.",
  handoff: "I want to discuss a project with the founder."
};

export function messageForStarter(id: string, fallback?: string): string {
  return STARTER_MESSAGES[id] ?? fallback?.trim() ?? id;
}

export function buildWelcome(path: string, liveAi: boolean): ConciergeWelcome {
  const page = conciergePageContext(path);
  return {
    liveAi,
    title: CONCIERGE_NAME,
    body: `${conciergeWelcomeBody(liveAi)}\n\n${page.awareness}`,
    disclosure: conciergeDisclosure(liveAi),
    page,
    starters: startersForPath(path)
  };
}
