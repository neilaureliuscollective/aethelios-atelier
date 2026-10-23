import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { salonAssetPaths, SALON_INDUSTRY_ASSETS } from "@/lib/industry/assets";
import { VALE_CROWN_DEMO } from "@/lib/offers/demo";
import { FIX_IT_SHOP } from "@/lib/work/fixItShop";

const ATMOSPHERE = ["/atmosphere/hearth.webp", "/atmosphere/storefront.webp", "/atmosphere/colonnade.webp"];

describe("Fix It Shop showcase record", () => {
  it("keeps verified public destinations and a 20:13 silent master", () => {
    expect(FIX_IT_SHOP.liveHref).toBe("https://fixitshop-app.vercel.app/");
    expect(FIX_IT_SHOP.bookingHref).toBe("https://fixitshop.glossgenius.com/");
    expect(FIX_IT_SHOP.inquireHref).toBe("/project?source=fix_it_shop");
    expect(FIX_IT_SHOP.specialistInquireHref).toContain("offer=barbers_salons");
    expect(FIX_IT_SHOP.specialistInquireHref).toContain("source=fix_it_shop");
    expect(FIX_IT_SHOP.media.width / FIX_IT_SHOP.media.height).toBeCloseTo(20 / 13, 5);
    expect(FIX_IT_SHOP.media.silent).toBe(true);
    expect(FIX_IT_SHOP.media.loopSrc).toBe("/work/fix-it-shop/cinematic-loop.mp4");
    expect(FIX_IT_SHOP.media.width).toBe(1280);
    expect(FIX_IT_SHOP.videoDescription).toMatch(/silent presentation/i);
    expect(FIX_IT_SHOP.videoDescription).toMatch(/illustrative/i);
  });

  it("ships the attached master, a loop derivative, and a reserved poster", () => {
    const master = "public/work/fix-it-shop/cinematic-showcase.mp4";
    const loop = "public/work/fix-it-shop/cinematic-loop.mp4";
    const poster = "public/work/fix-it-shop/poster.webp";
    expect(existsSync(master)).toBe(true);
    expect(existsSync(loop)).toBe(true);
    expect(existsSync(poster)).toBe(true);
    expect(existsSync("public/work/fix-it-shop/poster.jpg")).toBe(true);
    expect(statSync(master).size).toBeGreaterThan(8_000_000);
    expect(statSync(loop).size).toBeGreaterThan(1_000_000);
    expect(statSync(loop).size).toBeLessThan(4_500_000);
    expect(statSync(loop).size).toBeLessThan(statSync(master).size);
    expect(statSync(poster).size).toBeGreaterThan(20_000);
    expect(statSync(poster).size).toBeLessThan(400_000);
  });
});

describe("salon industry imagery", () => {
  it("uses a distinct salon set and does not reuse atmosphere architecture", () => {
    const paths = [
      SALON_INDUSTRY_ASSETS.specialistHero.src,
      VALE_CROWN_DEMO.storyImage.src,
      ...VALE_CROWN_DEMO.gallery.map((item) => item.src)
    ];
    expect(new Set(paths).size).toBe(5);
    expect(paths).toEqual(expect.arrayContaining(salonAssetPaths()));
    for (const path of paths) {
      expect(ATMOSPHERE).not.toContain(path);
      expect(existsSync(`public${path}`)).toBe(true);
    }
    const hero = readFileSync("src/app/services/barbers-salons/page.tsx", "utf8");
    const assets = readFileSync("src/lib/industry/assets.ts", "utf8");
    const demo = readFileSync("src/lib/offers/demo.ts", "utf8");
    const vale = readFileSync("src/components/marketing/barbers/ValeCrownDemo.tsx", "utf8");
    expect(hero).toContain("SALON_INDUSTRY_ASSETS.specialistHero");
    expect(hero).toContain("A presence as considered as the work.");
    expect(hero).not.toContain("A real website, before the illustrative direction.");
    expect(assets).toContain("/industry/salon-hero.webp");
    expect(hero).not.toContain("/atmosphere/hearth");
    expect(demo).not.toMatch(/hearth|storefront|colonnade/);
    expect(vale).toContain("storyImage");
    expect(vale).not.toContain("gallery[0]");
  });
});

