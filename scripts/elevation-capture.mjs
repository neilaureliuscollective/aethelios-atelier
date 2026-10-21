#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_CAPTURE_DIR ?? "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,1100"]
});
const page = await browser.newPage();
const mp4Requests = [];

page.on("request", (request) => {
  const url = request.url();
  if (url.includes(".mp4") || url.includes("cinematic-showcase")) {
    mp4Requests.push({ url, type: request.resourceType(), at: Date.now() });
  }
});

async function shot(name, width, height, url, after) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0" });
  if (after) await after(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

await shot("after_home_desktop_1440", 1440, 1100, "/");
await shot("after_home_selected_work_1440", 1440, 1100, "/", async (p) => {
  await p.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "start" }));
});
await shot("after_home_phone_390", 390, 844, "/");
await shot("after_home_fold_280", 280, 653, "/");

const beforePlay = mp4Requests.length;
await shot("after_home_dialog_poster", 1440, 1100, "/", async (p) => {
  await p.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "start" }));
  const open = await p.$("[data-showcase-open]");
  if (open) await open.click();
  await new Promise((resolve) => setTimeout(resolve, 400));
});
const afterOpen = mp4Requests.length;

await shot("after_home_dialog_play", 1440, 1100, "/", async (p) => {
  await p.evaluate(() => document.querySelector("#selected-work")?.scrollIntoView({ block: "start" }));
  const open = await p.$("[data-showcase-open]");
  if (open) await open.click();
  await new Promise((resolve) => setTimeout(resolve, 300));
  const play = await p.evaluateHandle(() => {
    const dialog = document.querySelector("dialog[open]");
    return dialog?.querySelector("button.btn-gold");
  });
  const playEl = play.asElement();
  if (playEl) await playEl.click();
  await new Promise((resolve) => setTimeout(resolve, 1200));
});
const afterPlay = mp4Requests.length;

await shot("after_barbers_hero_desktop", 1440, 1100, "/services/barbers-salons");
await shot("after_barbers_real_work_desktop", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#real-work")?.scrollIntoView({ block: "start" }));
});
await shot("after_barbers_hero_phone", 390, 844, "/services/barbers-salons");
await shot("after_barbers_demo_story", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#demonstration")?.scrollIntoView({ block: "start" }));
});
await shot("after_barbers_demo_gallery", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#demonstration")?.scrollIntoView({ block: "start" }));
  const buttons = await p.$$(".barbers-demo-nav button");
  if (buttons[1]) await buttons[1].click();
  await new Promise((resolve) => setTimeout(resolve, 250));
});
await shot("after_barbers_demo_services", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#demonstration")?.scrollIntoView({ block: "start" }));
  const buttons = await p.$$(".barbers-demo-nav button");
  if (buttons[2]) await buttons[2].click();
  await new Promise((resolve) => setTimeout(resolve, 250));
});
await shot("after_barbers_demo_book", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#demonstration")?.scrollIntoView({ block: "start" }));
  const buttons = await p.$$(".barbers-demo-nav button");
  const last = buttons[buttons.length - 1];
  if (last) await last.click();
  await new Promise((resolve) => setTimeout(resolve, 250));
});
await shot("after_services_preview", 1440, 1100, "/services", async (p) => {
  await p.evaluate(() => document.querySelector("#website")?.scrollIntoView({ block: "start" }));
});
await shot("after_brief_source_desktop", 1440, 1100, "/project?source=fix_it_shop");
await shot("after_brief_specialist_desktop", 1440, 1100, "/project?offer=barbers_salons&interest=website&purpose=business&booking=1&source=fix_it_shop");

const report = {
  mp4BeforeDialog: beforePlay,
  mp4AfterDialogOpen: afterOpen,
  mp4AfterPlay: afterPlay,
  requests: mp4Requests
};
writeFileSync(`${OUT}/elevation-network.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
