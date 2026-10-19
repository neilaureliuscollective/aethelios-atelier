import puppeteer from "puppeteer-core";

const BASE = process.env.PREMIUM_BASE ?? "http://127.0.0.1:3020";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});

const page = await browser.newPage();
await page.goto(BASE, { waitUntil: "networkidle0" });

const loaded = await page.evaluate(async () => {
  await document.fonts.ready;
  const body = getComputedStyle(document.body).fontFamily;
  const html = getComputedStyle(document.documentElement).fontFamily;
  const heading = getComputedStyle(document.querySelector("h1")).fontFamily;
  const nav = getComputedStyle(document.querySelector(".nav-desktop a") ?? document.body).fontFamily;
  const times = /times/i;
  return {
    body,
    html,
    heading,
    nav,
    bodyIsTimes: times.test(body),
    htmlVar: getComputedStyle(document.documentElement).getPropertyValue("--font-body-loaded"),
    rootBody: getComputedStyle(document.documentElement).getPropertyValue("--font-body")
  };
});

const fallback = await page.evaluate(async () => {
  document.documentElement.style.setProperty("--font-body-loaded", "\"Missing Display Face\"");
  await document.fonts.ready;
  return getComputedStyle(document.body).fontFamily;
});

await browser.close();

const sans = /figtree|segoe|system-ui|helvetica|arial|sans-serif/i;
const ok = !loaded.bodyIsTimes && sans.test(loaded.body) && sans.test(fallback) && !/times/i.test(fallback);
console.log(JSON.stringify({ loaded, fallback, ok }, null, 2));
if (!ok) {
  console.error("Font verification failed");
  process.exit(1);
}
