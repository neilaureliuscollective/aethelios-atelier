/** Homepage artwork, motion preference, and conversation-entry regression. */
import assert from "node:assert/strict";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
try {
  for (const width of [390, 768, 1440]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900 });
    await page.goto(process.env.ATELIER_BASE ?? "http://127.0.0.1:3000", { waitUntil: "networkidle0" });
    const image = await page.$('img[src="/atmosphere/atelier-hero.webp"]');
    assert.ok(image, "Hero image is rendered");
    await page.waitForFunction(() => {
      const img = document.querySelector('img[src="/atmosphere/atelier-hero.webp"]');
      return img?.complete && img.naturalWidth > 0;
    });
    const state = await image.evaluate(img => ({
      source: img.currentSrc, alt: img.alt, priority: img.fetchPriority,
      animation: getComputedStyle(img.parentElement).animationName,
      overflow: document.documentElement.scrollWidth > innerWidth
    }));
    assert.ok(state.source.endsWith(width <= 540 ? "atelier-hero-mobile.webp" : "atelier-hero.webp"));
    assert.ok(state.alt.length > 0);
    assert.equal(state.priority, "high");
    assert.equal(state.overflow, false);
    assert.notEqual(state.animation, "none");
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    assert.equal(await image.evaluate(img => getComputedStyle(img.parentElement).animationName), "none");
    if (process.env.ATELIER_PREVIEW_DIR) {
      await page.screenshot({ path: `${process.env.ATELIER_PREVIEW_DIR}/hero-${width}.png` });
    }
    await page.locator('button::-p-text(Let’s talk about your project)').click();
    assert.equal(await page.evaluate(() => document.activeElement?.id), "concierge-input");
    await page.locator('button::-p-text(A better website)').click();
    assert.equal(await page.$eval("#concierge-input", el => el.value), "I’d like a new website for my business. ");
    assert.equal(await page.$eval('a::-p-text(Prefer to enquire directly?)', a => a.getAttribute("href")), "/inquire");
    console.log(`PASS ${width}px: image loaded, correct source, no overflow, motion preference, CTA focus, starter, enquiry link`);
    await page.close();
  }
} finally {
  await browser.close();
}
