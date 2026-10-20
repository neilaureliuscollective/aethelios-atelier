#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { PNG } from "pngjs";

const RASTER_TOLERANCE = 2;

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3010";
const SHOTS = process.env.ATELIER_SCREENSHOT_DIR ?? "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,900"]
});
const page = await browser.newPage();

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

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
}

await page.setViewport({ width: 1440, height: 900 });
await signIn("owner.local@atelier.invalid");

await page.goto(`${BASE}/companion/business`, { waitUntil: "networkidle0" });
await page.waitForSelector("textarea");
const fields = await page.$$("textarea");
if (fields[0]) {
  await fields[0].click({ clickCount: 3 });
  await fields[0].type("Cedar & Stone");
}
if (fields[2]) {
  await fields[2].click({ clickCount: 3 });
  await fields[2].type("Custom timber porches");
}
const saveProfile = await page.$("button.btn-gold");
if (saveProfile) await saveProfile.click();
await page.waitForFunction(() => document.body.innerText.includes("Confirmed facts") || document.body.innerText.includes("saved"));
check("business profile saved", (await page.content()).includes("Cedar") || (await page.content()).includes("Confirmed"));
await shot("companion-business-1440.png");

await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await page.waitForSelector("#talk-input");
await page.type("#talk-input", "Help me announce my new service.");
await Promise.all([
  page.click("button[type=submit]"),
  page.waitForFunction(() => document.body.innerText.includes("not a live AI reply") || document.body.innerText.includes("Work"))
]);
const talk = await page.content();
check("talk stays honest without live OpenAI", talk.includes("not a live AI reply") || talk.includes("unavailable"));
check("talk offers a saved-work continuation", talk.includes("Work") || talk.includes("Studio"));
await shot("companion-talk-1440.png");

await page.goto(`${BASE}/companion/work`, { waitUntil: "networkidle0" });
check("work shows saved copy", (await page.content()).includes("Saved work"));
await shot("companion-work-1440.png");

await page.goto(`${BASE}/companion/work`, { waitUntil: "networkidle0" });
await page.waitForSelector("input.field, aside input");
await page.evaluate(async () => {
  const workspace = await fetch("/api/companion/workspace").then((response) => response.json());
  const businessId = workspace.business.id;
  await fetch("/api/companion/work", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId, title: "Porch season", body: "Custom timber porches." })
  });
  await fetch("/api/companion/work", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ businessId, title: "Evening gathering", body: "Aethelios Lifestyle dinner." })
  });
});
await page.reload({ waitUntil: "networkidle0" });
const workLinks = await page.$$eval("a[href*='workItemId=']", (nodes) =>
  nodes.map((node) => ({
    href: node.getAttribute("href") || "",
    title: node.closest(".surface-read")?.querySelector("h3")?.textContent?.trim() || ""
  }))
);
const porch = workLinks.find((item) => item.title.includes("Porch season"));
const evening = workLinks.find((item) => item.title.includes("Evening gathering"));
check("two distinct work items can open Studio", Boolean(porch && evening && porch.href !== evening.href));
if (!porch || !evening) {
  await browser.close();
  process.exit(1);
}

