import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_CAPTURE_BASE ?? "http://127.0.0.1:3030";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width === 390 ? 844 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 400));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", file);
}

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const width of [390, 884, 1440]) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await shot(page, width, "after_home");
}

await page.setViewport({ width: 1440, height: 1100 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.evaluate(() => window.scrollTo(0, 900));
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, "after_home_possibilities-1440w.png") });
await page.evaluate(() => window.scrollTo(0, 1800));
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, "after_home_services-1440w.png") });

await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
await shot(page, 1440, "after_services");
await shot(page, 390, "after_services");

await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await shot(page, 1440, "after_discover");
await shot(page, 390, "after_discover");

await page.goto(`${BASE}/project`, { waitUntil: "networkidle0" });
await shot(page, 1440, "after_brief");
await shot(page, 390, "after_brief");

await page.goto(`${BASE}/approach`, { waitUntil: "networkidle0" });
await shot(page, 1440, "after_approach");

await browser.close();
