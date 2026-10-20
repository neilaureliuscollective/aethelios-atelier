import { describe, expect, it } from "vitest";
import { PALETTES } from "@/lib/discovery/catalog";
import { CLIENT_ARTWORK_PALETTE, LIFESTYLE_PALETTE } from "@/lib/cofounder/composition";

function luminance(hex: string) {
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
describe("artifact text contrast on solid text panels", () => {
  const palettes = [CLIENT_ARTWORK_PALETTE, LIFESTYLE_PALETTE, ...Object.values(PALETTES).map(({vars}) => ({canvas: vars.bg, ink: vars.text, muted: vars.muted}))];
  it.each(palettes)("keeps headline and body readable on $canvas", palette => {
    expect(contrast(palette.canvas, palette.ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.canvas, palette.muted)).toBeGreaterThanOrEqual(4.5);
  });
});
