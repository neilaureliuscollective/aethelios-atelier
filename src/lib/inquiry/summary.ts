import { briefTitle, displayFieldValue, FIELD_LABELS } from "@/lib/brief";
import { BRIEF_FIELD_KEYS, type Brief } from "@/lib/types";
import { sanitizeMultiline, sanitizePlainText } from "@/lib/discovery/sanitize";

export const INQUIRY_LIMITS = {
  name: 120,
  email: 160,
  business: 160,
  need: 4000,
  field: 800,
  honey: 80
} as const;

export type InquiryBriefLine = {
  key: string;
  label: string;
  value: string;
};

export function summarizeBrief(input: unknown): { title: string; lines: InquiryBriefLine[] } | null {
  if (!input || typeof input !== "object") return null;
  const brief = input as Brief;
  const lines: InquiryBriefLine[] = [];
  for (const key of BRIEF_FIELD_KEYS) {
    const field = brief[key];
    const raw = typeof field?.value === "string" ? field.value : "";
    const value = sanitizeMultiline(raw, INQUIRY_LIMITS.field).trim();
    if (!value) continue;
    lines.push({
      key,
      label: FIELD_LABELS[key],
      value: displayFieldValue(key, value)
    });
  }
  if (!lines.length) return null;
  return {
    title: sanitizePlainText(briefTitle(brief), 160) || "Project brief",
    lines
  };
}

export function formatInquiryText(input: {
  name: string;
  email: string;
  business: string;
  need: string;
  source: string;
  brief?: { title: string; lines: InquiryBriefLine[] } | null;
}): string {
  const lines = [
    `From: ${input.name} <${input.email}>`,
    input.business ? `Business: ${input.business}` : "",
    `Source: ${input.source}`,
    "",
    input.need,
    ""
  ];
  if (input.brief) {
    lines.push(`Brief: ${input.brief.title}`, "");
    for (const line of input.brief.lines) {
      lines.push(`${line.label}: ${line.value}`, "");
    }
  }
  return lines.filter((line, index, all) => !(line === "" && all[index - 1] === "")).join("\n").trim();
}

export function buildMailtoHref(destination: string, input: { subject: string; body: string }): string {
  const params = new URLSearchParams();
  params.set("subject", input.subject);
  params.set("body", input.body);
  return `mailto:${encodeURIComponent(destination)}?${params.toString()}`;
}
