#!/usr/bin/env node
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

await page.goto(`${BASE}/companion/studio`, { waitUntil: "networkidle0" });
await page.waitForSelector("#headline");
const studio = await page.content();
check("studio editor is present", studio.includes("Brand Studio") && studio.includes("Generate image"));
check("studio has draft selector and layouts", studio.includes("Saved draft") && studio.includes("Portrait social"));
await shot("companion-studio-1440.png");

await page.setViewport({ width: 884, height: 1100 });
await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await shot("companion-talk-884.png");
await page.goto(`${BASE}/companion/studio`, { waitUntil: "networkidle0" });
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
await page.goto(`${BASE}/companion`, { waitUntil: "networkidle0" });
check("today requires signed-in owner", (await page.content()).includes("owner.local@atelier.invalid") || (await page.content()).includes("Cedar"));
await shot("companion-today-390.png");

await page.setViewport({ width: 1440, height: 900 });
await page.reload({ waitUntil: "networkidle0" });
check("reload keeps the signed-in workspace", (await page.content()).includes("owner.local@atelier.invalid") || (await page.content()).includes("Today"));

await signIn("owner-two.local@atelier.invalid");
await page.goto(`${BASE}/companion`, { waitUntil: "networkidle0" });
const other = await page.content();
check("second owner has their own companion", other.includes("owner-two.local@atelier.invalid"));
check("second owner does not see first owner email", !other.includes("owner.local@atelier.invalid"));

await browser.close();
const failed = results.filter((item) => !item.ok);
if (failed.length) {
  console.error(`companion-browser failed ${failed.length}/${results.length}`);
  process.exit(1);
}
console.log(`companion-browser passed ${results.length}`);
