import {
  aetheliosBriefExtractionPrompt,
  aetheliosCanvasPrompt,
  aetheliosComposeReply,
  aetheliosDiscoveryPrompt
} from "@/lib/aethelios/persona";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import {
  briefLines,
  briefReady,
  DISCOVERY_TOPICS,
  emptyBrief,
  mergeBrief,
  nextTopic,
  parseBrief,
  type DiscoveryBrief
} from "./brief";
import { composeFromBrief } from "./compose";
import { containsForbiddenPayload } from "./contract";
import { extractBusinessSketch, sketchLabel } from "./extract";
import { mergePresentation } from "./merge";
import { presentationSchema } from "./schema";
import { generateSitePreview } from "./sitePreview";
import type { ConciergeHistoryItem, ConciergeStreamEvent, PresentationDocument, SitePreview } from "./types";

/** Visitor turns before Aethelios stops asking and invites the direction. */
export const WRAP_UP_TURN = 24;
/** Visitor turns one conversation may use. The client enforces the same number. */
export const MAX_VISITOR_TURNS = 30;

const REPLY_MAX_TOKENS = 900;
const BRIEF_MAX_TOKENS = 1200;

export type ConciergeTalkInput = {
  message: string;
  history?: ConciergeHistoryItem[];
  brief?: DiscoveryBrief;
  turn?: number;
  document?: PresentationDocument;
  preview?: SitePreview;
  compose?: boolean;
  signal?: AbortSignal;
  onEvent?: (event: ConciergeStreamEvent) => void;
};

type ChatClient = Pick<import("openai").default, "chat">;
type ChatClientFactory = (options: { apiKey: string; timeout: number }) => Promise<ChatClient>;

const defaultFactory: ChatClientFactory = async (options) => {
  const OpenAI = (await import("openai")).default;
  return new OpenAI(options);
};

let clientFactory = defaultFactory;

/** Tests substitute a scripted client so no conversation ever reaches the network. */
export function setChatClientFactoryForTests(factory: ChatClientFactory | null) {
  clientFactory = factory ?? defaultFactory;
}

async function openAi(timeoutMs?: number) {
  const config = loadConfig();
  return {
    client: await clientFactory({ apiKey: config.openAiKey, timeout: timeoutMs ?? config.openAiTimeoutMs }),
    model: config.openAiModel
  };
}

function transcript(history: ConciergeHistoryItem[], message: string) {
  return [...history.map((item) => `${item.role === "user" ? "Visitor" : "Aethelios"}: ${item.content}`), `Visitor: ${message}`].join("\n");
}

/** Streams a model reply. Returns whatever text arrived, even if the stream broke midway. */
async function streamReply(input: {
  message: string;
  history: ConciergeHistoryItem[];
  brief: DiscoveryBrief;
  wrapUp: boolean;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}): Promise<string> {
  const { client, model } = await openAi();
  const ready = briefReady(input.brief);
  const next = nextTopic(input.brief);
  const system = aetheliosDiscoveryPrompt({
    brief: briefLines(input.brief),
    missing: DISCOVERY_TOPICS.filter((topic) => !input.brief[topic.id]).map((topic) => topic.label),
    suggestedQuestion: next?.question ?? null,
    ready,
    wrapUp: input.wrapUp
  });
  let text = "";
  try {
    const stream = await client.chat.completions.create(
      {
        model,
        stream: true,
        reasoning_effort: "low",
        max_completion_tokens: REPLY_MAX_TOKENS,
        messages: [
          { role: "system", content: system },
          ...input.history.map((item) => ({ role: item.role, content: item.content })),
          { role: "user", content: input.message }
        ]
      },
      { signal: input.signal }
    );
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (!delta) continue;
      text += delta;
      input.onDelta(delta);
    }
  } catch (error) {
    if (!text) throw error;
  }
  return text.trim();
}

/** The silent note-taker. Null when the model is unavailable or returns something unusable. */
async function extractBrief(input: {
  message: string;
  history: ConciergeHistoryItem[];
  brief: DiscoveryBrief;
  signal?: AbortSignal;
}): Promise<DiscoveryBrief | null> {
  const { client, model } = await openAi();
  const current = { ...input.brief, lastAsked: undefined };
  const completion = await client.chat.completions.create(
    {
      model,
      reasoning_effort: "low",
      max_completion_tokens: BRIEF_MAX_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: aetheliosBriefExtractionPrompt() },
        {
          role: "user",
          content: `Current brief:\n${JSON.stringify(current)}\n\nConversation:\n${transcript(input.history, input.message)}`
        }
      ]
    },
    { signal: input.signal }
  );
  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = parseBrief(JSON.parse(raw));
    // A field carrying markup or script is dropped; the rest of the note still counts.
    for (const key of Object.keys(parsed) as (keyof DiscoveryBrief)[]) {
      if (containsForbiddenPayload(parsed[key])) parsed[key] = "" as never;
    }
    return mergeBrief(input.brief, parsed);
  } catch {
    return null;
  }
}

/** Without a model: the answer belongs to the question that was just asked. */
export function fallbackBrief(brief: DiscoveryBrief, message: string): DiscoveryBrief {
  const topic = brief.lastAsked ?? "business";
  const sketch = extractBusinessSketch(message);
  return mergeBrief(brief, {
    [topic]: brief[topic] ? `${brief[topic]} ${message}` : message,
    businessName: brief.businessName || sketch.name || "",
    location: brief.location || sketch.place || ""
  });
}

const ACKNOWLEDGEMENTS = ["Understood.", "That helps.", "Good — that sharpens it.", "Noted.", "Clear."];