describe("inline cinematic playback", () => {
  it("plays the loop inline without a modal-first Watch path", () => {
    const source = readFileSync("src/components/work/SelectedWork.tsx", "utf8");
    expect(source).toContain('preload="none"');
    expect(source).toContain("video.src = project.media.loopSrc");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("visibilitychange");
    expect(source).toContain("prefers-reduced-motion");
    expect(source).toContain("video.muted = true");
    expect(source).toContain("playsInline");
    expect(source).toContain("isMeaningfullyVisible");
    expect(source).toMatch(/\bloop\b/);
    expect(source).not.toMatch(/currentTime\s*=/);
    expect(source).not.toMatch(/<dialog/);
    expect(source).not.toMatch(/Watch the experience/);
    expect(source).not.toMatch(/showModal/);
    expect(source).not.toMatch(/<source[^>]+cinematic-(showcase|loop)\.mp4/);
    expect(source).not.toMatch(/autoPlay|autoplay/);
    const sw = readFileSync("public/sw.js", "utf8");
    expect(sw).not.toMatch(/\.mp4|\/work\//);
    expect(sw).toMatch(/\/brand\//);
  });

  it("places the homepage showcase after the hero and before possibilities", () => {
    const home = readFileSync("src/app/page.tsx", "utf8");
    expect(home.indexOf("<ConciergeStage")).toBeLessThan(home.indexOf("<AtelierManifesto"));
    expect(home.indexOf("<AtelierManifesto")).toBeLessThan(home.indexOf('variant="featured"'));
    expect(home.indexOf('variant="featured"')).toBeLessThan(home.indexOf("<PossibilitiesStage"));
    expect(home).toContain("SelectedWork");
    const manifesto = readFileSync("src/components/marketing/AtelierManifesto.tsx", "utf8");
    expect(manifesto).toContain('href="#selected-work"');
    expect(manifesto).toContain("serviceBriefHref");
  });

  it("keeps specialist hero shading local and lighter than the main Atelier wash", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const specialist = css.slice(css.indexOf(".barbers-hero {"), css.indexOf(".barbers-showcase"));
    expect(specialist).toMatch(/object-position:\s*8%\s*62%/);
    expect(specialist).toContain(".barbers-hero .cinematic-shade");
    expect(specialist).toContain(".barbers-hero .cinematic-copy::before");
    expect(specialist).not.toMatch(/0\.78/);
    expect(specialist).not.toMatch(/0\.5\)/);
    const globalShade = css.slice(css.indexOf(".cinematic-shade {"), css.indexOf(".cinematic-copy {"));
    expect(globalShade).toMatch(/0\.72/);
  });
});

describe("Acadiana marketing mockups", () => {
  it("shows fictional Lafayette businesses on the cinema stage", () => {
    const examples = readFileSync("src/components/marketing/ExampleBusinesses.tsx", "utf8");
    const hero = readFileSync("src/components/marketing/HeroShowcase.tsx", "utf8");
    expect(examples).toContain("Coteau Field");
    expect(examples).toContain("Nightjar Roast");
    expect(examples).toContain("Coteau Yard");
    expect(examples).toContain("Sable Hearth");
    expect(examples).toContain("Lafayette");
    expect(examples).toContain("/atmosphere/coteau-field.webp");
    expect(hero).toContain("Coteau Field");
    expect(hero).not.toContain("Northridge");
    expect(examples).not.toMatch(/>Northridge</);
    expect(examples).not.toContain("Halcyon Still");
    expect(examples).not.toContain("Marlow Studio");
    expect(examples).not.toContain("Harbor Relay");
  });
});
