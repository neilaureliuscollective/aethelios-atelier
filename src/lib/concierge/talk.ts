import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { composePresentation, composeReply } from "./compose";
import { containsForbiddenPayload } from "./contract";
import { extractBusinessSketch } from "./extract";
import { shouldOpenCanvas } from "./intent";
import { mergePresentation } from "./merge";
import { presentationSchema } from "./schema";
import type { ConciergeHistoryItem, ConciergeStreamEvent, PresentationDocument } from "./types";

export type ConciergeTalkInput = {
  message: string;
  history?: ConciergeHistoryItem[];
  document?: PresentationDocument;
  signal?: AbortSignal;
  onEvent?: (event: ConciergeStreamEvent) => void;
};

async function refineWithModel(input: {
  message: string;
  history: ConciergeHistoryItem[];
  document: PresentationDocument;
  signal?: AbortSignal;
}): Promise<PresentationDocument | null> {
  const status = aureliusStatus();
  if (!status.ready) return null;
  const config = loadConfig();
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: config.openAiKey, timeout: Math.min(config.openAiTimeoutMs, 12_000) });
  const completion = await client.chat.completions.create(
    {
      model: config.openAiModel,
      temperature: 0.4,
      max_tokens: Math.min(config.openAiMaxOutputTokens, 900),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            `You are ${INTELLIGENCE_DISPLAY_NAME}, composing a display-only presentation canvas.`,
            "Return JSON that matches the supplied draft. You may refine title, thesis, and slide copy.",
            "Never invent prices, client results, testimonials, or completed work.",
            "Never return HTML, JSX, CSS, JavaScript, URLs to remote images, or executable strings.",
            "Keep the same slide ids and layouts. Keep version 1."
          ].join(" ")
        },
        ...input.history.slice(-6),
        {
          role: "user",
          content: `Business message:\n${input.message}\n\nDraft document:\n${JSON.stringify(input.document)}`
        }
      ]
    },
    { signal: input.signal }
  );
  const raw = completion.choices[0]?.message?.content;
  if (!raw || containsForbiddenPayload(raw)) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return mergePresentation(input.document, parsed as PresentationDocument);
  } catch {
    return null;
  }
}

export async function runConciergeTurn(input: ConciergeTalkInput) {
  const presented = shouldOpenCanvas(input.message, Boolean(input.document));
  const sketch = extractBusinessSketch(input.message);
  const reply = composeReply(sketch, presented);
  input.onEvent?.({ type: "user", text: input.message });
  input.onEvent?.({ type: "delta", text: reply });

  let document = presented ? composePresentation(input.message, input.document) : input.document;
  if (document && containsForbiddenPayload(document)) {
    document = input.document;
  }
  if (document && presented) {
    const parsed = presentationSchema.safeParse(document);
    if (parsed.success) {
      input.onEvent?.({ type: "canvas.open", document: { ...parsed.data, slides: [] } });
      for (const slide of parsed.data.slides) {
        if (input.signal?.aborted) break;
        input.onEvent?.({ type: "canvas.slide", slide });
      }
      document = parsed.data;
    }
  }

  let liveAi = false;
  if (document && presented && aureliusStatus().ready && !input.signal?.aborted) {
    try {
      const refined = await refineWithModel({
        message: input.message,
        history: input.history ?? [],
        document,
        signal: input.signal
      });
      if (refined) {
        liveAi = true;
        document = refined;
        input.onEvent?.({ type: "canvas.replace", document: refined });
      }
    } catch {
      liveAi = false;
    }
  }

  if (document && presented) {
    input.onEvent?.({ type: "canvas.complete", document });
  }
  input.onEvent?.({ type: "done", reply, liveAi, presented });
  return { reply, liveAi, presented, document: presented ? document : input.document };
}
