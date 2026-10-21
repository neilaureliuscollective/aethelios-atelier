import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

function mixHex(left: string, right: string, leftWeight: number) {
  const mixChannel = (start: number) => {
    const a = parseInt(left.slice(start, start + 2), 16);
    const b = parseInt(right.slice(start, start + 2), 16);
    return Math.round(a * leftWeight + b * (1 - leftWeight));
  };
  return `#${[1, 3, 5].map((start) => mixChannel(start).toString(16).padStart(2, "0")).join("")}`;
}

describe("mobile navigation contrast", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  const header = readFileSync("src/components/shell/SiteHeader.tsx", "utf8");

  it("keeps the dropdown on its own ivory-on-obsidian tokens so page --text cannot hide links", () => {
    const panel = css.match(/\.mobile-nav \{\n  \/\* Self-contained[\s\S]*?\n\}/);
    const links = css.match(/\.mobile-nav a,\n\.mobile-nav button \{[\s\S]*?\n\}/);
    expect(panel?.[0]).toMatch(/--mobile-nav-fg:\s*var\(--ivory\)/);
    expect(panel?.[0]).toMatch(/--mobile-nav-bg:/);
    expect(panel?.[0]).toMatch(/background:\s*var\(--mobile-nav-bg\)/);
    expect(panel?.[0]).toMatch(/color:\s*var\(--mobile-nav-fg\)/);
    expect(links?.[0]).toMatch(/color:\s*var\(--mobile-nav-fg\)/);
    expect(links?.[0]).not.toMatch(/color:\s*var\(--text\)/);
    expect(css).toMatch(/\.mobile-nav a\[aria-current="page"\]/);
    expect(css).toMatch(/\.mobile-nav \.mobile-nav-cta/);
    expect(css).toMatch(/\.mobile-nav\.open \{[\s\S]*overflow-y:\s*auto/);
  });

  it("would fail the reported dark-text-on-dark-panel pairing", () => {
    const obsidian = "#080c0b";
    const smoked = "#102e25";
    const ivory = "#f3f0e7";
    const panel = mixHex(obsidian, smoked, 0.92);
    expect(contrast(obsidian, panel)).toBeLessThan(1.3);
    expect(contrast(ivory, panel)).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#e2c988", panel)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a disclosure control, not an application menu", () => {
    expect(header).toContain('id={MOBILE_NAV_ID}');
    expect(header).toContain("aria-controls={MOBILE_NAV_ID}");
    expect(header).toContain("aria-expanded={open}");
    expect(header).toContain('hidden={!open}');
    expect(header).toContain('Escape');
    expect(header).toContain("(max-width: 720px)");
    expect(header).toContain('href="/account"');
    expect(header).toContain('href={user ? "/project/new" : "/project"}');
    expect(header).not.toMatch(/role=["']menu["']/);
    expect(header).not.toContain("menuitem");
  });
});
