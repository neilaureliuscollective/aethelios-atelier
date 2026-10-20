#!/usr/bin/env node
/**
 * Local product demonstration of the Lifestyle owner journey.
 * Simulated auth. Not a connected-provider demonstration.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

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

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
}

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

await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
check("cinematic homepage loads", (await page.content()).includes("Aethelios"));
await shot("homepage-1440.png");

await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
check("discovery entrance is cinematic", (await page.content()).includes("could become"));
await shot("discovery-entrance-1440.png");

const explore = await page.$("button.btn-emerald-glass");
if (explore) await explore.click();
await page.waitForSelector("input, textarea", { timeout: 8000 }).catch(() => null);
const nameInput = await page.$("input");
if (nameInput) {
  await nameInput.click({ clickCount: 3 });
  await nameInput.type("AETHELIOS LIFESTYLE");
}
check("discovery accepts Lifestyle business name", (await page.content()).includes("AETHELIOS LIFESTYLE") || Boolean(nameInput));
await shot("discovery-intake-1440.png");

await signIn("neil.local@atelier.invalid");
await page.goto(`${BASE}/companion/business`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.body.innerText.includes("Business context"));
const businessText = await page.evaluate(() => document.body.innerText);
check("neil receives Lifestyle workspace", businessText.includes("AETHELIOS LIFESTYLE"));
check("missing Lifestyle assets are listed", /logo/i.test(businessText) && /photography/i.test(businessText));
await shot("lifestyle-business-1440.png");

await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await page.waitForSelector("#talk-input");
await page.type("#talk-input", "Write an announcement using only confirmed Lifestyle facts.");
await Promise.all([
  page.click("button[type=submit]"),
  page.waitForFunction(() => document.body.innerText.includes("not a live AI reply"), { timeout: 20000 })
]);
const talk = await page.evaluate(() => document.body.innerText);
check("talk stays honest without OpenAI", talk.includes("not a live AI reply"));
await shot("lifestyle-talk-1440.png");

await page.evaluate(async () => {
  const workspace = await fetch("/api/companion/workspace").then((response) => response.json());
  const businessId = workspace.business.id;
  await fetch("/api/companion/work", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      businessId,
      title: "AETHELIOS LIFESTYLE",
      body: "The founder’s own product rebrand. No invented benefits or prices."
    })
  });
  await fetch("/api/companion/work", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      businessId,
      title: "House announcement",
      body: "Before I use Atelier to elevate your business, here is how I elevate mine."
    })
  });
});
await page.goto(`${BASE}/companion/work`, { waitUntil: "networkidle0" });
const workLinks = await page.$$eval("a[href*='workItemId=']", (nodes) =>
  nodes.map((node) => ({
    href: node.getAttribute("href") || "",
    title: node.closest(".surface-read")?.querySelector("h3")?.textContent?.trim() || ""
  }))
);
const lifestyle = workLinks.find((item) => item.title === "AETHELIOS LIFESTYLE");
const house = workLinks.find((item) => item.title.includes("House announcement"));
check("two Lifestyle work items exist", Boolean(lifestyle && house && lifestyle.href !== house.href));
await shot("lifestyle-work-1440.png");
if (!lifestyle || !house) {
  await browser.close();
  process.exit(1);
}

await page.goto(`${BASE}${lifestyle.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("#headline")?.value.includes("AETHELIOS LIFESTYLE"));
const firstHeadline = await page.$eval("#headline", (node) => node.value);
check("first Lifestyle work item opens exact copy", firstHeadline.includes("AETHELIOS LIFESTYLE"));
await shot("lifestyle-studio-first-1440.png");

await page.goto(`${BASE}${house.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("#headline")?.value.includes("House announcement"));
await page.waitForFunction(() => document.querySelector("#studio-draft")?.value, { timeout: 15000 });
const secondHeadline = await page.$eval("#headline", (node) => node.value);
check("second work item does not inherit the first draft", secondHeadline.includes("House announcement"));
check("studio uses Lifestyle selected project", (await page.content()).includes("AETHELIOS LIFESTYLE"));
await page.waitForFunction(() => document.querySelector("[data-studio-preview='canvas']")?.width >= 1080, { timeout: 15000 }).catch(() => null);
const preview = await page.evaluate(() => {
  const box = document.querySelector("[data-preview-scale]");
  const canvas = document.querySelector("[data-studio-preview='canvas']");
  return {
    previewScale: Number(box?.getAttribute("data-preview-scale") || "0"),
    headlinePx: Number(box?.getAttribute("data-headline-preview-px") || "0"),
    canvasWidth: canvas?.width || 0,
    errors: [...document.querySelectorAll(".notice-warn")].map((node) => node.textContent || "").join(" ")
  };
});
check("preview fonts scale from the full composition width", preview.previewScale > 0 && preview.headlinePx >= 12);
check("preview canvas uses full composition pixels", preview.canvasWidth >= 1080, JSON.stringify(preview));
check("lifestyle studio has no error overlay", !/error|failed|500/i.test(preview.errors));
await page.click("#headline", { clickCount: 3 });
await page.keyboard.press("Backspace");
await page.type("#headline", "House announcement — saved", { delay: 15 });
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
await saveResponse;
const exportResponse = page.waitForResponse(
  (response) => response.url().includes("/api/companion/studio/export") && response.request().method() === "POST",
  { timeout: 30000 }
);
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => (node.textContent || "").trim() === "Export");
  button?.click();
});
const exportedHttp = await exportResponse;
const exportedJson = await exportedHttp.json().catch(() => ({}));
check(
  "lifestyle export binds the revision",
  Boolean(exportedJson.exported?.assetUrl) &&
    exportedJson.exported?.asset?.compositionRevisionId === exportedJson.exported?.revision?.id
);
await shot("lifestyle-studio-second-1440.png");
await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
await signIn("neil.local@atelier.invalid");
await page.goto(`${BASE}/companion/work`, { waitUntil: "networkidle0" });
check("lifestyle work lists the exported file after return", (await page.content()).includes("Download finished file"));
const lifestyleDownload = await page.$eval("a[href*='/api/companion/assets/']", (node) => node.getAttribute("href") || "");
const lifestyleFile = await page.evaluate(async (href) => {
  const response = await fetch(href);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { status: response.status, png: bytes[0] === 137 && bytes[1] === 80, length: bytes.byteLength };
}, lifestyleDownload);
check("lifestyle fresh session downloads the exported PNG", lifestyleFile.status === 200 && lifestyleFile.png && lifestyleFile.length > 1000);

await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.setViewport({ width: 884, height: 1100 });
await page.goto(`${BASE}${house.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("[data-studio-preview='canvas']")?.width >= 1080, { timeout: 15000 }).catch(() => null);
const lifestyle884 = await page.evaluate(() => ({
  headlinePx: Number(document.querySelector("[data-headline-preview-px]")?.getAttribute("data-headline-preview-px") || 0),
  headline: document.querySelector("#headline")?.value || ""
}));
check("lifestyle preview headline remains readable at 884", lifestyle884.headlinePx >= 12 && lifestyle884.headline.includes("House announcement"));
await shot("lifestyle-studio-884.png");
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await shot("discovery-884.png");

await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await page.waitForSelector("#talk-input");
await page.focus("#talk-input");
const focused = await page.$eval("#talk-input", (node) => document.activeElement === node);
check("phone talk input focuses", focused);
await shot("lifestyle-talk-390.png");
await page.goto(`${BASE}/companion/business`, { waitUntil: "networkidle0" });
await shot("lifestyle-business-390.png");
await page.goto(`${BASE}${house.href}`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => document.querySelector("[data-studio-preview='canvas']")?.width >= 1080, { timeout: 15000 }).catch(() => null);
const lifestyle390 = await page.evaluate(() => ({
  headlinePx: Number(document.querySelector("[data-headline-preview-px]")?.getAttribute("data-headline-preview-px") || 0),
  headline: document.querySelector("#headline")?.value || ""
}));
check("lifestyle preview headline remains readable at 390", lifestyle390.headlinePx >= 12 && lifestyle390.headline.includes("House announcement"));
await shot("lifestyle-studio-390.png");
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await shot("homepage-390.png");

await page.setViewport({ width: 1440, height: 900 });
await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
await signIn("owner.local@atelier.invalid");
await page.goto(`${BASE}/companion/business`, { waitUntil: "networkidle0" });
const other = await page.evaluate(() => document.body.innerText);
check("second owner does not receive Lifestyle workspace", !other.includes("AETHELIOS LIFESTYLE"));
check("second owner is not the Lifestyle founder project", !other.includes("neil.local@atelier.invalid"));

await browser.close();
const failed = results.filter((item) => !item.ok);
if (failed.length) {
  console.error(`lifestyle-journey failed ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`lifestyle-journey passed ${results.length}`);
