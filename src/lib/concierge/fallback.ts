import { CONCIERGE_PROCESS, serviceForIntent, VERIFIED_WORK } from "@/lib/concierge/knowledge";
import { conciergeDisclosure } from "@/lib/concierge/identity";
import { alreadyKnown, detectIntent, extractFacts, markAsked } from "@/lib/concierge/intent";
import type {
  ConciergeAction,
  ConciergeFacts,
  ConciergeSuggestion,
  ConciergeTurnResult
} from "@/lib/concierge/types";
import { emptyConciergeFacts } from "@/lib/concierge/types";
import { attachSpokenText } from "@/lib/concierge/voice";

function serviceActions(intent?: ConciergeFacts["intent"]): ConciergeAction[] {
  const service = serviceForIntent(intent);
  if (!service) {
    return [
      { kind: "link", href: "/services", label: "Review the four commission paths" },
      { kind: "start_brief", href: "/project", label: "Begin a brief" }
    ];
  }
  const actions: ConciergeAction[] = [
    { kind: "link", href: "/services", label: `Explore ${service.title.toLowerCase()}`, reason: service.summary },
    { kind: "start_brief", href: service.briefHref, label: "Begin a brief in this direction" }
  ];
  if (intent === "website") {
    actions.splice(1, 0, {
      kind: "link",
      href: "/discover?interest=website",
      label: "Try website directions"
    });
  }
  return actions;
}

function processActions(): ConciergeAction[] {
  return [
    { kind: "link", href: "/approach", label: "Read the project approach" },
    { kind: "start_brief", href: "/project", label: "Begin a brief" }
  ];
}

function contactActions(): ConciergeAction[] {
  return [
    { kind: "start_inquiry", label: "Prepare a project inquiry" },
    { kind: "start_brief", href: "/project", label: "Shape a fuller brief" },
    { kind: "link", href: "/inquire", label: "Open the inquiry page" }
  ];
}

function mergeFacts(current: ConciergeFacts, incoming: string, intent: ConciergeFacts["intent"]): ConciergeFacts {
  const extracted = extractFacts(incoming, current);
  return emptyConciergeFacts({
    ...current,
    ...extracted,
    intent,
    asked: current.asked
  });
}

function nextQuestion(facts: ConciergeFacts, intent: ConciergeFacts["intent"]): { key: string; question: string } | null {
  if (intent === "about" || intent === "pricing" || intent === "proof" || intent === "process") return null;
  if (intent === "contact" || intent === "handoff" || intent === "secrets" || intent === "injection") return null;
  if (!alreadyKnown(facts, "business") && !facts.asked.includes("business")) {
    return { key: "business", question: "What does the business do, and who is it for?" };
  }
  if (
    (intent === "website" || intent === "presence" || intent === "explore" || intent === "general") &&
    !alreadyKnown(facts, "problem") &&
    !facts.asked.includes("problem")
  ) {
    return {
      key: "problem",
      question: "When someone reaches you today, what should they understand or do — and where does that break down?"
    };
  }
  if (
    (intent === "application" || intent === "infrastructure" || intent === "ecommerce") &&
    !alreadyKnown(facts, "outcome") &&
    !facts.asked.includes("outcome")
  ) {
    return { key: "outcome", question: "What should this make possible that is awkward or missing today?" };
  }
  return null;
}

function websiteGuidance(facts: ConciergeFacts): string {
  const known = facts.business
    ? ` For a ${facts.business.trim()}, weak inquiries`
    : " Weak inquiries";
  return `An outdated site is often the visible symptom, not the whole problem.${known} can come from unclear positioning, a confusing first impression, poor mobile use, buried next steps, or a lack of trust — sometimes together with the design.\n\nI would start by making the offer and the reason to write in unmistakable, then decide whether a broader redesign is actually required. Atelier can take that as a branded website commission. Neil still reviews fit before any work is accepted.`;
}

