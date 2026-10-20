import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [320, 390, 768, 884, 1440];

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width <= 390 ? 844 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 250));
  const file = path.join(OUT, `launch_${name}_${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

async function signIn(page, email) {
  await page.evaluate(async (emailArg) => {
    await fetch("/api/session/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailArg })
    });
  }, email);
  await page.reload({ waitUntil: "networkidle0" });
}

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const width of WIDTHS) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await shot(page, width, "home");
}

await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle0" });
await shot(page, 1440, "pricing");
await shot(page, 390, "pricing");

await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await shot(page, 1440, "discover_enter");
const explore = await page.evaluateHandle(() =>
  [...document.querySelectorAll("button")].find((node) => /explore|begin|continue/i.test(node.textContent || ""))
);
if (explore) await explore.asElement()?.click();
await new Promise((r) => setTimeout(r, 400));
await shot(page, 1440, "discover_intake");

await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await shot(page, 1440, "account_guest");
await shot(page, 390, "account_guest");

await signIn(page, "owner.local@atelier.invalid");
await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await shot(page, 1440, "account_signed_in");

await page.goto(`${BASE}/companion/confirm`, { waitUntil: "networkidle0" });
await shot(page, 1440, "confirm");
await shot(page, 390, "confirm");
const name = await page.$("input");
if (name) {
  await name.click({ clickCount: 3 });
  await page.keyboard.type("Northridge Sitting Room");
}
const confirmBtn = await page.evaluateHandle(() =>
  [...document.querySelectorAll("button")].find((node) => /Confirm and continue/i.test(node.textContent || ""))
);
if (confirmBtn) await confirmBtn.asElement()?.click();
await page.waitForFunction(() => /Confirmed|Open Studio/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
await shot(page, 1440, "confirm_saved");

await page.goto(`${BASE}/companion/studio`, { waitUntil: "networkidle0" });
await shot(page, 1440, "studio");
await shot(page, 390, "studio");

await page.goto(`${BASE}/companion/talk`, { waitUntil: "networkidle0" });
await shot(page, 1440, "talk");

await page.goto(`${BASE}/companion/work`, { waitUntil: "networkidle0" });
await shot(page, 1440, "work");

await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
await shot(page, 1440, "workspace");

await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
await signIn(page, "owner-two.local@atelier.invalid");
await page.goto(`${BASE}/companion`, { waitUntil: "networkidle0" });
await shot(page, 1440, "owner_two_today");

const fonts = await page.evaluate(async () => {
  await document.fonts.ready;
  return {
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector("h1")).fontFamily,
    times: /times/i.test(getComputedStyle(document.body).fontFamily)
  };
});
console.log("fonts", JSON.stringify(fonts));

await browser.close();
console.log("launch capture complete");
