#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3012";
const OUT = process.env.ATELIER_SCREENSHOT_DIR ?? "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

async function signIn(email) {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  await page.evaluate(async (value) => {
    await fetch("/api/session/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: value })
    });
  }, email);
}

async function shot(name, { fullPage = false } = {}) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage });
  console.log("wrote", file);
}

async function visit(pathname) {
  await page.goto(`${BASE}${pathname}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 280));
}

const viewports = [
  { width: 320, height: 720, name: "320" },
  { width: 390, height: 844, name: "390" },
  { width: 768, height: 1024, name: "768" },
  { width: 884, height: 1100, name: "884" },
  { width: 1440, height: 900, name: "1440" }
];

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await visit("/companion");
await shot("atelier-signin-390.png");

await signIn("owner.local@atelier.invalid");
await visit("/companion");

await page.evaluate(async () => {
  const workspace = await fetch("/api/companion/workspace").then((r) => r.json());
  const businessId = workspace.business.id;
  await fetch("/api/companion/workspace", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      businessId,
      fields: {
        name: { value: "Cedar & Stone", kind: "confirmed" },
        audience: { value: "Homeowners who want lasting timber work", kind: "confirmed" },
        services: { value: "Custom timber porches", kind: "confirmed" },
        tone: { value: "Quiet, precise, local", kind: "preference" }
      }
    })
  });
  const copies = [
    { title: "Evening gathering", body: "Aethelios Lifestyle dinner under warm workshop light." },
    { title: "Porch season announcement", body: "Custom timber porches for the coming season." },
    { title: "A long title that should wrap instead of colliding with nearby chrome in the library", body: "Keep the exact wording." }
  ];
  const created = [];
  for (const copy of copies) {
    const work = await fetch("/api/companion/work", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId, title: copy.title, body: copy.body })
    }).then((r) => r.json());
    created.push(work.item ?? work);
  }
  const layouts = ["square_announcement", "portrait_social", "story_portrait", "website_banner"];
  for (const [index, layout] of layouts.entries()) {
    const copy = copies[index % copies.length];
    await fetch("/api/companion/studio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        businessId,
        headline: copy.title,
        body: copy.body,
        layout,
        workItemId: created[index % created.length]?.id
      })
    });
  }
  await fetch("/api/companion/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Follow up on the announcement", detail: "Call after the dinner draft is reviewed." })
  });
});

for (const viewport of viewports) {
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  for (const [route, slug] of [
    ["/companion", "today"],
    ["/companion/business", "business"],
    ["/companion/talk", "talk"],
    ["/companion/work", "work"],
    ["/companion/studio", "studio"]
  ]) {
    await visit(route);
    await shot(`atelier-${slug}-${viewport.name}.png`);
  }
}

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await visit("/companion/talk");
await page.click("#talk-input");
await page.type("#talk-input", "Help me announce the porch season.");
await shot("atelier-talk-keyboard-390.png");

await visit("/companion/studio");
await page.waitForSelector("#headline");
await page.click("#headline");
await shot("atelier-studio-keyboard-390.png");

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await visit("/companion/work");
await shot("atelier-work-library-1440.png");
await shot("atelier-work-library-1440-full.png", { fullPage: true });

await visit("/companion/studio");
await shot("atelier-studio-artboard-1440.png");

await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
await visit("/companion");
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await shot("atelier-signed-out-1440.png");

await browser.close();
console.log("atelier workspace captures complete");
