import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import type { BusinessSketch, SitePreview } from "./types";

const HTML_START = /<!doctype html|<html[\s>]/i;

export function extractSiteHtml(raw: string) {
  const fenced = raw.match(/```(?:html)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced || raw.trim();
  const start = candidate.search(HTML_START);
  if (start < 0) return null;
  const html = candidate.slice(start).trim();
  if (!html.toLowerCase().includes("</html>")) return null;
  return html;
}

export function labeledSitePreview(input: {
  id?: string;
  title: string;
  html: string;
  model: string;
}): SitePreview | null {
  const html = extractSiteHtml(input.html);
  if (!html) return null;
  return {
    version: 1,
    id: input.id ?? `preview_${Math.random().toString(36).slice(2, 10)}`,
    title: input.title,
    html,
    model: input.model,
    labeled: "illustrative_sketch"
  };
}

export async function generateSitePreview(input: {
  message: string;
  sketch: BusinessSketch;
  existing?: SitePreview | null;
  signal?: AbortSignal;
}): Promise<SitePreview | null> {
  const status = aureliusStatus();
  if (!status.ready) return null;
  const config = loadConfig();
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: config.openAiKey, timeout: 120_000 });
  const model = config.openAiCodeModel;
  const name = input.sketch.name || input.sketch.kind;
  const place = input.sketch.place ? ` in ${input.sketch.place}` : "";
  const qualities = input.sketch.qualities.length
    ? ` Qualities they asked for: ${input.sketch.qualities.join(", ")}.`
    : "";
  const response = await client.responses.create(
    {
      model,
      reasoning: { effort: "medium" },
      instructions: [
        `You are ${INTELLIGENCE_DISPLAY_NAME}, writing a single-file website for an in-app device-frame preview.`,
        "Return one complete HTML document only: <!doctype html> through </html>.",
        "Inline CSS in a <style> tag. Optional script must stay inside this document.",
        "No remote scripts, no remote fonts, no remote images, no forms that post off-origin.",
        "This is an illustrative sketch, not a finished website, quote, booking tool, or commission.",
        "Never invent prices, client results, testimonials, or completed work.",
        "Do not mention that you are an AI. Use the business facts that were given."
      ].join(" "),
      input: [
        {
          role: "user",
          content: [
            `Business: ${name}${place}.${qualities}`,
            `Founder message:\n${input.message}`,
            input.existing?.html
              ? `Revise this existing sketch. Keep it a complete HTML document.\n${input.existing.html}`
              : "Write a distinctive one-page site that could belong to this business."
          ].join("\n\n")
        }
      ]
    },
    { signal: input.signal }
  );
  const raw =
    typeof response.output_text === "string"
      ? response.output_text
      : JSON.stringify(response);
  return labeledSitePreview({
    id: input.existing?.id,
    title: `${name}${place} · sketch`,
    html: raw,
    model
  });
}
