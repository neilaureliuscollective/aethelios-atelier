import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts";
const WIDTHS = [390, 884, 1440];
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name) {
  await page.setViewport({ width, height: width === 390 ? 844 : 1100, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 400));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

async function signIn(page, email) {
  const result = await page.evaluate(async (emailArg) => {
    const res = await fetch("/api/session/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailArg })
    });
    return res.json();
  }, email);
  await page.reload({ waitUntil: "networkidle0" });
  return result;
}

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const width of WIDTHS) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await shot(page, width, "home");
}

for (const width of WIDTHS) {
  await page.goto(`${BASE}/project`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const area = document.querySelector("textarea");
    if (area) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      proto?.set?.call(area, "A premium website that reflects my business and connects clients to my existing booking platform.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const chips = [...document.querySelectorAll("button.chip")];
    chips.find((el) => el.textContent?.includes("Booking-connected"))?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await shot(page, width, "guided_brief");
}

await page.setViewport({ width: 1440, height: 1100 });
await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(page, "owner.local@atelier.invalid");
const list = await page.evaluate(async () => {
  const res = await fetch("/api/projects");
  return res.json();
});
const projectId = list.projects?.[0]?.id;
if (projectId) {
  for (const width of WIDTHS) {
    await page.goto(`${BASE}/workspace/${projectId}`, { waitUntil: "networkidle0" });
    await shot(page, width, "client_workspace");
  }
}

await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(page, "neil.local@atelier.invalid");
const queue = await page.evaluate(async () => {
  const res = await fetch("/api/founder/queue");
  return res.json();
});
const founderId = queue.queue?.[0]?.id ?? projectId;
for (const width of WIDTHS) {
  await page.goto(`${BASE}/founder`, { waitUntil: "networkidle0" });
  await shot(page, width, "founder_queue");
}
if (founderId) {
  for (const width of [884, 1440]) {
    await page.goto(`${BASE}/founder/${founderId}`, { waitUntil: "networkidle0" });
    await shot(page, width, "founder_review");
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/founder/${founderId}`, { waitUntil: "networkidle0" });
  await shot(page, 390, "founder_review");
}

await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
await shot(page, 1440, "services");

await browser.close();