await page.goto(`${BASE}${porch.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => {
  const field = document.querySelector("#headline");
  return field && field.value.includes("Porch season");
});
const firstHeadline = await page.$eval("#headline", (node) => node.value);
check("first work item opens its exact copy", firstHeadline.includes("Porch season"));

await page.goto(`${BASE}${evening.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => {
  const field = document.querySelector("#headline");
  return field && field.value.includes("Evening gathering");
});
const secondHeadline = await page.$eval("#headline", (node) => node.value);
check("second work item does not inherit the first Studio draft", secondHeadline.includes("Evening gathering"));
check("incorrect first-draft fallback is absent", !secondHeadline.includes("Porch season"));
await page.waitForFunction(() => document.querySelector("#studio-draft")?.value, { timeout: 15000 });
const studio = await page.content();
check("studio editor is present", studio.includes("Brand Studio") && studio.includes("Generate image"));
check("studio has draft selector and layouts", studio.includes("Saved draft") && studio.includes("Portrait social"));
await page.waitForFunction(() => {
  const canvas = document.querySelector("[data-studio-preview='canvas']");
  return canvas && canvas.width >= 1080;
}, { timeout: 15000 }).catch(() => null);
const metrics1440 = await page.evaluate(() => {
  const box = document.querySelector("[data-preview-scale]");
  const canvas = document.querySelector("[data-studio-preview='canvas']");
  const errors = [...document.querySelectorAll(".notice-warn")].map((node) => node.textContent || "").join(" ");
  return {
    previewWidth: Number(box?.getAttribute("data-preview-width") || 0),
    previewScale: Number(box?.getAttribute("data-preview-scale") || 0),
    headlinePx: Number(box?.getAttribute("data-headline-preview-px") || 0),
    canvasWidth: canvas?.width || 0,
    canvasHeight: canvas?.height || 0,
    errors
  };
});
check("preview canvas uses full composition pixels at 1440", metrics1440.canvasWidth >= 1080, JSON.stringify(metrics1440));
check(
  "preview scale tracks displayed width at 1440",
  metrics1440.previewScale > 0 &&
    metrics1440.previewWidth > 0 &&
    Math.abs(metrics1440.previewScale - metrics1440.previewWidth / metrics1440.canvasWidth) < 0.05
);
check("preview headline is large enough to read at 1440", metrics1440.headlinePx >= 12);
check("studio has no error overlay at 1440", !/error|failed|500/i.test(metrics1440.errors));
await page.click("#headline", { clickCount: 3 });
await page.keyboard.press("Backspace");
await page.type("#headline", "Evening gathering — saved", { delay: 15 });
await page.waitForFunction(() =>
  [...document.querySelectorAll("button")].some((node) => /Save layers/.test(node.textContent || ""))
);
const saveResponse = page.waitForResponse(
  (response) => response.url().includes("/api/companion/studio") && response.request().method() === "PATCH",
  { timeout: 20000 }
);
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => /Save layers/.test(node.textContent || ""));
  button?.click();
});
const savedHttp = await saveResponse;
check("browser save writes the edited draft", savedHttp.ok(), String(savedHttp.status()));
const previewRaster = await page.evaluate(() => {
  const canvas = document.querySelector("[data-studio-preview='canvas']");
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: canvas.width, height: canvas.height, pixels: Array.from(image.data) };
});
const exportResponse = page.waitForResponse(
  (response) => response.url().includes("/api/companion/studio/export") && response.request().method() === "POST",
  { timeout: 30000 }
);
await page.waitForFunction(() =>
  [...document.querySelectorAll("button")].some((node) => (node.textContent || "").trim() === "Export" && !node.disabled)
);
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => (node.textContent || "").trim() === "Export");
  button?.click();
});
const exportedHttp = await exportResponse;
const exportedJson = await exportedHttp.json().catch(() => ({}));
check(
  "browser export binds the revision and file",
  exportedHttp.ok() &&
    Boolean(exportedJson.exported?.assetUrl) &&
    exportedJson.exported?.asset?.compositionRevisionId === exportedJson.exported?.revision?.id,
  JSON.stringify({ status: exportedHttp.status(), revision: exportedJson.exported?.revision?.id })
);
await page.waitForFunction(() => document.body.innerText.includes("Exported"), { timeout: 8000 }).catch(() => null);
await shot("companion-studio-1440.png");
await shot("companion-studio-exported-1440.png");

await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
await signIn("owner.local@atelier.invalid");
await page.goto(`${BASE}/companion/work`, { waitUntil: "networkidle0" });
const workAfterReturn = await page.content();
check(
  "work lists the exported artifact after sign-in",
  workAfterReturn.includes("Download finished file") && workAfterReturn.includes("Evening gathering")
);
const downloadHref = await page.$$eval("a[href*='/api/companion/assets/']", (nodes) => {
  const match = nodes.find((node) => node.closest(".surface-read")?.textContent?.includes("Evening gathering"));
  return (match ?? nodes[0])?.getAttribute("href") || "";
});
const downloaded = await page.evaluate(async (href) => {
  const response = await fetch(href);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    status: response.status,
    type: response.headers.get("content-type") || "",
    length: bytes.byteLength,
    png: bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71,
    hash: Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join(""),
    bytes: Array.from(bytes)
  };
}, downloadHref);
const again = await page.evaluate(async (href) => {
  const response = await fetch(href);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return {
    status: response.status,
    hash: Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("")
  };
}, downloadHref);
check(
  "fresh session downloads the same exported PNG",
  downloaded.status === 200 && downloaded.png && downloaded.length > 1000,
  JSON.stringify({ status: downloaded.status, length: downloaded.length, hash: downloaded.hash })
);
check("reopen is byte-for-byte identical", again.status === 200 && again.hash === downloaded.hash, downloaded.hash);
let rasterDelta = Number.POSITIVE_INFINITY;
let exportRaster = { width: 0, height: 0 };
try {
  const decoded = PNG.sync.read(Buffer.from(downloaded.bytes), { checkCRC: true });
  exportRaster = { width: decoded.width, height: decoded.height };
  if (previewRaster && previewRaster.pixels.length === decoded.data.length) {
    rasterDelta = 0;
    for (let i = 0; i < decoded.data.length; i += 1) {
      const delta = Math.abs((previewRaster.pixels[i] ?? 0) - (decoded.data[i] ?? 0));
      if (delta > rasterDelta) rasterDelta = delta;
    }
  }
} catch (error) {
  rasterDelta = Number.POSITIVE_INFINITY;
  exportRaster = { width: 0, height: 0, error: String(error) };
}
check(
  "preview and export pixels match within rasterization tolerance 2",
  Boolean(previewRaster) &&
    previewRaster.width === exportRaster.width &&
    previewRaster.height === exportRaster.height &&
    rasterDelta <= RASTER_TOLERANCE,
  `delta=${rasterDelta} preview=${previewRaster?.width}x${previewRaster?.height} export=${exportRaster.width}x${exportRaster.height}`
);
await shot("companion-work-exported-1440.png");
globalThis.__atelierExportedAsset = downloadHref;

