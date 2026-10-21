#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3012";
const OUT = process.env.ATELIER_CAPTURE_DIR ?? "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    if (request.url().includes(".mp4")) mp4.push({ url: request.url(), at: Date.now() });
  });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  const t0 = Date.now();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  const afterHero = Date.now() - t0;
  await page.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "center" }));
  const startWait = Date.now();
  await page.waitForFunction(() => {
    const video = document.querySelector("#selected-work video");
    return Boolean(video && !video.paused && video.currentTime > 0.15);
  }, { timeout: 8000 });
  const ttfmf = Date.now() - startWait;
  await wait(400);
  const playing = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    const quality = video.getVideoPlaybackQuality?.();
    const section = document.querySelector("#selected-work");
    const bg = section ? getComputedStyle(section).backgroundImage + " " + getComputedStyle(section).backgroundColor : "";
    return {
      playing: !video.paused && video.currentTime > 0,
      muted: video.muted,
      src: video.currentSrc,
      w: video.videoWidth,
      h: video.videoHeight,
      currentTime: video.currentTime,
      readyState: video.readyState,
      posterShown: Boolean(document.querySelector("#selected-work [class*='posterLayer']")),
      control: document.querySelector("[data-film-control]")?.textContent?.trim() ?? null,
      dropped: quality?.droppedVideoFrames ?? null,
      decoded: quality?.totalVideoFrames ?? null,
      sectionBg: bg,
      watch: Boolean(document.querySelector("[data-showcase-open]"))
    };
  });
  await page.screenshot({ path: `${OUT}/after_elevate_home_desktop.png`, fullPage: false });
  const beforeNudge = playing.currentTime;
  await page.evaluate(() => window.scrollBy(0, 40));
  await wait(300);
  await page.evaluate(() => window.scrollBy(0, -40));
  await wait(400);
  const afterNudge = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return { playing: !video.paused, currentTime: video.currentTime };
  });
  await page.click("[data-film-control]");
  await wait(250);
  const pausedAt = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return { paused: video.paused, currentTime: video.currentTime, poster: Boolean(document.querySelector("#selected-work [class*='posterLayer']")) };
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(400);
  await page.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "center" }));
  await wait(600);
  const pauseHeld = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return {
      paused: video.paused,
      userPaused: document.querySelector("[data-user-paused]")?.getAttribute("data-user-paused"),
      currentTime: video.currentTime,
      poster: Boolean(document.querySelector("#selected-work [class*='posterLayer']"))
    };
  });
  await page.click("[data-film-control]");
  await wait(500);
  const resumed = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return { playing: !video.paused, currentTime: video.currentTime };
  });
  await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    if (video) video.currentTime = Math.max(0, video.duration - 0.25);
  });
  await wait(900);
  const looped = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return { currentTime: video.currentTime, playing: !video.paused, duration: video.duration };
  });
  results.desktop = {
    afterHero,
    ttfmfMs: ttfmf,
    playing,
    beforeNudge,
    afterNudge,
    pausedAt,
    pauseHeld,
    resumed,
    looped,
    mp4: mp4.map((item) => item.url)
  };
  await page.close();
}

{
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const section = document.querySelector("#selected-work");
    if (!section) return;
    window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY - 72);
  });
  await wait(1600);
  await page.screenshot({ path: `${OUT}/after_elevate_home_phone.png`, fullPage: false });
  await page.setViewport({ width: 280, height: 653, deviceScaleFactor: 1 });
  await page.evaluate(() => {
    const section = document.querySelector("#selected-work");
    if (!section) return;
    window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY - 64);
  });
  await wait(800);
  await page.screenshot({ path: `${OUT}/after_elevate_home_fold.png`, fullPage: false });
  await page.close();
}

{
  const page = await browser.newPage();
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const mp4 = [];
  page.on("request", (request) => {
    if (request.url().includes(".mp4")) mp4.push(request.url());
  });
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "center" }));
  await wait(1200);
  const reduced = await page.evaluate(() => {
    const video = document.querySelector("#selected-work video");
    return {
      src: video.currentSrc || video.getAttribute("src") || "",
      playing: !video.paused && video.currentTime > 0,
      control: document.querySelector("[data-film-control]")?.textContent?.trim() ?? null
    };
  });
  const before = mp4.length;
  if (await page.$("[data-film-control]")) {
    await page.click("[data-film-control]");
    await wait(1200);
  }
  results.reducedMotion = {
    reduced,
    beforePlay: before,
    afterPlay: mp4.length,
    playing: await page.evaluate(() => {
      const video = document.querySelector("#selected-work video");
      return !video.paused && video.currentTime > 0;
    })
  };
  await page.close();
}

{
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/services/barbers-salons`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}/after_elevate_salon_hero_desktop.png`, fullPage: false });
  await page.evaluate(() => document.querySelector("#real-work")?.scrollIntoView({ block: "center" }));
  await wait(1600);
  await page.screenshot({ path: `${OUT}/after_elevate_editorial_desktop.png`, fullPage: false });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/services/barbers-salons`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.querySelector("#real-work")?.scrollIntoView({ block: "start" }));
  await wait(1000);
  await page.screenshot({ path: `${OUT}/after_elevate_editorial_phone.png`, fullPage: false });
  results.specialist = await page.evaluate(() => ({
    headline: document.querySelector("h2")?.textContent ?? "",
    ivory: Boolean(document.querySelector("[data-showcase-variant='editorial']"))
  }));
  await page.close();
}

writeFileSync(`${OUT}/cinematic-elevate-verify.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