/** Without a model: acknowledge, then ask the next open topic in the house voice. */
export function fallbackReply(brief: DiscoveryBrief, turn: number, wrapUp = false) {
  if (wrapUp || briefReady(brief)) {
    return "That is plenty for Neil to work from. Press Create my direction and I will write it up beside us — or keep refining with me first.";
  }
  const next = nextTopic(brief);
  const ack = turn === 0 ? "Welcome." : ACKNOWLEDGEMENTS[turn % ACKNOWLEDGEMENTS.length];
  return next ? `${ack} ${next.question}` : `${ack} What else should Neil know before he reads this?`;
}

async function refineWithModel(input: {
  history: ConciergeHistoryItem[];
  brief: DiscoveryBrief;
  document: PresentationDocument;
  signal?: AbortSignal;
}): Promise<PresentationDocument | null> {
  const { client, model } = await openAi(Math.min(loadConfig().openAiTimeoutMs, 20_000));
  const completion = await client.chat.completions.create(
    {
      model,
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: aetheliosCanvasPrompt() },
        ...input.history.slice(-6),
        {
          role: "user",
          content: `Project brief:\n${briefLines(input.brief).join("\n")}\n\nDraft document:\n${JSON.stringify(input.document)}`
        }
      ]
    },
    { signal: input.signal }
  );
  const raw = completion.choices[0]?.message?.content;
  if (!raw || containsForbiddenPayload(raw)) return null;
  try {
    return mergePresentation(input.document, JSON.parse(raw) as PresentationDocument);
  } catch {
    return null;
  }
}

function sitePreviewEnabled() {
  return process.env.ATELIER_SITE_PREVIEW === "true";
}

async function composeTurn(input: ConciergeTalkInput, brief: DiscoveryBrief) {
  const live = aureliusStatus().ready;
  const sketch = extractBusinessSketch(input.message);
  const label = brief.businessName || sketchLabel(sketch);
  const reply = aetheliosComposeReply(label, true);
  input.onEvent?.({ type: "user", text: input.message });
  input.onEvent?.({ type: "delta", text: reply });

  let document = composeFromBrief(brief, input.message, input.document);
  if (containsForbiddenPayload(document) && input.document) document = input.document;
  const parsed = presentationSchema.safeParse(document);
  if (parsed.success) {
    document = parsed.data;
    input.onEvent?.({ type: "canvas.open", document: { ...document, slides: [] } });
    for (const slide of document.slides) {
      if (input.signal?.aborted) break;
      input.onEvent?.({ type: "canvas.slide", slide });
    }
  }

  let liveAi = false;
  if (live && !input.signal?.aborted) {
    try {
      const refined = await refineWithModel({ history: input.history ?? [], brief, document, signal: input.signal });
      if (refined) {
        liveAi = true;
        document = refined;
        input.onEvent?.({ type: "canvas.replace", document: refined });
      }
    } catch {
      liveAi = false;
    }
  }

  let preview = input.preview;
  if (live && sitePreviewEnabled() && !input.preview && !input.signal?.aborted) {
    input.onEvent?.({ type: "preview.open" });
    try {
      const next = await generateSitePreview({ message: input.message, sketch, signal: input.signal });
      if (next) {
        liveAi = true;
        preview = next;
        input.onEvent?.({ type: "preview.ready", preview: next });
      }
    } catch {
      preview = input.preview;
    }
  }

  input.onEvent?.({ type: "canvas.complete", document });
  input.onEvent?.({ type: "brief", brief, ready: briefReady(brief) });
  input.onEvent?.({ type: "done", reply, liveAi, presented: true });
  return { reply, liveAi, presented: true, document, preview, brief };
}

export async function runConciergeTurn(input: ConciergeTalkInput) {
  const brief = input.brief ?? emptyBrief();
  if (input.compose) return composeTurn(input, brief);

  const history = input.history ?? [];
  const turn = input.turn ?? history.filter((item) => item.role === "user").length;
  input.onEvent?.({ type: "user", text: input.message });

  if (turn >= MAX_VISITOR_TURNS) {
    const reply =
      "We have covered a great deal — more than enough for Neil. Press Create my direction to write it up, then send it to him from the bar below.";
    input.onEvent?.({ type: "delta", text: reply });
    input.onEvent?.({ type: "brief", brief, ready: true });
    input.onEvent?.({ type: "done", reply, liveAi: false, presented: false });
    return { reply, liveAi: false, presented: false, document: input.document, preview: input.preview, brief };
  }

  const wrapUp = turn >= WRAP_UP_TURN;
  const live = aureliusStatus().ready;
  let reply = "";
  let nextBrief: DiscoveryBrief | null = null;

  if (live) {
    const briefWork = extractBrief({ message: input.message, history, brief, signal: input.signal }).catch(() => null);
    try {
      reply = await streamReply({
        message: input.message,
        history,
        brief,
        wrapUp,
        signal: input.signal,
        onDelta: (text) => input.onEvent?.({ type: "delta", text })
      });
    } catch {
      reply = "";
    }
    nextBrief = await briefWork;
  }

  const liveAi = Boolean(reply);
  nextBrief = nextBrief ?? fallbackBrief(brief, input.message);
  nextBrief.lastAsked = nextTopic(nextBrief)?.id;
  if (!reply) {
    reply = fallbackReply(nextBrief, turn, wrapUp);
    input.onEvent?.({ type: "delta", text: reply });
  }

  const ready = briefReady(nextBrief);
  input.onEvent?.({ type: "brief", brief: nextBrief, ready });
  input.onEvent?.({ type: "done", reply, liveAi, presented: false });
  return { reply, liveAi, presented: false, document: input.document, preview: input.preview, brief: nextBrief };
}
