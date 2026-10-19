import type { CSSProperties } from "react";
import { PALETTES, type PaletteId } from "@/lib/discovery";

export function paletteStyle(paletteId: PaletteId): CSSProperties {
  const vars = PALETTES[paletteId].vars;
  return {
    ["--c-bg" as string]: vars.bg,
    ["--c-surface" as string]: vars.surface,
    ["--c-surfaceStrong" as string]: vars.surfaceStrong,
    ["--c-text" as string]: vars.text,
    ["--c-muted" as string]: vars.muted,
    ["--c-accent" as string]: vars.accent,
    ["--c-accentText" as string]: vars.accentText,
    ["--c-border" as string]: vars.border,
    ["--c-cta" as string]: vars.cta,
    ["--c-cta-text" as string]: vars.ctaText,
    ["--c-rule" as string]: vars.rule
  };
}
