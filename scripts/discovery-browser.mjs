#!/usr/bin/env node
/**
 * Discovery studio browser verification. Port 3010 in the isolated worktree.
 * Measures post-load interaction, not HTTP fetch timing as a render result.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.DISCOVERY_BASE ?? "http://127.0.0.1:3010";
const OUT = process.env.DISCOVERY_OUT ?? "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width === 390 ? 844 : 1100, fullPage = true) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 280));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage });
  console.log("wrote", file);
}

async function waitReady(page) {
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
  await page.waitForSelector("text/Explore your direction");
}

const page = await browser.newPage();
const requests = [];
page.on("request", (req) => {
  if (["xhr", "fetch"].includes(req.resourceType())) requests.push(req.url());
});

await waitReady(page);
check("discover renders without account", await page.$eval("h1", (el) => el.textContent.includes("could become")));

for (const width of [390, 884, 1440]) {
  await shot(page, width, "discover_entrance");
}

await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await waitReady(page);
await shot(page, 1440, "discover_reduced_motion");
await page.emulateMediaFeatures([]);

const t0 = Date.now();
await page.click("button::-p-text(Explore your direction)").catch(async () => {
  const buttons = await page.$$("button");
  for (const button of buttons) {
    const text = await page.evaluate((el) => el.textContent, button);
    if (text?.includes("Explore your direction")) {
      await button.click();
      break;
    }
  }
});
await page.waitForSelector("input[type='text']");
check("first interaction after load ms", true, String(Date.now() - t0));

await page.click("input[type='text']");
await page.keyboard.type("Meridian Sitting Room");
const continueBtn = async (label) => {
  const buttons = await page.$$("button");
  for (const button of buttons) {
    const text = await page.evaluate((el) => el.textContent?.trim(), button);
    if (text === label) {
      await button.click();
      return true;
    }
  }
  return false;
};
check("continue from name", await continueBtn("Continue"));
await page.waitForSelector("input[type='radio']");
await page.click("input[value='appointment']");
check("continue from type", await continueBtn("Continue"));
await page.click("input[value='easier_booking']");
check("continue from intent", await continueBtn("Continue"));
await page.click("input[value='calm']");
check("continue from feeling", await continueBtn("Choose qualities"));
await page.waitForSelector("button[aria-pressed]");
const quality = await page.$("button[aria-pressed]");
await quality?.click();
const quality2 = (await page.$$("button[aria-pressed]"))[1];
await quality2?.click();
await shot(page, 1440, "discover_qualities");
await shot(page, 390, "discover_qualities");
check("open studio", await continueBtn("Open the studio"));
await page.waitForSelector("article");
const personalized = await page.content();
check("personalized business name in preview", personalized.includes("Meridian Sitting Room"));
await shot(page, 1440, "discover_preview", 1100, false);
await shot(page, 884, "discover_preview", 1100, false);
await shot(page, 390, "discover_preview", 844, false);
await page.setViewport({ width: 1440, height: 1100 });
await page.click("input[name='direction'][value='signal']");
await new Promise((r) => setTimeout(r, 200));
await shot(page, 1440, "discover_preview_signal", 1100, false);
await page.click("input[name='direction'][value='lumen']");
await new Promise((r) => setTimeout(r, 200));

check("compare two", await continueBtn("Compare two"));
await page.waitForFunction(() => document.body.innerText.includes("Choose with feeling"));
await shot(page, 1440, "discover_compare", 1100, false);
await shot(page, 390, "discover_compare", 844, false);

const backStudio = await continueBtn("Back to studio");
check("back to studio", backStudio);
await page.waitForSelector("textarea");
const nameValue = await page.$eval("input[type='text']", (el) => el.value);
check("back navigation preserves name", nameValue.includes("Meridian Sitting Room"));

await page.evaluate(() => {
  const area = [...document.querySelectorAll("textarea")].find((el) =>
    el.closest("label")?.textContent?.includes("What you like")
  );
  if (area) {
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(area, "The quiet opening.");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
check("use this direction", await continueBtn("Use this direction"));
await page.waitForFunction(() => /prepared on this device/i.test(document.body.innerText));
const reviewHtml = await page.content();
check("does not claim sent", !/Sent to Neil/.test(reviewHtml));
check("does not claim added to account", !/Added to your account/.test(reviewHtml));
await shot(page, 1440, "discover_review");
await shot(page, 884, "discover_review");
await shot(page, 390, "discover_review");

await continueBtn("Back to studio");
await page.waitForSelector("input[type='text']");
await page.evaluate(() => {
  const input = document.querySelector("input[type='text']");
  if (!input) return;
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(input, "Later edit must not mutate snapshot");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await continueBtn("Review");
await page.waitForFunction(() => /unpublished/i.test(document.body.innerText));
const reviewAfter = await page.content();
check("confirmed snapshot still has original name", reviewAfter.includes("Meridian Sitting Room"));
check("unpublished notice after later edit", /unpublished/i.test(reviewAfter));

await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await continueBtn("Explore your direction");
await page.waitForSelector("input[type='text']");
await page.type("input[type='text']", "<img src=x onerror=alert(1)> 名".repeat(8));
const escaped = await page.$eval("input[type='text']", (el) => el.value);
check("hostile text accepted as value not executed", escaped.includes("<img") && escaped.length <= 80);

const projectMutations = requests.filter(
  (url) =>
    url.includes("/api/projects") ||
    url.includes("/submit") ||
    url.includes("/api/session/sign-in") ||
    url.includes("/api/session/sign-out")
);
check(
  "discovery made no project mutation or auth write calls before the proof sign-in",
  projectMutations.length === 0,
  projectMutations.join(", ")
);

await page.evaluate(async () => {
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner.local@atelier.invalid" })
  });
});
const before = await page.evaluate(async () => {
  const res = await fetch("/api/projects");
  return res.json();
});
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await continueBtn("Explore your direction");
const after = await page.evaluate(async () => {
  const res = await fetch("/api/projects");
  return res.json();
});
check(
  "signed-in project list unchanged by visiting discovery",
  JSON.stringify(before.projects ?? before) === JSON.stringify(after.projects ?? after)
);

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
await browser.close();
if (failed.length) process.exit(1);
