#!/usr/bin/env node
/**
 * Lab Web Vitals from a headed-equivalent Chromium session.
 * These are lab measurements, not real-user field results.
 * HTTP fetch timings remain in measure-perf.mjs and are not LCP/INP/CLS.
 */
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const viewport = { width: 1440, height: 1100, deviceScaleFactor: 1 };

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});
const page = await browser.newPage();
await page.setViewport(viewport);
await page.emulateNetworkConditions({
  offline: false,
  download: ((1.6 * 1024 * 1024) / 8),
  upload: ((750 * 1024) / 8),
  latency: 150
});
await page.emulateCPUThrottling(4);
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

await page.evaluateOnNewDocument(() => {
  window.__atelierVitals = { lcp: null, cls: 0, inp: null };
  new PerformanceObserver((list) => {
    const last = list.getEntries().at(-1);
    if (last) window.__atelierVitals.lcp = last.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) window.__atelierVitals.cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
  new PerformanceObserver((list) => {
    const last = list.getEntries().at(-1);
    if (last && "duration" in last) window.__atelierVitals.inp = last.duration;
  }).observe({ type: "event", buffered: true, durationThreshold: 16 });
});

async function measure(path) {
  const started = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 1200));
  const vitals = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    return {
      ...window.__atelierVitals,
      ttfb: nav?.responseStart ?? null,
      dcl: nav?.domContentLoadedEventEnd ?? null,
      load: nav?.loadEventEnd ?? null
    };
  });
  return { path, elapsedMs: Date.now() - started, ...vitals, kind: "lab" };
}

const home = await measure("/");
const project = await measure("/project");
await page.$eval("textarea", (el) => {
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  const started = performance.now();
  proto?.set?.call(el, "Typing responsiveness sample for the local candidate.");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  window.__atelierTypingMs = performance.now() - started;
});
const typingMs = await page.evaluate(() => window.__atelierTypingMs);
await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
const navStart = Date.now();
await page.click("a[href='/']");
await page.waitForSelector("h1");
const navMs = Date.now() - navStart;

const report = {
  at: new Date().toISOString(),
  note: "Lab Web Vitals under 1440x1100, Slow 4G-like 1.6Mbps/150ms RTT, 4x CPU throttle. Not field RUM.",
  viewport,
  network: "slow-4g-lab",
  cpuThrottle: 4,
  home,
  project,
  typingDispatchMs: typingMs,
  homeNavigationMs: navMs
};
fs.mkdirSync("/opt/cursor/artifacts", { recursive: true });
fs.writeFileSync("/opt/cursor/artifacts/lab-web-vitals.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
