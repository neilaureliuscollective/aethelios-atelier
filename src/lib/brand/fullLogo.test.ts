import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FULL_LOGO, FULL_LOGO_ASPECT } from "@/lib/brand/fullLogo";

function pngHeader(path: string) {
  const bytes = readFileSync(path);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];
  return { width, height, colorType, bytes };
}

describe("full hero logo", () => {
  it("keeps the supplied original and a transparent hero derivative", () => {
    const original = pngHeader("public/brand/original/logo.png");
    const hero = pngHeader("public/brand/logo.png");
    const lockup = pngHeader("public/brand/atelier-lockup.png");
    expect(original.width).toBe(1254);
    expect(original.height).toBe(1254);
    expect(original.colorType).toBe(2);
    expect(hero.width).toBe(FULL_LOGO.width);
    expect(hero.height).toBe(FULL_LOGO.height);
    expect(hero.colorType).toBe(6);
    expect(lockup.colorType).toBe(6);
    expect(FULL_LOGO_ASPECT).toBeCloseTo(1212 / 1187, 5);
  });

  it("seats the full lockup as the cinematic hero mark", () => {
    const hero = readFileSync("src/components/marketing/CinematicHero.tsx", "utf8");
    const header = readFileSync("src/components/shell/SiteHeader.tsx", "utf8");
    const mark = readFileSync("src/components/brand/BrandMark.tsx", "utf8");
    expect(hero).toContain("hero-mark");
    expect(hero).toContain("FULL_LOGO.src");
    expect(header).toContain("FULL_LOGO.lockupSrc");
    expect(mark).toContain("FULL_LOGO.src");
    expect(mark).not.toContain("1192 / 1160");
  });
});