await page.setViewport({ width: 884, height: 1100 });
await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await shot("companion-talk-884.png");
await page.goto(`${BASE}${evening.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("[data-studio-preview='canvas']")?.width >= 1080, { timeout: 15000 }).catch(() => null);
const metrics884 = await page.evaluate(() => {
  const canvas = document.querySelector("[data-studio-preview='canvas']");
  const headlinePx = Number(document.querySelector("[data-headline-preview-px]")?.getAttribute("data-headline-preview-px") || 0);
  const headline = document.querySelector("#headline")?.value || "";
  return { canvasWidth: canvas?.width || 0, headlinePx, headline };
});
check("preview canvas stays full-resolution at 884", metrics884.canvasWidth >= 1080);
check("preview headline remains readable at 884", metrics884.headlinePx >= 12 && metrics884.headline.includes("Evening gathering"));
await shot("companion-studio-884.png");
check("tablet grid stacks or remains usable", (await page.content()).includes("Brand Studio"));

await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}/companion/business`, { waitUntil: "networkidle0" });
check("business profile on phone", (await page.content()).includes("Business context"));
await shot("companion-business-390.png");
await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await page.waitForSelector("#talk-input");
await page.focus("#talk-input");
await shot("companion-talk-390-keyboard.png");
await page.goto(`${BASE}${evening.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("[data-studio-preview='canvas']")?.width >= 1080, { timeout: 15000 }).catch(() => null);
const metrics390 = await page.evaluate(() => ({
  headlinePx: Number(document.querySelector("[data-headline-preview-px]")?.getAttribute("data-headline-preview-px") || 0),
  headline: document.querySelector("#headline")?.value || ""
}));
check("preview headline remains readable at 390", metrics390.headlinePx >= 12 && metrics390.headline.includes("Evening gathering"));
await shot("companion-studio-390.png");
await page.goto(`${BASE}/companion`, { waitUntil: "networkidle0" });
check("today requires signed-in owner", (await page.content()).includes("owner.local@atelier.invalid") || (await page.content()).includes("Cedar"));
await shot("companion-today-390.png");

await page.setViewport({ width: 1440, height: 900 });
await page.reload({ waitUntil: "networkidle0" });
check("reload keeps the signed-in workspace", (await page.content()).includes("owner.local@atelier.invalid") || (await page.content()).includes("Today"));

await page.goto(`${BASE}${evening.href}`, { waitUntil: "networkidle0" });
for (const format of [
  { id: "square_announcement", width: 1080, height: 1080 },
  { id: "portrait_social", width: 1080, height: 1350 },
  { id: "story_portrait", width: 1080, height: 1920 },
  { id: "website_banner", width: 1600, height: 900 }
]) {
  await page.select("#studio-layout", format.id);
  await page
    .waitForFunction(
      (width, height) => {
        const canvas = document.querySelector("[data-studio-preview='canvas']");
        return canvas && canvas.width === width && canvas.height === height;
      },
      { timeout: 10000 },
      format.width,
      format.height
    )
    .catch(() => null);
  const size = await page.evaluate(() => {
    const canvas = document.querySelector("[data-studio-preview='canvas']");
    return { width: canvas?.width || 0, height: canvas?.height || 0 };
  });
  check(
    `preview canvas matches ${format.id}`,
    size.width === format.width && size.height === format.height,
    JSON.stringify(size)
  );
}

await signIn("owner-two.local@atelier.invalid");
await page.goto(`${BASE}/companion`, { waitUntil: "networkidle0" });
const other = await page.content();
check("second owner has their own companion", other.includes("owner-two.local@atelier.invalid"));
check("second owner does not see first owner email", !other.includes("owner.local@atelier.invalid"));
if (globalThis.__atelierExportedAsset) {
  const denied = await page.evaluate(async (href) => {
    const response = await fetch(href);
    return response.status;
  }, globalThis.__atelierExportedAsset);
  check("second owner cannot download the exported file", denied === 401 || denied === 403 || denied === 404, String(denied));
}
const ownerBusinessId = new URL(globalThis.__atelierExportedAsset || "http://local/?businessId=", "http://local").searchParams.get("businessId");
await signIn("neil.local@atelier.invalid");
if (ownerBusinessId) {
  const founderWrite = await page.evaluate(async (businessId) => {
    const response = await fetch("/api/companion/workspace", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ businessId, fields: { services: { value: "Hijack", kind: "confirmed" } } })
    });
    return response.status;
  }, ownerBusinessId);
  check("founder cannot mutate a client workspace", founderWrite === 403, String(founderWrite));
}

await browser.close();
const failed = results.filter((item) => !item.ok);
if (failed.length) {
  console.error(`companion-browser failed ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`companion-browser passed ${results.length}`);
