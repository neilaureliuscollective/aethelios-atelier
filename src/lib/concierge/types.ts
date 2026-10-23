export const CONCIERGE_STORAGE_KEY = "atelier.concierge.v1";
export const CONCIERGE_HISTORY_LIMIT = 12;
export const CONCIERGE_MESSAGE_MAX = 2000;
export const CONCIERGE_OPEN_EVENT = "atelier:open-concierge";

export const CONCIERGE_INTENTS = [
  "website",
  "presence",
  "application",
  "ecommerce",
  "infrastructure",
  "explore",
  "about",
  "pricing",
  "proof",
  "process",
  "contact",
  "handoff",
  "out_of_scope",
  "secrets",
  "injection",
  "general"
] as const;

export type ConciergeIntent = (typeof CONCIERGE_INTENTS)[number];

export type ConciergeRole = "user" | "assistant" | "system";

export type ConciergeMessage = {
  id: string;
  role: ConciergeRole;
  body: string;
  liveAi?: boolean;
  createdAt: string;
};

export type ConciergeFacts = {
  business?: string;
  audience?: string;
  problem?: string;
  outcome?: string;
  currentSite?: string;
  intent?: ConciergeIntent;
  timeline?: string;
  budget?: string;
  asked: string[];
};

export type ConciergeSuggestion = {
  id: string;
  label: string;
};

export type ConciergeLinkAction = {
  kind: "link";
  href: string;
  label: string;
  reason?: string;
};

export type ConciergeInquiryAction = {
  kind: "start_inquiry";
  label: string;
};

export type ConciergeBriefAction = {
  kind: "start_brief";
  href: string;
  label: string;
};

export type ConciergeAction = ConciergeLinkAction | ConciergeInquiryAction | ConciergeBriefAction;

export type ConciergePageContext = {
  path: string;
  title: string;
  summary: string;
  awareness: string;
};

export type ConciergeTurnRequest = {
  message: string;
  history: Array<{ role: "user" | "assistant"; body: string }>;
  facts?: ConciergeFacts;
  pagePath: string;
  idempotencyKey?: string;
};

export type ConciergeTurnResult = {
  ok: true;
  liveAi: boolean;
  message: string;
  spokenText: string;
  facts: ConciergeFacts;
  suggestions: ConciergeSuggestion[];
  actions: ConciergeAction[];
  inquiryReady: boolean;
  disclosure: string;
  reason?: string;
};

export type ConciergeWelcome = {
  liveAi: boolean;
  title: string;
  body: string;
  disclosure: string;
  page: ConciergePageContext;
  starters: ConciergeSuggestion[];
};

export type ConciergeEventName =
  | "opened"
  | "first_message"
  | "suggestion_selected"
  | "engaged"
  | "link_clicked"
  | "inquiry_started"
  | "inquiry_submitted"
  | "handoff_requested"
  | "response_failed"
  | "abandoned"
  | "voice_started"
  | "voice_unsupported"
  | "voice_denied";

export type ConciergeEvent = {
  name: ConciergeEventName;
  path: string;
  createdAt: string;
};

export type ConciergeStoredSession = {
  version: 1;
  messages: ConciergeMessage[];
  facts: ConciergeFacts;
  updatedAt: string;
};

export function emptyConciergeFacts(partial?: Partial<ConciergeFacts>): ConciergeFacts {
  return {
    ...partial,
    asked: [...(partial?.asked ?? [])]
  };
}

export function isConciergeIntent(value: string | undefined): value is ConciergeIntent {
  return Boolean(value && (CONCIERGE_INTENTS as readonly string[]).includes(value));
}
