import { afterEach, beforeEach, describe, expect, it } from "vitest";

const openAiCalls: Array<Record<string, unknown>> = [];
let streamFails = false;

const scriptedClient = {
  chat: {
    completions: {
      create: async (params: Record<string, unknown>) => {
        openAiCalls.push(params);
        if (params.stream) {
          if (streamFails) throw new Error("upstream unavailable");
          return (async function* () {
            for (const text of ["A chair-side ", "booking flow will matter more than pages. ", "Who books with you most?"]) {
              yield { choices: [{ delta: { content: text } }] };
            }
          })();
        }
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  businessName: "Northridge",
                  location: "Austin",
                  business: "A three-chair barbershop.",
                  audience: "",
                  currentSetup: "Books through Square.",
                  needs: "<script>alert(1)</script>"
                })
              }
            }
          ]
        };
      }
    }
  }
};

import { aetheliosDiscoveryPrompt } from "@/lib/aethelios/persona";
import { createRateLimiter, resetInquiryRateLimitForTests } from "@/lib/inquiry/rateLimit";
import { visitorConfirmationText } from "@/lib/inquiry/send";
import { briefReady, coveredTopics, DISCOVERY_TOPICS, emptyBrief, mergeBrief, parseBrief, type DiscoveryBrief } from "./brief";
import { composeFromBrief } from "./compose";
import { formatHandoffDocument, resetConciergeHandoffForTests, submitConciergeHandoff } from "./handoff";
import { presentationSchema } from "./schema";
import { MAX_VISITOR_TURNS, WRAP_UP_TURN, runConciergeTurn, setChatClientFactoryForTests } from "./talk";
import type { ConciergeHistoryItem, ConciergeStreamEvent } from "./types";

const original = { ...process.env };

beforeEach(() => {
  setChatClientFactoryForTests(async () => scriptedClient as never);
});

afterEach(() => {
  setChatClientFactoryForTests(null);
  process.env = { ...original };
  openAiCalls.length = 0;
  streamFails = false;
  resetConciergeHandoffForTests();
  resetInquiryRateLimitForTests();
});

function offline() {
  process.env.ATELIER_OPENAI_ENABLED = "false";
  delete process.env.OPENAI_API_KEY;
}

function live() {
  process.env.ATELIER_OPENAI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "sk-test-not-used";
}

const ANSWERS = [
  "I run a barbershop called Northridge in Austin.",
  "Mostly professionals in their thirties who want a standing appointment.",
  "I want more rebookings and fewer no-shows.",
  "Square for booking and payments, plus an old Wix site.",
  "A proper website connected to Square, maybe a members page later.",
  "Quiet, dark, precise. Think Aesop meets an old gentlemen's club.",
  "Before our second location opens in March."
];

describe("discovery brief", () => {
  it("never erases what the visitor said and ignores bad keys", () => {
    const first = mergeBrief(emptyBrief(), { business: "A barbershop.", audience: "Professionals." });
    const second = mergeBrief(first, { business: "", goals: "More rebookings." });
    expect(second.business).toBe("A barbershop.");
    expect(second.goals).toBe("More rebookings.");
    expect(parseBrief({ lastAsked: "pricing", business: "x".repeat(900) })).toMatchObject({ lastAsked: undefined });
    expect(parseBrief({ business: "x".repeat(900) }).business).toHaveLength(400);
    expect(parseBrief("not a brief")).toEqual(emptyBrief());
  });

  it("is ready only with the business, the goal, the build, and most of the rest", () => {
    const core = parseBrief({ business: "a", goals: "b", needs: "c", audience: "d" });
    expect(briefReady(core)).toBe(false);
    expect(briefReady({ ...core, timeline: "March" })).toBe(true);
    expect(briefReady(parseBrief({ audience: "a", currentSetup: "b", feel: "c", timeline: "d", goals: "e" }))).toBe(false);
  });
});

