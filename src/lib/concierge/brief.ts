import { applyClientValue, createEmptyBrief } from "@/lib/brief";
import { serviceForIntent } from "@/lib/concierge/knowledge";
import type { ConciergeFacts, ConciergeMessage } from "@/lib/concierge/types";
import type { Brief } from "@/lib/types";

function firstLine(value?: string) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

export function projectTypeFromFacts(facts: ConciergeFacts): string {
  const service = serviceForIntent(facts.intent);
  return service?.id ?? "undecided";
}

export function briefFromConcierge(facts: ConciergeFacts, messages: ConciergeMessage[] = []): Brief {
  let brief = createEmptyBrief();
  const vision = [firstLine(facts.outcome), firstLine(facts.problem)].filter(Boolean).join(" ");
  const goals = firstLine(facts.outcome) || firstLine(facts.problem);
  if (vision) brief = applyClientValue(brief, "vision", vision.slice(0, 800));
  brief = applyClientValue(brief, "projectType", projectTypeFromFacts(facts));
  if (facts.audience) brief = applyClientValue(brief, "audience", firstLine(facts.audience).slice(0, 800));
  if (facts.currentSite) {
    brief = applyClientValue(brief, "existingWebsite", firstLine(facts.currentSite).slice(0, 800));
  }
  if (goals) brief = applyClientValue(brief, "goals", goals.slice(0, 800));
  if (facts.timeline) brief = applyClientValue(brief, "timing", firstLine(facts.timeline).slice(0, 800));
  if (facts.budget) brief = applyClientValue(brief, "budget", firstLine(facts.budget).slice(0, 800));
  if (facts.business) {
    brief = applyClientValue(brief, "priorities", `Business: ${firstLine(facts.business)}`.slice(0, 800));
  }
  const visitorNotes = messages
    .filter((item) => item.role === "user")
    .map((item) => item.body.trim())
    .filter(Boolean)
    .slice(-6);
  if (visitorNotes.length) {
    brief = applyClientValue(brief, "constraints", visitorNotes.join(" · ").slice(0, 800));
  }
  return brief;
}

export function inquiryNeedFromFacts(facts: ConciergeFacts, fallback = ""): string {
  const parts = [
    facts.business ? `Business: ${firstLine(facts.business)}` : "",
    facts.problem ? `Challenge: ${firstLine(facts.problem)}` : "",
    facts.outcome ? `Outcome: ${firstLine(facts.outcome)}` : "",
    facts.currentSite ? `Current site: ${firstLine(facts.currentSite)}` : ""
  ].filter(Boolean);
  if (parts.length) return parts.join("\n");
  return fallback.trim() || "I would like Neil to review a project conversation started with Aethelios.";
}

export function conversationHasUsefulContext(facts: ConciergeFacts, messages: ConciergeMessage[]): boolean {
  if (facts.business || facts.problem || facts.outcome || facts.intent) return true;
  return messages.some((item) => item.role === "user" && item.body.trim().length >= 12);
}
