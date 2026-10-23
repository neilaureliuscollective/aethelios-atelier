import { aetheliosCanvasPrompt } from "@/lib/aethelios/persona";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import { composePresentation, composeReply } from "./compose";
import { containsForbiddenPayload } from "./contract";
import { extractBusinessSketch } from "./extract";
import { shouldOpenCanvas } from "./intent";
import { mergePresentation } from "./merge";
import { presentationSchema } from "./schema";
import { generateSitePreview } from "./sitePreview";
import type { ConciergeHistoryItem, ConciergeStreamEvent, PresentationDocument, SitePreview } from "./types";

export type ConciergeTalkInput = {
  message: string;
  history?: ConciergeHistoryItem[];
  document?: PresentationDocument;
  preview?: SitePreview;
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
      reasoning_effort: "low",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: aetheliosCanvasPrompt()
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

  let preview = presented ? input.preview : undefined;
  if (presented && aureliusStatus().ready && !input.signal?.aborted) {
    input.onEvent?.({ type: "preview.open" });
    try {
      const next = await generateSitePreview({
        message: input.message,
        sketch,
        existing: input.preview,
        signal: input.signal
      });
      if (next) {
        liveAi = true;
        preview = next;
        input.onEvent?.({ type: "preview.ready", preview: next });
      }
    } catch {
      preview = input.preview;
    }
  }

  if (document && presented) {
    input.onEvent?.({ type: "canvas.complete", document });
  }
  input.onEvent?.({ type: "done", reply, liveAi, presented });
  return { reply, liveAi, presented, document: presented ? document : input.document, preview };
}
