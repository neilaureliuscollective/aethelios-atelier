#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3011";
const OUT = process.env.ATELIER_CAPTURE_DIR ?? "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,1100"]
});
const page = await browser.newPage();
const mp4 = [];
page.on("request", (request) => {
  if (request.url().includes(".mp4")) mp4.push({ url: request.url(), at: Date.now() });
});

async function shot(name, width, height, url, after) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0" });
  if (after) await after(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log("captured", name);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await shot("after_home_showcase_desktop", 1440, 1100, "/", async (p) => {
  await p.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "center" }));
  await wait(1800);
});

const desktopAudit = await page.evaluate(() => {
  const section = document.querySelector("#selected-work");
  const lede = section?.querySelector("[class*='copyLede']");
  const video = section?.querySelector("video");
  const control = section?.querySelector("[data-film-control]");
  const watch = Array.from(section?.querySelectorAll("a,button") ?? []).map((node) => node.textContent?.trim());
  const style = lede ? getComputedStyle(lede) : null;
  const bg = section ? getComputedStyle(section).backgroundColor : "";
  return {
    playing: video && !video.paused && !video.ended && video.currentTime > 0,
    muted: video?.muted ?? null,
    src: video?.currentSrc ?? "",
    attached: section?.querySelector("[data-src-attached]")?.getAttribute("data-src-attached"),
    filmPlaying: section?.querySelector("[data-film-playing]")?.getAttribute("data-film-playing"),
    control: control?.textContent?.trim() ?? null,
    actions: watch,
    ledeColor: style?.color ?? null,
    sectionBg: bg,
    hasDialog: Boolean(document.querySelector("dialog")),
    currentTime: video?.currentTime ?? null
  };
});

await shot("after_home_showcase_phone", 390, 844, "/", async (p) => {
  await p.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "start" }));
  await wait(1600);
});
await shot("after_home_showcase_phone_title", 390, 844, "/", async (p) => {
  await p.evaluate(() => {
    const section = document.querySelector("#selected-work");
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo(0, Math.max(0, top));
  });
  await wait(1200);
});

const phoneAudit = await page.evaluate(() => {
  const section = document.querySelector("#selected-work");
  const lede = section?.querySelector("[class*='copyLede']");
  const video = section?.querySelector("video");
  const buttons = Array.from(section?.querySelectorAll("a.btn, button.btn, [data-film-control]") ?? []).map((node) =>
    node.textContent?.trim()
  );
  const order = Array.from(section?.querySelectorAll("h2, [class*='copyLede'], [data-film-surface], a.btn") ?? []).map(
    (node) => node.tagName + ":" + (node.textContent ?? "").trim().slice(0, 40)
  );
  return {
    playing: video && !video.paused && video.currentTime > 0,
    ledeColor: lede ? getComputedStyle(lede).color : null,
    buttons,
    order
  };
});

await shot("after_home_showcase_fold", 280, 653, "/", async (p) => {
  await p.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "start" }));
  await wait(1200);
});

await shot("after_salon_hero_desktop", 1440, 900, "/services/barbers-salons");
await shot("after_salon_hero_phone", 390, 844, "/services/barbers-salons");
await shot("after_salon_work_desktop", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#real-work")?.scrollIntoView({ block: "center" }));
  await wait(1600);
});

const loopSeam = await page.goto(`${BASE}/`, { waitUntil: "networkidle0" }).then(async () => {
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  return page.evaluate(async () => {
    const video = document.querySelector("#selected-work video");
    if (!video) return { ok: false };
    const waitReady = () =>
      new Promise((resolve) => {
        if (video.readyState >= 2) {
          resolve(true);
          return;
        }
        video.addEventListener("loadeddata", () => resolve(true), { once: true });
      });
    await waitReady();
    const times = [];
    for (const target of [32.9, 0.12, 32.95]) {
      video.currentTime = target;
      await new Promise((resolve) => video.addEventListener("seeked", resolve, { once: true }));
      times.push({ at: video.currentTime, paused: video.paused });
    }
    return { ok: true, duration: video.duration, times, src: video.currentSrc };
  });
});

writeFileSync(
  `${OUT}/cinematic-audit.json`,
  JSON.stringify({ desktopAudit, phoneAudit, loopSeam, mp4: mp4.slice(0, 8), mp4Count: mp4.length }, null, 2)
);
console.log(JSON.stringify({ desktopAudit, phoneAudit, loopSeam, mp4Count: mp4.length }, null, 2));
await browser.close();