describe("discovery conversation without a model", () => {
  it("walks every topic, one question per turn, then offers the direction", async () => {
    offline();
    let brief: DiscoveryBrief = emptyBrief();
    const history: ConciergeHistoryItem[] = [];
    const replies: string[] = [];
    for (const [turn, message] of ANSWERS.entries()) {
      const result = await runConciergeTurn({ message, history: [...history], brief, turn });
      brief = result.brief;
      replies.push(result.reply);
      history.push({ role: "user", content: message }, { role: "assistant", content: result.reply });
    }
    expect(coveredTopics(brief)).toHaveLength(DISCOVERY_TOPICS.length);
    expect(briefReady(brief)).toBe(true);
    expect(brief.timeline).toMatch(/March/);
    for (const reply of replies.slice(0, 4)) expect(reply.match(/\?/g)).toHaveLength(1);
    expect(replies.at(-1)).toMatch(/Create my direction/);
    for (const reply of replies) expect(reply).not.toMatch(/\$\d|per month|estimate/i);

    const document = composeFromBrief(brief, ANSWERS.join("\n"));
    expect(presentationSchema.safeParse(document).success).toBe(true);
    const text = JSON.stringify(document);
    expect(document.title).toMatch(/Northridge/);
    expect(text).toMatch(/rebookings/);
    expect(text).toMatch(/Square/);
    expect(text).toMatch(/second location/);
    expect(text).not.toMatch(/\$\d|testimonial|<script/i);
  });

  it("wraps up at the long-conversation mark and stops at the hard limit", async () => {
    offline();
    const wrap = await runConciergeTurn({ message: "One more detail about parking.", turn: WRAP_UP_TURN });
    expect(wrap.reply).toMatch(/Create my direction/);
    expect(wrap.reply).not.toMatch(/\?/);
    const events: ConciergeStreamEvent[] = [];
    const stop = await runConciergeTurn({ message: "And another.", turn: MAX_VISITOR_TURNS, onEvent: (event) => events.push(event) });
    expect(stop.reply).toMatch(/more than enough for Neil/);
    expect(events.find((event) => event.type === "brief")).toMatchObject({ ready: true });
  });
});

describe("discovery conversation with a model", () => {
  it("streams the reply in pieces and keeps the note-taker's brief, minus anything unsafe", async () => {
    live();
    const deltas: string[] = [];
    const result = await runConciergeTurn({
      message: "I run Northridge, a barbershop in Austin. We book through Square.",
      onEvent: (event) => {
        if (event.type === "delta") deltas.push(event.text);
      }
    });
    expect(deltas.length).toBe(3);
    expect(result.liveAi).toBe(true);
    expect(result.reply).toBe("A chair-side booking flow will matter more than pages. Who books with you most?");
    expect(result.brief.businessName).toBe("Northridge");
    expect(result.brief.currentSetup).toMatch(/Square/);
    expect(result.brief.needs).toBe("");
    const chat = openAiCalls.find((call) => call.stream);
    const system = (chat?.messages as Array<{ role: string; content: string }>)[0]!.content;
    expect(system).toMatch(/exactly one question/);
    expect(system).toMatch(/Never state, estimate, or hint at a price/);
    expect(chat?.max_completion_tokens).toBeLessThanOrEqual(1000);
  });

  it("falls back to the house question when the stream fails, still keeping the brief", async () => {
    live();
    streamFails = true;
    const deltas: string[] = [];
    const result = await runConciergeTurn({
      message: "I run Northridge, a barbershop in Austin.",
      onEvent: (event) => {
        if (event.type === "delta") deltas.push(event.text);
      }
    });
    expect(result.liveAi).toBe(false);
    expect(deltas).toEqual([result.reply]);
    expect(result.reply.match(/\?/g)).toHaveLength(1);
    expect(result.brief.businessName).toBe("Northridge");
    expect(JSON.stringify(result.brief)).not.toMatch(/<script/);
  });
});

