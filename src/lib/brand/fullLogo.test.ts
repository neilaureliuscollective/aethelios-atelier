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

describe("official lockup", () => {
  it("keeps the supplied original and a transparent lockup derivative", () => {
    const original = pngHeader("public/brand/original/logo.png");
    const hero = pngHeader("public/brand/logo.png");
    const lockup = pngHeader("public/brand/atelier-lockup.png");
    const mark = pngHeader("public/brand/mark.png");
    expect(original.width).toBe(1155);
    expect(original.height).toBe(1362);
    expect(hero.width).toBe(FULL_LOGO.width);
    expect(hero.height).toBe(FULL_LOGO.height);
    expect(hero.colorType).toBe(6);
    expect(lockup.colorType).toBe(6);
    expect(mark.colorType).toBe(6);
    expect(FULL_LOGO_ASPECT).toBeCloseTo(1155 / 1206, 5);
  });

  it("seats the lockup on the quiet premium surfaces", () => {
    const hero = readFileSync("src/components/marketing/CinematicHero.tsx", "utf8");
    const header = readFileSync("src/components/shell/SiteHeader.tsx", "utf8");
    const footer = readFileSync("src/components/shell/SiteFooter.tsx", "utf8");
    const mark = readFileSync("src/components/brand/BrandMark.tsx", "utf8");
    const about = readFileSync("src/app/about/page.tsx", "utf8");
    expect(hero).toContain("hero-mark");
    expect(hero).toContain("FULL_LOGO.lockupSrc");
    expect(header).toContain("FULL_LOGO.lockupSrc");
    expect(footer).toContain('variant="lockup"');
    expect(about).toContain("brand-seal");
    expect(mark).toContain("FULL_LOGO.lockupSrc");
    expect(mark).toContain("FULL_LOGO.markSrc");
  });
});
