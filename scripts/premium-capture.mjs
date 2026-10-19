import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.PREMIUM_BASE ?? "http://127.0.0.1:3020";
const OUT = process.env.PREMIUM_OUT ?? "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, name, width, height = width === 390 ? 844 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 350));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

const page = await browser.newPage();

for (const width of [390, 884, 1440]) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await shot(page, "after_home", width);
  await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
  await shot(page, "after_services", width);
  await page.goto(`${BASE}/approach`, { waitUntil: "networkidle0" });
  await shot(page, "after_approach", width);
}

await page.setViewport({ width: 1440, height: 1100 });
await page.goto(`${BASE}/project`, { waitUntil: "networkidle0" });
await shot(page, "after_brief_import_idle", 1440);

await browser.close();
console.log("premium capture complete");
