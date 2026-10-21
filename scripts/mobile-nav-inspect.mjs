#!/usr/bin/env node
/**
 * Inspect the rendered mobile navigation: computed colors, contrast,
 * geometry, and a screenshot. This is a diagnostic helper, not CI.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { contrastRatio, parseColor } from "./lib/css-contrast.mjs";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const ROUTE = process.env.ATELIER_ROUTE ?? "/discover";
const WIDTH = Number(process.env.ATELIER_WIDTH ?? 390);
const HEIGHT = Number(process.env.ATELIER_HEIGHT ?? 844);
const LABEL = process.env.ATELIER_LABEL ?? "inspect";
const OUT = process.env.ATELIER_OUT ?? "docs/review/mobile-nav";

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.ATELIER_BROWSER_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});

const page = await browser.newPage();
page.setDefaultTimeout(20000);
await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });
await page.goto(`${BASE}${ROUTE}`, { waitUntil: "networkidle0" });

const surface = await page.evaluate(() => document.querySelector(".app-root")?.getAttribute("data-surface"));
const toggleVisible = await page.evaluate(() => {
  const toggle = document.querySelector(".menu-toggle");
  if (!toggle) return false;
  const style = getComputedStyle(toggle);
  return style.display !== "none" && style.visibility !== "hidden";
});

if (toggleVisible) {
  await page.click(".menu-toggle");
  await page.waitForSelector(".mobile-nav.open", { timeout: 4000 });
}

const report = await page.evaluate(() => {
  const root = document.querySelector(".app-root");
  const nav = document.querySelector(".mobile-nav");
  const toggle = document.querySelector(".menu-toggle");
  const links = [...(nav?.querySelectorAll("a") ?? [])];
  const first = links[0];
  const navStyle = nav ? getComputedStyle(nav) : null;
  const firstStyle = first ? getComputedStyle(first) : null;
  const toggleStyle = toggle ? getComputedStyle(toggle) : null;
  const navBox = nav?.getBoundingClientRect();
  const firstBox = first?.getBoundingClientRect();
  return {
    surface: root?.getAttribute("data-surface") ?? null,
    pathname: location.pathname,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    toggle: {
      expanded: toggle?.getAttribute("aria-expanded"),
      controls: toggle?.getAttribute("aria-controls"),
      display: toggleStyle?.display,
      color: toggleStyle?.color
    },
    nav: {
      open: nav?.classList.contains("open") ?? false,
      hidden: nav?.hasAttribute("hidden") ?? null,
      id: nav?.id ?? "",
      display: navStyle?.display,
      backgroundColor: navStyle?.backgroundColor,
      color: navStyle?.color,
      overflowX: navStyle?.overflowX,
      overflowY: navStyle?.overflowY,
      maxHeight: navStyle?.maxHeight,
      zIndex: navStyle?.zIndex,
      width: navBox?.width ?? 0,
      height: navBox?.height ?? 0,
      top: navBox?.top ?? 0,
      bottom: navBox?.bottom ?? 0,
      text: nav?.innerText?.replace(/\s+/g, " ").trim() ?? ""
    },
    firstLink: first
      ? {
          text: first.textContent?.trim() ?? "",
          href: first.getAttribute("href"),
          color: firstStyle?.color,
          backgroundColor: firstStyle?.backgroundColor,
          width: firstBox?.width ?? 0,
          height: firstBox?.height ?? 0,
          visible: Boolean(firstBox && firstBox.width > 0 && firstBox.height > 0)
        }
      : null,
    linkCount: links.length,
    linkLabels: links.map((link) => link.textContent?.trim())
  };
});

const navRgb = parseColor(report.nav.backgroundColor);
const linkRgb = parseColor(report.firstLink?.color);
const ratio = navRgb && linkRgb ? contrastRatio(linkRgb, navRgb) : null;

const screenshot = path.join(OUT, `${LABEL}-${WIDTH}x${HEIGHT}.png`);
await page.screenshot({ path: screenshot, fullPage: false });

const payload = {
  ...report,
  surface,
  contrast: ratio,
  contrastPass: ratio != null ? ratio >= 4.5 : false,
  screenshot
};

const jsonPath = path.join(OUT, `${LABEL}-${WIDTH}x${HEIGHT}.json`);
writeFileSync(jsonPath, JSON.stringify(payload, null, 2));
console.log(JSON.stringify(payload, null, 2));

await browser.close();
process.exit(ratio != null && ratio < 4.5 ? 2 : 0);
