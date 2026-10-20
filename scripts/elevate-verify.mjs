#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_CAPTURE_BASE ?? "http://127.0.0.1:3030";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 400) : "" });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width === 390 ? 844 : 1100, fullPage = false) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 350));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage });
  console.log("wrote", file);
}

async function overflow(page) {
  return page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }));
}

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const width of [390, 884, 1440]) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await shot(page, width, "elevate_home");
  const box = await overflow(page);
  check(`home overflow ${width}`, box.overflow <= 1, JSON.stringify(box));
}

const fonts = await page.evaluate(async () => {
  await document.fonts.ready;
  const h1 = getComputedStyle(document.querySelector("h1"));
  const body = getComputedStyle(document.body);
  return { h1: h1.fontFamily, body: body.fontFamily };
});
check("home h1 uses display serif", /cormorant|garamond|palatino/i.test(fonts.h1), fonts.h1);
check("home body uses fig tree sans", /figtree|segoe|sans-serif/i.test(fonts.body), fonts.body);

const banner = await page.$eval(".sim-banner", (el) => el.textContent);
check("banner avoids candidate/adapter", !/candidate|adapter/i.test(banner), banner);
check("hero inspect exists", Boolean(await page.$("text/Inspect this example")));
check("northridge example visible", Boolean(await page.$("text/Northridge")));
check("explore link works", Boolean(await page.$("a[href='/discover']")));

await page.click(".hero-inspect");
await page.waitForSelector("dialog[open]");
check("inspect dialog opens", Boolean(await page.$("dialog[open]")));
await shot(page, 1440, "elevate_home_inspect");
await page.click("dialog[open] button");

await page.setViewport({ width: 1440, height: 1100 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.evaluate(() => window.scrollTo(0, 980));
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, "elevate_home_possibilities-1440w.png") });
await page.evaluate(() => window.scrollTo(0, 1900));
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: path.join(OUT, "elevate_home_services-1440w.png") });

await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
await shot(page, 1440, "elevate_services");
await shot(page, 390, "elevate_services");
const servicesHtml = await page.content();
check(
  "services custom apps heading",
  servicesHtml.includes("Custom apps &amp; platforms") || servicesHtml.includes("Custom apps & platforms")
);
check("services booking not headline", !/Booking-connected website/i.test(servicesHtml));

await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await shot(page, 1440, "elevate_discover");
await shot(page, 390, "elevate_discover");
check("discover sample control", Boolean(await page.$("text/See a sample direction")));
check("discover explore still present", Boolean(await page.$("text/Explore your direction")));

const buttons = await page.$$("button");
for (const button of buttons) {
  const text = await page.evaluate((el) => el.textContent?.trim(), button);
  if (text === "See a sample direction") {
    await button.click();
    break;
  }
}
await page.waitForSelector("text/Northridge", { timeout: 5000 });
check("sample opens studio without account claim", (await page.content()).includes("Sample direction for exploration"));
check("sample not claimed as account", !(await page.content()).includes("signed-in account work"));
await shot(page, 1440, "elevate_discover_sample");
await page.click("text/Phone");
await new Promise((r) => setTimeout(r, 250));
await shot(page, 1440, "elevate_discover_sample_phone");
const hearthFont = await page.evaluate(() => {
  const root = document.querySelector("[data-direction='hearth']");
  return root ? getComputedStyle(root).fontFamily : "";
});
check("hearth sample is not lumen fraunces", !/fraunces/i.test(hearthFont), hearthFont);

await page.goto(`${BASE}/project`, { waitUntil: "networkidle0" });
await shot(page, 1440, "elevate_brief");
await shot(page, 390, "elevate_brief");
const projectTypeNames = await page.evaluate(() => {
  const label = document.querySelector("#project-type-label");
  const group = document.querySelector("[aria-labelledby='project-type-label']");
  return {
    label: label?.textContent ?? "",
    groupLabel: group?.getAttribute("aria-label"),
    labelledBy: group?.getAttribute("aria-labelledby")
  };
});
check(
  "project type is not announced twice via aria-label",
  projectTypeNames.label === "Project type" && !projectTypeNames.groupLabel && projectTypeNames.labelledBy === "project-type-label",
  JSON.stringify(projectTypeNames)
);

await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await shot(page, 1440, "elevate_account");
const accountH1 = await page.$eval("h1", (el) => el.textContent);
check("account heading is customer-facing", accountH1 === "Sign in", accountH1);
const accountCopy = await page.$eval("section", (el) => el.textContent ?? "");
check("account avoids candidate/adapter language", !/candidate|adapter/i.test(accountCopy), accountCopy.slice(0, 180));

await page.goto(`${BASE}/approach`, { waitUntil: "networkidle0" });
await shot(page, 1440, "elevate_approach");
check("approach avoids candidate language", !(await page.content()).includes("local candidate"));

await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
const reducedHidden = await page.evaluate(() =>
  [...document.querySelectorAll(".reveal, .material-reveal")].filter((node) => getComputedStyle(node).opacity === "0").length
);
check("reduced-motion keeps reveal content readable", reducedHidden === 0, `hidden=${reducedHidden}`);
await page.emulateMediaFeatures([]);
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
const aboveFoldHidden = await page.evaluate(() => {
  return [...document.querySelectorAll(".reveal, .material-reveal")].filter((node) => {
    const rect = node.getBoundingClientRect();
    const inView = rect.top < innerHeight * 0.7 && rect.bottom > 0;
    return inView && getComputedStyle(node).opacity === "0";
  }).length;
});
check("above-fold reveal content is readable with motion", aboveFoldHidden === 0, `hidden=${aboveFoldHidden}`);

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
await browser.close();
if (failed.length) process.exit(1);
