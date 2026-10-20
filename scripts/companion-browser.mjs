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
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1280,900"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

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

await signIn("owner.local@atelier.invalid");
await page.goto(`${BASE}/companion`, { waitUntil: "networkidle0" });
const today = await page.content();
check("today requires signed-in owner", today.includes("owner.local@atelier.invalid"));
check("today is honest empty or saved work", today.includes("What is actually waiting") || today.includes("Nothing is waiting"));
await page.screenshot({ path: path.join(SHOTS, "companion-today.png"), fullPage: true });

await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await page.waitForSelector("#talk-input");
await page.type("#talk-input", "Help me announce my new service.");
await Promise.all([
  page.click("button[type=submit]"),
  page.waitForFunction(() => document.body.innerText.includes("not a live AI reply") || document.body.innerText.includes("Hearth"))
]);
const talk = await page.content();
check("talk stays honest without live OpenAI", talk.includes("not a live AI reply") || talk.includes("unavailable"));
await page.screenshot({ path: path.join(SHOTS, "companion-talk.png"), fullPage: true });

await page.goto(`${BASE}/companion/studio`, { waitUntil: "networkidle0" });
const studio = await page.content();
check("studio editor is present", studio.includes("Brand Studio") && studio.includes("Generate image"));
await page.screenshot({ path: path.join(SHOTS, "companion-studio.png"), fullPage: true });

await page.goto(`${BASE}/companion/work`, { waitUntil: "networkidle0" });
check("work area loaded", (await page.content()).includes("Saved work"));
await page.screenshot({ path: path.join(SHOTS, "companion-work.png"), fullPage: true });

await page.setViewport({ width: 390, height: 844 });
await page.goto(`${BASE}/companion/business`, { waitUntil: "networkidle0" });
check("business profile on mobile", (await page.content()).includes("Business context"));
await page.screenshot({ path: path.join(SHOTS, "companion-business-mobile.png"), fullPage: true });

await page.setViewport({ width: 1280, height: 900 });
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
