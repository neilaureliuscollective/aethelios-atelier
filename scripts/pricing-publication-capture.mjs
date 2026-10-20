#!/usr/bin/env node
/**
 * Public pricing publication and Partnership contrast proof.
 * Unauthenticated. Distinguishes displayed USD amounts from payment enablement.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_PRICING_OUT ?? "/opt/cursor/artifacts/pricing-publication";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: Boolean(ok), extra: extra ? String(extra).slice(0, 280) : "" });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` ${String(extra).slice(0, 180)}` : ""}`);
}

function srgb(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb) {
  return 0.2126 * srgb(rgb[0]) + 0.7152 * srgb(rgb[1]) + 0.0722 * srgb(rgb[2]);
}

function contrastRatio(a, b) {
  const left = luminance(a);
  const right = luminance(b);
  const lighter = Math.max(left, right);
  const darker = Math.min(left, right);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseCssColor(value) {
  const rgb = String(value).match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  const srgbMatch = String(value).match(/color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i);
  if (srgbMatch) {
    return [
      Math.round(Number(srgbMatch[1]) * 255),
      Math.round(Number(srgbMatch[2]) * 255),
      Math.round(Number(srgbMatch[3]) * 255)
    ];
  }
  return null;
}

function sampleInterior(png, yRatio = 0.45) {
  const samples = [];
  const y0 = Math.floor(png.height * Math.min(0.82, Math.max(0.12, yRatio - 0.08)));
  const y1 = Math.floor(png.height * Math.min(0.86, Math.max(0.16, yRatio + 0.08)));
  const x0 = Math.floor(png.width * 0.18);
  const x1 = Math.floor(png.width * 0.82);
  const stepX = Math.max(3, Math.floor((x1 - x0) / 8));
  const stepY = Math.max(3, Math.floor(Math.max(1, y1 - y0) / 4));
  for (let y = y0; y <= y1; y += stepY) {
    for (let x = x0; x <= x1; x += stepX) {
      const cx = Math.max(0, Math.min(png.width - 1, x));
      const cy = Math.max(0, Math.min(png.height - 1, y));
      const i = (cy * png.width + cx) * 4;
      samples.push([png.data[i], png.data[i + 1], png.data[i + 2]]);
    }
  }
  if (!samples.length) return [8, 12, 11];
  samples.sort((a, b) => luminance(a) - luminance(b));
  // Dark fill of the card, not light text glyphs or ivory corner bleed.
  return samples[Math.floor(samples.length * 0.2)] ?? samples[0];
}

function isLightCanvas(rgb) {
  return luminance(rgb) >= 0.45;
}

async function paintedBackground(page, selector, yRatio = 0.45, expectDark = true) {
  const handle = await page.$(selector);
  if (!handle) return null;
  await handle.evaluate((el) => el.scrollIntoView({ block: "center", inline: "nearest" }));
  await new Promise((resolve) => setTimeout(resolve, 120));

  let painted = null;
  try {
    const buffer = await handle.screenshot({ type: "png" });
    painted = sampleInterior(PNG.sync.read(buffer), yRatio);
  } catch {
    painted = null;
  }

  if (!painted || (expectDark && isLightCanvas(painted))) {
    const box = await handle.boundingBox();
    const viewport = page.viewport();
    if (box && viewport) {
      const padX = Math.min(24, Math.max(8, box.width * 0.12));
      const padY = Math.min(28, Math.max(8, box.height * 0.18));
      const clip = {
        x: Math.max(0, box.x + padX),
        y: Math.max(0, box.y + padY),
        width: Math.max(4, Math.min(box.width - padX * 2, viewport.width - Math.max(0, box.x + padX))),
        height: Math.max(4, Math.min(box.height - padY * 2, viewport.height - Math.max(0, box.y + padY)))
      };
      if (clip.width >= 4 && clip.height >= 4) {
        const buffer = await page.screenshot({ type: "png", clip, captureBeyondViewport: false });
        const retry = sampleInterior(PNG.sync.read(buffer), yRatio);
        if (!expectDark || !isLightCanvas(retry)) painted = retry;
      }
    }
  }

  return painted;
}

function aaThreshold(fontSizePx, fontWeight) {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && Number(fontWeight) >= 700);
  return large ? 3 : 4.5;
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

try {
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

  async function measure(label) {
    const css = await page.evaluate((wanted) => {
      const partnership = document.querySelector("[data-pricing-plan='partnership']");
      if (!partnership) return { error: "missing partnership card" };
      const target =
        wanted === "eyebrow"
          ? partnership.querySelector("[data-pricing-eyebrow]")
          : wanted === "setup"
            ? partnership.querySelector("[data-pricing-charge='setup']")
            : wanted === "ongoing"
              ? partnership.querySelector("[data-pricing-charge='ongoing']")
              : wanted === "amount"
                ? partnership.querySelector("[data-pricing-amount='ongoing']")
                : wanted === "relationship"
                  ? partnership.querySelector(".lede-bright, .muted")
                  : wanted === "button"
                    ? partnership.querySelector("a.btn")
                    : null;
      if (!(target instanceof HTMLElement)) return { error: `missing ${wanted}` };
      const style = getComputedStyle(target);
      return {
        text: target.textContent?.trim() ?? "",
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        outline: `${style.outlineColor} ${style.outlineStyle} ${style.outlineWidth}`
      };
    }, label);
    if (css.error) return css;
    const painted = await paintedBackground(
      page,
      label === "button" ? "[data-pricing-plan='partnership'] a.btn" : "[data-pricing-plan='partnership']",
      label === "button" ? 0.72 : 0.42,
      true
    );
    return { ...css, painted };
  }

  async function shot(name, width, height = width <= 390 ? 844 : 1100) {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const file = path.join(OUT, `${name}-${width}w.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  }

  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle0" });
  const body = await page.evaluate(() => document.body.innerText);
  check("unauthenticated public page shows Atelier amounts", /\$299 one-time setup/.test(body) && /\$249\/month/.test(body));
  check("unauthenticated public page shows Connected amounts", /\$499 one-time setup/.test(body) && /\$399\/month/.test(body));
  check("Partnership monthly is published and setup stays quoted", /Setup quoted/.test(body) && /\$699\/month/.test(body));
  const chargeText = await page.evaluate(() =>
    [...document.querySelectorAll("[data-pricing-amount]")].map((el) => el.textContent || "").join(" | ")
  );
  check("quoted setup is not zero", !/\$0(?:\b|\/)|0 one-time setup/.test(chargeText), chargeText);
  check("payments remain uncollected", /not collected/i.test(body));
  check("no isolated review banner", !/Isolated local review|Draft pricing pending/i.test(body));
  check("no unpublished-price contradiction", !/displayed prices are unpublished|unpublished commercial structure/i.test(body));
  check("no internal founder-decision commentary", !/differentiation is still a founder decision/i.test(body));
  await shot("public-pricing", 1440);
  const plansGrid = await page.$(".pricing-plan-grid");
  if (plansGrid) {
    await plansGrid.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    await plansGrid.screenshot({ path: path.join(OUT, "public-pricing-plans-1440w.png") });
  }
  await page.evaluate(() => document.querySelector("[data-pricing-plan='partnership']")?.scrollIntoView({ block: "start" }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  await page.screenshot({
    path: path.join(OUT, "public-pricing-partnership-1440w.png"),
    fullPage: false
  });
  await shot("public-pricing", 390);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const plansGridMobile = await page.$(".pricing-plan-grid");
  if (plansGridMobile) {
    await plansGridMobile.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await new Promise((resolve) => setTimeout(resolve, 150));
    await plansGridMobile.screenshot({ path: path.join(OUT, "public-pricing-plans-390w.png") });
  }
  await page.evaluate(() => document.querySelector("[data-pricing-plan='partnership']")?.scrollIntoView({ block: "start" }));
  await new Promise((resolve) => setTimeout(resolve, 150));
  await page.screenshot({
    path: path.join(OUT, "public-pricing-partnership-390w.png"),
    fullPage: false
  });

  const contrastRows = [];
  for (const width of [1440, 390]) {
    // Keep the mobile *width* for media queries, but use a tall viewport so the
    // stacked Partnership card is fully paintable. Phone-height shots are taken above.
    await page.setViewport({ width, height: width <= 390 ? 2800 : 1400, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle0" });
    await page.evaluate(() => document.querySelector("[data-pricing-plan='partnership']")?.scrollIntoView({ block: "center" }));
    await new Promise((resolve) => setTimeout(resolve, 160));
    for (const label of ["eyebrow", "setup", "ongoing", "amount", "relationship", "button"]) {
      const measured = await measure(label);
      if (measured.error) {
        check(`${width}w ${label} measurable`, false, measured.error);
        continue;
      }
      const fg = parseCssColor(measured.color);
      const bg = measured.painted;
      if (!fg) {
        check(`${width}w Partnership ${label} color readable`, false, measured.color);
        continue;
      }
      if (!bg || isLightCanvas(bg)) {
        check(`${width}w Partnership ${label} painted on dark card`, false, bg ? `sampled light rgb(${bg.join(",")})` : "no paint sample");
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      const size = Number.parseFloat(measured.fontSize);
      const needed = label === "button" ? 4.5 : aaThreshold(size, measured.fontWeight);
      contrastRows.push({
        viewport: width,
        label,
        text: measured.text,
        color: measured.color,
        background: `rgb(${bg.join(",")})`,
        ratio: Number(ratio.toFixed(2)),
        needed,
        fontSize: measured.fontSize
      });
      check(
        `${width}w Partnership ${label} contrast ${ratio.toFixed(2)}:1 (need ${needed}:1)`,
        ratio + 1e-6 >= needed,
        `${measured.color} on rgb(${bg.join(",")})`
      );
    }

    const focus = await page.evaluate(() => {
      const partnership = document.querySelector("[data-pricing-plan='partnership']");
      const button = partnership?.querySelector("a.btn");
      if (!(button instanceof HTMLElement)) return { error: "missing button" };
      button.focus();
      const style = getComputedStyle(button);
      return {
        focused: document.activeElement === button,
        outline: `${style.outlineColor} ${style.outlineStyle} ${style.outlineWidth}`,
        color: style.color,
        background: style.backgroundColor
      };
    });
    check(`${width}w Partnership discuss control is keyboard-focusable`, Boolean(focus.focused), focus.outline);
    const outline = parseCssColor(focus.outline || "");
    const cardPaint = await paintedBackground(page, "[data-pricing-plan='partnership']", 0.42, true);
    if (outline && cardPaint && !isLightCanvas(cardPaint)) {
      const ratio = contrastRatio(outline, cardPaint);
      check(`${width}w Partnership focus ring contrast ${ratio.toFixed(2)}:1`, ratio >= 3, focus.outline);
      contrastRows.push({
        viewport: width,
        label: "focus-ring",
        text: focus.outline,
        color: focus.outline,
        background: `rgb(${cardPaint.join(",")})`,
        ratio: Number(ratio.toFixed(2)),
        needed: 3
      });
    } else {
      check(`${width}w Partnership focus ring is visible`, /solid|auto/i.test(focus.outline || ""), focus.outline);
    }

    const hover = await page.evaluate(async () => {
      const button = document.querySelector("[data-pricing-plan='partnership'] a.btn");
      if (!(button instanceof HTMLElement)) return { error: "missing button" };
      button.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
      const style = getComputedStyle(button);
      return { color: style.color, border: style.borderColor };
    });
    const hoverFg = parseCssColor(hover.color || "");
    const hoverBtn = await paintedBackground(page, "[data-pricing-plan='partnership'] a.btn", 0.72, true);
    if (hoverFg && hoverBtn && !isLightCanvas(hoverBtn)) {
      const ratio = contrastRatio(hoverFg, hoverBtn);
      check(`${width}w Partnership hover button contrast ${ratio.toFixed(2)}:1`, ratio >= 4.5, `${hover.color} on rgb(${hoverBtn.join(",")})`);
      contrastRows.push({
        viewport: width,
        label: "button-hover",
        text: "Discuss this plan",
        color: hover.color,
        background: `rgb(${hoverBtn.join(",")})`,
        ratio: Number(ratio.toFixed(2)),
        needed: 4.5
      });
    }
  }

  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector(".pricing-hero a.btn-gold")?.scrollIntoView({ block: "center" }));
  await new Promise((resolve) => setTimeout(resolve, 160));
  const gold = await page.evaluate(() => {
    const goldBtn = document.querySelector(".pricing-hero a.btn-gold");
    if (!(goldBtn instanceof HTMLElement)) return { error: "missing gold button" };
    const style = getComputedStyle(goldBtn);
    return { color: style.color, text: goldBtn.textContent?.trim() };
  });
  const goldFg = parseCssColor(gold.color);
  const goldBg = await paintedBackground(page, ".pricing-hero a.btn-gold", 0.7, false);
  if (goldFg && goldBg) {
    const ratio = contrastRatio(goldFg, goldBg);
    check(`gold button text contrast ${ratio.toFixed(2)}:1`, ratio >= 4.5, `${gold.color} on rgb(${goldBg.join(",")})`);
    contrastRows.push({
      viewport: 1440,
      label: "gold-button",
      text: gold.text,
      color: gold.color,
      background: `rgb(${goldBg.join(",")})`,
      ratio: Number(ratio.toFixed(2)),
      needed: 4.5
    });
  } else {
    check("gold button colors measurable", false, JSON.stringify(gold));
  }

  fs.writeFileSync(path.join(OUT, "contrast.json"), JSON.stringify({ results: contrastRows, gold }, null, 2));
} catch (error) {
  check("pricing publication capture completed", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const failed = results.filter((item) => !item.ok);
console.log(`\npricing-publication-capture: ${results.filter((item) => item.ok).length}/${results.length} passed`);
console.log(`Evidence: ${OUT}`);
if (failed.length) process.exit(1);