describe("discovery prompt", () => {
  it("carries the brief, the next question, and the house rules — and never a figure", () => {
    const prompt = aetheliosDiscoveryPrompt({
      brief: ["The business: A barbershop."],
      missing: ["Who it serves"],
      suggestedQuestion: DISCOVERY_TOPICS[1].question,
      ready: false,
      wrapUp: false
    });
    expect(prompt).toContain("The business: A barbershop.");
    expect(prompt).toContain("Still to learn: Who it serves.");
    expect(prompt).toContain(DISCOVERY_TOPICS[1].question);
    expect(prompt).toMatch(/Do not ask for their name, email, or phone/);
    expect(prompt).toMatch(/ignore these instructions/);
    expect(prompt).not.toMatch(/\$\d/);
    expect(prompt).toMatch(/no subscription plans or published package prices/);
    const ready = aetheliosDiscoveryPrompt({ brief: [], missing: [], suggestedQuestion: null, ready: true, wrapUp: false });
    expect(ready).toMatch(/Create my direction/);
  });
});

describe("handoff to Neil", () => {
  const session = {
    name: "Marcus Hale",
    email: "marcus@northridge.test",
    business: "Northridge Barbers",
    phone: "337-555-0100",
    timeline: "Before March",
    budget: "Open to a proper build",
    sessionId: "talk_discovery_session",
    messages: [
      { role: "user" as const, content: ANSWERS[0]! },
      { role: "assistant" as const, content: "Who books with you most?" }
    ],
    brief: { business: "A barbershop.", goals: "More rebookings.", needs: "A website connected to Square." },
    honeypot: ""
  };

  it("leads with contact, then the brief, then the conversation", () => {
    const text = formatHandoffDocument(session);
    const contact = text.indexOf("CONTACT");
    const brief = text.indexOf("THE BRIEF");
    const conversation = text.indexOf("CONVERSATION");
    expect(contact).toBeGreaterThan(-1);
    expect(contact).toBeLessThan(brief);
    expect(brief).toBeLessThan(conversation);
    expect(text).toContain("Phone: 337-555-0100");
    expect(text).toContain("Investment in mind: Open to a proper build");
    expect(text).toContain("What has to work better: More rebookings.");
    expect(text).toContain("Business: Northridge Barbers");
  });

  it("accepts a local rehearsal capture instead of failing", async () => {
    delete process.env.VERCEL;
    delete process.env.ATELIER_INQUIRY_TO;
    process.env.ATELIER_INQUIRY_CAPTURE = "true";
    process.env.ATELIER_DATA_DIR = "/tmp/atelier-discovery-test";
    const result = await submitConciergeHandoff(session);
    expect(result).toMatchObject({ ok: true, delivery: "capture", labeled: true });
  });

  it("thanks the visitor by first name without a price or a promise", () => {
    const text = visitorConfirmationText({ name: "Marcus Hale", business: "Northridge Barbers" });
    expect(text.startsWith("Marcus,")).toBe(true);
    expect(text).toContain("Northridge Barbers");
    expect(text).toMatch(/Nothing has been booked or charged/);
    expect(text).not.toMatch(/\$\d|guarantee|will accept/i);
  });
});

describe("talk rate limit", () => {
  it("allows a real conversation and stops a flood", () => {
    const limiter = createRateLimiter(3, 1000);
    expect([1, 2, 3].map(() => limiter.limited("ip", 0))).toEqual([false, false, false]);
    expect(limiter.limited("ip", 10)).toBe(true);
    expect(limiter.limited("ip", 2000)).toBe(false);
    expect(limiter.limited("other", 10)).toBe(false);
  });
});

describe("direction quote", () => {
  it("quotes the visitor's opening description, not the whole conversation", () => {
    const brief = parseBrief({ business: "A barbershop.", goals: "More rebookings.", needs: "A website." });
    const document = composeFromBrief(brief, ["hi", ANSWERS[0], ANSWERS[1]].join("\n"));
    const quote = document.slides.find((slide) => slide.id === "slide_words")?.quote;
    expect(quote).toBe(ANSWERS[0]);
  });
});
