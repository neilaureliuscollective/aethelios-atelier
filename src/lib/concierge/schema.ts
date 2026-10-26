import { z } from "zod";
import { BEGIN_HREF } from "@/lib/publicSite";
import { discoveryBriefSchema } from "./brief";

export const SLIDE_LAYOUTS = [
  "hero",
  "manifesto",
  "split",
  "stats",
  "timeline",
  "quote",
  "path",
  "next"
] as const;

export const CONCIERGE_CTA_HREFS = [BEGIN_HREF, "/inquire", "/approach", "/services"] as const;

export const slideSchema = z.object({
  id: z.string().min(1).max(40),
  layout: z.enum(SLIDE_LAYOUTS),
  kicker: z.string().max(80).optional(),
  headline: z.string().max(160).optional(),
  subhead: z.string().max(240).optional(),
  body: z.string().max(600).optional(),
  bullets: z.array(z.string().max(160)).max(6).optional(),
  columns: z
    .array(
      z.object({
        title: z.string().max(80),
        body: z.string().max(280)
      })
    )
    .max(3)
    .optional(),
  stats: z
    .array(
      z.object({
        value: z.string().max(24),
        label: z.string().max(80)
      })
    )
    .max(4)
    .optional(),
  steps: z
    .array(
      z.object({
        title: z.string().max(80),
        body: z.string().max(200)
      })
    )
    .max(5)
    .optional(),
  quote: z.string().max(280).optional(),
  attribution: z.string().max(80).optional(),
  cta: z
    .object({
      label: z.string().max(48),
      href: z.enum(CONCIERGE_CTA_HREFS)
    })
    .optional(),
  enter: z.enum(["rise", "fade", "split", "none"]).default("rise"),
  emphasis: z.enum(["none", "headline", "stat", "quote"]).default("none")
});

export const presentationThemeSchema = z.object({
  mood: z.enum(["obsidian", "ember", "aurora"]),
  accent: z.enum(["gold", "emerald", "ivory"]),
  density: z.enum(["cinematic", "editorial"])
});

export const presentationDraftSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(120),
  thesis: z.string().min(1).max(280),
  theme: presentationThemeSchema,
  slides: z.array(slideSchema).max(8)
});

export const presentationSchema = presentationDraftSchema.refine((value) => value.slides.length > 0, {
  message: "A finished presentation needs at least one slide."
});

export const conciergeHistorySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000)
});

export const sitePreviewSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1),
  html: z.string().min(1),
  model: z.string().min(1),
  labeled: z.literal("illustrative_sketch")
});

/** Turns of history the talk endpoint accepts; the brief carries everything older. */
export const CONCIERGE_HISTORY_LIMIT = 16;

export const conciergeTalkRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(conciergeHistorySchema).max(CONCIERGE_HISTORY_LIMIT).optional(),
  brief: discoveryBriefSchema.optional(),
  turn: z.number().int().min(0).max(200).optional(),
  document: presentationSchema.optional(),
  preview: sitePreviewSchema.optional(),
  compose: z.boolean().optional()
});