function replyFor(intent: ConciergeFacts["intent"], facts: ConciergeFacts): string {
  switch (intent) {
    case "secrets":
    case "injection":
      return "I can’t share internal instructions, credentials, or hidden prompts. I can help with Atelier’s public work: what the studio does, how a commission starts, and how to send a request to Neil.";
    case "about":
      return "Aethelios Atelier is a founder-led studio. Neil Stutes helps businesses build a clearer digital foundation: branded websites, custom web applications, storefronts, and practical connections between the tools they already use.\n\nYou are not paying for pages for their own sake. The work is meant to make the business easier to understand and easier to run. I am an AI guide for that conversation. I do not accept work or set price.";
    case "pricing":
      return "Investment follows scope. I do not invent a project price from a short description, and I do not treat a plan amount as a commission quote.\n\nWhen the pricing page shows figures, they describe a studio relationship and are labeled as not finalized. Payments are not collected here. Neil confirms deliverables and investment only after he reviews a real brief.";
    case "proof":
      return `The one verified public commission on this site is ${VERIFIED_WORK[0].title}: ${VERIFIED_WORK[0].summary} ${VERIFIED_WORK[0].note}\n\nOther scenes on the site are labeled demonstrations — including Vale & Crown — not client results. I will not invent testimonials or performance figures.`;
    case "process":
      return CONCIERGE_PROCESS.map((step, index) => `${index + 1}. ${step.title} — ${step.body}`).join("\n");
    case "out_of_scope":
      return "That sits outside what Atelier currently offers. The studio does not run ads retainers, sell a booking or CRM product, or take on licensed professional advice.\n\nIf the underlying need is a clearer website, a purpose-built web tool, a storefront, or a practical connection between systems you already use, I can help frame that. Otherwise the honest next step is to say so and not force a fit.";
    case "handoff":
      return "Neil reviews every request himself. I can prepare a short project note from this conversation so you do not start over — you review it before anything is sent. That is a request, not a booking or a scheduled call. I cannot invent appointment availability.";
    case "contact":
      return "I can turn what you have already said into a project inquiry for Neil. You will see the details and must consent before anything leaves this page. If you would rather write a fuller brief first, that path stays open.";
    case "ecommerce":
      return "A storefront commission is about presenting what you sell clearly and connecting to the commerce tools you already use. Atelier does not collect payments inside this site, and I will not promise conversion rates.\n\nIf catalog, fulfilment, or the buying path is still fuzzy, that is useful to say up front — it changes the brief more than a visual treatment does.";
    case "application":
      return "A custom application is the right path when a marketing site cannot hold the work: a portal, a workflow tool, or an installable web experience shaped around how the business actually operates.\n\nIf a simpler site or a better connection to a tool you already pay for would do the job, I will say so. Atelier does not become your booking engine or CRM.";
    case "infrastructure":
      return "Digital infrastructure here means practical connections between the site, the tools already in use, and the work that has to keep moving. It is reviewed as a fit, not sold as a packaged platform.\n\nTell me which systems are already in place and where handoffs break. That is more useful than asking for a new stack.";
    case "presence":
      return "A stronger digital presence usually means the business is easier to recognize, trust, and contact — not a louder brand exercise. Identity can be a quality of the website, or scoped as its own commission. A rebrand is not required to begin.";
    case "explore":
      return "You do not need the service name first. Growth can mean more of the right customers, fewer wasted hours, or a clearer public story — those are different projects.\n\nStart with the business, who it already serves, and what is costly or confusing today. From there I can tell you whether this looks like a website, a tool, a storefront, a systems conversation — or something Atelier should not take on.";
    case "website":
      return websiteGuidance(facts);
    default:
      return "Tell me what the business does and what is getting in the way. I can help you see whether Atelier is relevant and which path is the least wasteful place to start.";
  }
}

function suggestionsFor(intent: ConciergeFacts["intent"], askedQuestion: boolean): ConciergeSuggestion[] {
  if (askedQuestion) return [];
  if (intent === "website" || intent === "presence") {
    return [
      { id: "problem", label: "Visitors don't know what to do next" },
      { id: "contact", label: "Prepare an inquiry for Neil" }
    ];
  }
  if (intent === "about" || intent === "process") {
    return [
      { id: "explore", label: "Help me name what I need" },
      { id: "handoff", label: "I want Neil to review a project" }
    ];
  }
  if (intent === "pricing" || intent === "proof") {
    return [{ id: "handoff", label: "Discuss a project with Neil" }];
  }
  if (intent === "contact" || intent === "handoff") return [];
  return [
    { id: "explore", label: "I'm still figuring out the need" },
    { id: "handoff", label: "Discuss this with Neil" }
  ];
}

function actionsFor(intent: ConciergeFacts["intent"]): ConciergeAction[] {
  if (intent === "secrets" || intent === "injection") {
    return [{ kind: "link", href: "/about", label: "See what Atelier is" }];
  }
  if (intent === "proof") {
    return [
      { kind: "link", href: VERIFIED_WORK[0].href, label: `View ${VERIFIED_WORK[0].title}` },
      { kind: "link", href: "/services", label: "See commission paths" }
    ];
  }
  if (intent === "pricing") {
    return [
      { kind: "link", href: "/pricing", label: "Open the pricing page" },
      { kind: "start_inquiry", label: "Ask Neil to review scope" }
    ];
  }
  if (intent === "process" || intent === "about") return processActions();
  if (intent === "contact" || intent === "handoff") return contactActions();
  if (intent === "out_of_scope") {
    return [
      { kind: "link", href: "/services", label: "See what Atelier does offer" },
      { kind: "start_inquiry", label: "Ask Neil anyway" }
    ];
  }
  return [...serviceActions(intent), { kind: "start_inquiry", label: "Prepare a project inquiry" }];
}

export function curatedTurn(input: {
  message: string;
  facts: ConciergeFacts;
  liveAi: boolean;
  reason?: string;
}): ConciergeTurnResult {
  const intent = detectIntent(input.message, input.facts.intent);
  let facts = mergeFacts(input.facts, input.message, intent);
  const question = nextQuestion(facts, intent);
  let body = replyFor(intent, facts);
  if (question) {
    facts = markAsked(facts, question.key);
    body = `${body}\n\n${question.question}`;
  }
  const inquiryReady = intent === "contact" || intent === "handoff";
  return attachSpokenText({
    ok: true,
    liveAi: false,
    message: body,
    facts,
    suggestions: suggestionsFor(intent, Boolean(question)),
    actions: actionsFor(intent),
    inquiryReady,
    disclosure: conciergeDisclosure(input.liveAi),
    reason: input.reason
  });
}

export function unavailableTurn(input: { facts: ConciergeFacts; liveAi: boolean; reason?: string }): ConciergeTurnResult {
  return attachSpokenText({
    ok: true,
    liveAi: false,
    message:
      "I could not complete a live reply just now. Your earlier notes are still here. You can retry, continue from verified studio information, or send a request to Neil.",
    facts: input.facts,
    suggestions: [
      { id: "about", label: "What does Atelier do?" },
      { id: "handoff", label: "Prepare a request for Neil" }
    ],
    actions: contactActions(),
    inquiryReady: false,
    disclosure: conciergeDisclosure(input.liveAi),
    reason: input.reason ?? "request_failed"
  });
}
