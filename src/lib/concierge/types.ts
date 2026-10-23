import type { z } from "zod";
import type { presentationDraftSchema, slideSchema, presentationThemeSchema } from "./schema";

export type SlideLayout = z.infer<typeof slideSchema>["layout"];
export type PresentationTheme = z.infer<typeof presentationThemeSchema>;
export type PresentationSlide = z.infer<typeof slideSchema>;
export type PresentationDocument = z.infer<typeof presentationDraftSchema>;

export type ConciergeHistoryItem = {
  role: "user" | "assistant";
  content: string;
};

export type ConciergeStreamEvent =
  | { type: "user"; text: string }
  | { type: "delta"; text: string }
  | { type: "canvas.open"; document: PresentationDocument }
  | { type: "canvas.slide"; slide: PresentationSlide }
  | { type: "canvas.replace"; document: PresentationDocument }
  | { type: "canvas.complete"; document: PresentationDocument }
  | { type: "done"; reply: string; liveAi: boolean; presented: boolean }
  | { type: "error"; message: string };

export type BusinessKind =
  | "barber"
  | "salon"
  | "studio"
  | "shop"
  | "clinic"
  | "restaurant"
  | "practice"
  | "service"
  | "unknown";

export type BusinessSketch = {
  name?: string;
  kind: BusinessKind;
  place?: string;
  qualities: string[];
  raw: string;
};

export type PartialPresentation = {
  version?: 1;
  id?: string;
  title?: string;
  thesis?: string;
  theme?: Partial<PresentationTheme>;
  slides?: Array<Partial<PresentationSlide> & { id?: string; layout?: PresentationSlide["layout"] }>;
};
