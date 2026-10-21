#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3011";
const OUT = process.env.ATELIER_CAPTURE_DIR ?? "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function contrast(rgbA, rgbB) {
  const parse = (value) =>
    (value.match(/[\d.]+/g) ?? []).slice(0, 3).map((n) => {
      const c = Number(n) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  const lum = (rgb) => {
    const [r, g, b] = parse(rgb);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(rgbA);
  const b = lum(rgbB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--autoplay-policy=no-user-gesture-required"]
});

const results = {};

{
  const page = await browser.newPage();
  const mp4 = [];
  page.on("request", (request) => {
    if (request.url().includes(".mp4")) mp4.push(request.url());
  });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  const beforeScroll = mp4.length;
  await page.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "center" }));
  await wait(2000);
  const afterVisible = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    const lede = document.querySelector("#selected-work [class*='copyLede']");
    const section = document.querySelector("#selected-work");
    const sample = document.createElement("canvas");
    return {
      playing: Boolean(video && !video.paused && video.currentTime > 0.2),
      muted: video?.muted ?? false,
      src: video?.currentSrc ?? "",
      currentTime: video?.currentTime ?? 0,
      control: document.querySelector("[data-film-control]")?.textContent?.trim() ?? null,
      watch: Boolean(document.querySelector("[data-showcase-open]")),
      ledeColor: lede ? getComputedStyle(lede).color : null,
      sectionColor: section ? getComputedStyle(section).color : null,
      canvas: Boolean(sample)
    };
  });
  const pausedAt = afterVisible.currentTime;
  await page.click("[data-film-control]");
  await wait(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(800);
  await page.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "center" }));
  await wait(1200);
  const afterUserPause = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return {
      playing: Boolean(video && !video.paused),
      userPaused: document.querySelector("[data-user-paused]")?.getAttribute("data-user-paused"),
      control: document.querySelector("[data-film-control]")?.textContent?.trim() ?? null,
      currentTime: video?.currentTime ?? 0
    };
  });
  await page.click("[data-film-control]");
  await wait(800);
  const afterResume = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return {
      playing: Boolean(video && !video.paused && video.currentTime > 0),
      currentTime: video?.currentTime ?? 0
    };
  });
  await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    if (video) video.currentTime = Math.max(0, video.duration - 0.2);
  });
  await wait(1500);
  const afterLoop = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return { currentTime: video?.currentTime ?? 0, playing: Boolean(video && !video.paused) };
  });
  const lede = afterVisible.ledeColor;
  results.normal = {
    beforeScrollMp4: beforeScroll,
    afterMp4: mp4.length,
    afterVisible,
    afterUserPause,
    afterResume,
    afterLoop,
    pausedAt,
    contrastVsObsidian: lede ? contrast(lede, "rgb(8, 12, 11)") : null
  };
  await page.close();
}

{
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  const mp4 = [];
  page.on("request", (request) => {
    if (request.url().includes(".mp4")) mp4.push(request.url());
  });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "start" }));
  await wait(1500);
  const reduced = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return {
      src: video?.getAttribute("src") || video?.currentSrc || "",
      playing: Boolean(video && !video.paused && video.currentTime > 0),
      fallback: document.querySelector("[data-film-fallback]")?.getAttribute("data-film-fallback"),
      control: document.querySelector("[data-film-control]")?.textContent?.trim() ?? null
    };
  });
  const beforePlay = mp4.length;
  if (await page.$("[data-film-control]")) {
    await page.click("[data-film-control]");
    await wait(1500);
  }
  const afterPlay = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return {
      playing: Boolean(video && !video.paused && video.currentTime > 0),
      src: video?.currentSrc ?? ""
    };
  });
  results.reducedMotion = { reduced, beforePlay, afterPlayCount: mp4.length, afterPlay };
  await page.close();
}

{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/services/barbers-salons`, { waitUntil: "networkidle0" });
  const headline = await page.evaluate(() => document.querySelector("h2")?.textContent ?? "");
  results.specialist = { headline };
  await page.close();
}

writeFileSync(`${OUT}/cinematic-behavior.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
