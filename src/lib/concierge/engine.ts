import "server-only";
import OpenAI from "openai";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import { curatedTurn, unavailableTurn } from "@/lib/concierge/fallback";
import { conciergeContextPrompt, conciergeSystemPrompt } from "@/lib/concierge/instructions";
import { detectIntent, extractFacts } from "@/lib/concierge/intent";
import { conciergePageContext } from "@/lib/concierge/pages";
import { wrapUntrustedUserText } from "@/lib/concierge/safety";
import { emptyConciergeFacts, type ConciergeFacts, type ConciergeTurnResult } from "@/lib/concierge/types";
import { attachSpokenText } from "@/lib/concierge/voice";
import { CONCIERGE_SPOKEN_RULE, RTA_SPOKEN_RULE } from "@/lib/concierge/identity";
import { RTA_HISTORY_SEND, RTA_MAX_TOKENS, RTA_SPOKEN_CHARS, RTA_SPOKEN_SENTENCES } from "@/lib/rta/limits";

export type ConciergeModelClient = {
  chat: {
    completions: {
      create: (body: {
        model: string;
        temperature: number;
        max_tokens: number;
        messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
      }) => Promise<{ choices?: Array<{ message?: { content?: string | null } }> }>;
    };
  };
};

function applyExtraction(facts: ConciergeFacts, message: string): ConciergeFacts {
  const intent = detectIntent(message, facts.intent);
  return emptyConciergeFacts({
    ...facts,
    ...extractFacts(message, facts),
    intent,
    asked: facts.asked
  });
}

function liveReply(text: string, facts: ConciergeFacts, curated: ConciergeTurnResult): ConciergeTurnResult {
  const body = text.trim();
  if (!body) return curated;
  return {
    ...curated,
    liveAi: true,
    message: body,
    facts,
    reason: undefined
  };
}

export class ConciergeEngine {
  constructor(private readonly modelClient?: ConciergeModelClient) {}

  async turn(input: {
    message: string;
    history: Array<{ role: "user" | "assistant"; body: string }>;
    facts?: ConciergeFacts;
    pagePath: string;
    spoken?: boolean;
    mode?: "concierge" | "rta";
    signal?: AbortSignal;
  }): Promise<ConciergeTurnResult> {
    const rta = input.mode === "rta";
    const speakOpts = rta ? { maxSentences: RTA_SPOKEN_SENTENCES, maxChars: RTA_SPOKEN_CHARS } : undefined;
    const facts = applyExtraction(emptyConciergeFacts(input.facts), input.message);
    const status = aureliusStatus();
    const curated = attachSpokenText(curatedTurn({ message: input.message, facts, liveAi: status.ready }), speakOpts);

    if (curated.facts.intent === "secrets" || curated.facts.intent === "injection") {
      return { ...curated, liveAi: false, reason: curated.facts.intent };
    }

    if (!status.ready && !this.modelClient) {
      return curated;
    }

    try {
      const config = loadConfig();
      const client =
        this.modelClient ??
        new OpenAI({ apiKey: config.openAiKey, timeout: config.openAiTimeoutMs });
      const page = conciergePageContext(input.pagePath);
      const tokenCap = rta ? RTA_MAX_TOKENS : input.spoken ? 420 : 700;
      const completion = await client.chat.completions.create({
        model: config.openAiModel,
        temperature: 0.4,
        max_tokens: Math.min(config.openAiMaxOutputTokens, tokenCap),
        messages: [
          { role: "system", content: conciergeSystemPrompt(input.mode) },
          { role: "system", content: conciergeContextPrompt({ page, facts }) },
          ...(input.spoken
            ? [{ role: "system" as const, content: rta ? RTA_SPOKEN_RULE : CONCIERGE_SPOKEN_RULE }]
            : []),
          ...input.history.slice(rta ? -RTA_HISTORY_SEND : -10).map((item) => ({
            role: item.role,
            content: item.role === "user" ? wrapUntrustedUserText(item.body) : item.body
          })),
          { role: "user", content: wrapUntrustedUserText(input.message) }
        ]
      });
      const text = completion.choices?.[0]?.message?.content ?? "";
      return attachSpokenText(liveReply(text, facts, curated), speakOpts);
    } catch {
      return attachSpokenText(unavailableTurn({ facts, liveAi: status.ready, reason: "request_failed" }), speakOpts);
    }
  }
}
