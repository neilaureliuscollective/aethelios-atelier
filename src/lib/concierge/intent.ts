import type { ConciergeFacts, ConciergeIntent } from "@/lib/concierge/types";
import { looksLikePromptInjection, looksLikeSecretProbe } from "@/lib/concierge/safety";

const RULES: Array<{ intent: ConciergeIntent; pattern: RegExp }> = [
  { intent: "secrets", pattern: /\b(api[\s_-]?key|secret key|password|private key|internal (instructions|prompt|notes)|environment variable|AUTH_SECRET|OPENAI_API_KEY|system prompt)\b/i },
  { intent: "injection", pattern: /\b(ignore (all )?(previous|above|prior) (instructions|prompts)|you are now|developer mode|jailbreak|reveal (your )?(hidden|system)|act as (dan|a different)|override (your )?(rules|policies))\b/i },
  { intent: "handoff", pattern: /\b(talk to (the )?founder|speak (to|with) neil|contact neil|ask (the )?founder|human (please|agent|review)|real person)\b/i },
  { intent: "contact", pattern: /\b(send .{0,24}inquir(?:y|ies)?|project inquir(?:y|ies)?|get in touch|start a project|work with (you|atelier|neil)|hire you|discuss a project)\b/i },
  { intent: "pricing", pattern: /\b(price|pricing|cost|how much|quote|hourly|retainer|budget range)\b/i },
  { intent: "proof", pattern: /\b(examples?|portfolio|case stud(?:y|ies)?|testimonials?|proof|have you built|show me (a )?(site|project)|selected work|fix it shop)\b/i },
  { intent: "process", pattern: /\b(process|how (does|do).{0,48}work|what happens next|approach|steps)\b/i },
  { intent: "about", pattern: /\b(what (does|is) (aethelios )?atelier|what do you (actually )?do|who (are you|is neil)|your services|tell me about (the )?studio)\b/i },
  { intent: "ecommerce", pattern: /\b(e-?commerce|storefront|online store|sell online|shopify|product catalog)\b/i },
  { intent: "application", pattern: /\b(custom app|web app|application|portal|platform|internal tool|software)\b/i },
  { intent: "infrastructure", pattern: /\b(automat|integrat|workflow|connect (my|our|the) (tools|systems)|digital infrastructure|systems we already use)\b/i },
  { intent: "website", pattern: /\b(website|web site|redesign|outdated|no inquir|looks (old|dated|tired)|site (looks|is|feels))\b/i },
  { intent: "presence", pattern: /\b(digital presence|brand (identity|experience)|look more professional|online presence)\b/i },
  { intent: "explore", pattern: /\b(not sure|don'?t know|what (do )?i (actually )?need|exploring|figure out what|where to start|want to grow|grow the business)\b/i },
  { intent: "out_of_scope", pattern: /\b(ios app store|android app|seo retainer|run (my|our) ads|social media management|legal advice|bookkeeping|guaranteed (leads|ranking|revenue))\b/i }
];

export function detectIntent(text: string, current?: ConciergeIntent): ConciergeIntent {
  if (looksLikeSecretProbe(text)) return "secrets";
  if (looksLikePromptInjection(text)) return "injection";
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return rule.intent;
  }
  return current ?? "general";
}

export function extractFacts(text: string, current: ConciergeFacts): Partial<ConciergeFacts> {
  const next: Partial<ConciergeFacts> = {};
  const business =
    text.match(/\b(?:i (?:run|own|have|operate)|we(?:'re| are)|my (?:business|company|shop|studio|practice) is)\s+([^.]{4,80})/i)?.[1] ||
    text.match(/\b(?:a|an)\s+((?:men'?s )?(?:salon|barbershop|clinic|studio|agency|shop|practice|firm)[^.]{0,40})/i)?.[1];
  if (business) next.business = business.trim();

  const audience = text.match(/\b(?:we serve|our (?:clients|customers|patients)|audience is)\s+([^.]{4,80})/i)?.[1];
  if (audience) next.audience = audience.trim();

  const site = text.match(/\b(?:current (?:site|website)|existing (?:site|website)|website is)\s+([^.]{4,80})/i)?.[1];
  if (site) next.currentSite = site.trim();
  if (/\b(no website|don'?t have a (site|website)|never had a site)\b/i.test(text)) {
    next.currentSite = "None yet";
  }

  const outcome = text.match(/\b(?:i want|we want|goal is|so that)\s+([^.]{4,100})/i)?.[1];
  if (outcome) next.outcome = outcome.trim();

  if (/\b(outdated|old|tired|dated|almost no inquir|no inquir|nobody (calls|writes)|not getting)\b/i.test(text)) {
    next.problem = current.problem ?? text.replace(/\s+/g, " ").trim().slice(0, 240);
  } else if (/\b(confus|unclear|slow|broken|hard to use|doesn'?t work)\b/i.test(text) && !current.problem) {
    next.problem = text.replace(/\s+/g, " ").trim().slice(0, 240);
  }

  const timeline = text.match(/\b(?:by|before|within|in the next)\s+((?:a )?(?:\d+|few|couple of)\s+(?:days|weeks|months)|this (?:season|year|quarter)|asap|no rush)[^.]{0,20}/i)?.[0];
  if (timeline) next.timeline = timeline.trim();

  const budget = text.match(/\b(?:budget(?: is| of)?|we can (?:spend|invest))\s+([^.]{3,40})/i)?.[1];
  if (budget) next.budget = budget.trim();

  return next;
}

export function markAsked(facts: ConciergeFacts, key: string): ConciergeFacts {
  if (facts.asked.includes(key)) return facts;
  return { ...facts, asked: [...facts.asked, key] };
}

export function alreadyKnown(facts: ConciergeFacts, key: keyof ConciergeFacts): boolean {
  const value = facts[key];
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}
