#!/usr/bin/env node
/**
 * Local pricing-page verification: public vs review HTML, leakage,
 * CTA destinations, and plan-note review without purchase side effects.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const EXPECT_MODE = process.env.ATELIER_PRICING_EXPECT_MODE ?? "public";
const OUT = process.env.ATELIER_PRICING_OUT ?? "/opt/cursor/artifacts";
const AMOUNT_RE = /\$249|\$299|\$399|\$499|\$699/;
const results = [];

fs.mkdirSync(OUT, { recursive: true });

function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 280) : "" });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

async function shot(name, width, height = width === 390 ? 844 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 250));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
  return file;
}

async function goto(url) {
  const response = await page.goto(url, { waitUntil: "networkidle0" });
  return response;
}

const pricing = await goto(`${BASE}/pricing`);
check("pricing route responds", pricing?.ok() === true, String(pricing?.status()));
const html = await page.content();
const hasAmounts = AMOUNT_RE.test(html);
const hasDraftBanner = /Draft pricing pending final terms/i.test(html);
check("public page shows starting amounts", hasAmounts, html.match(AMOUNT_RE)?.join(",") ?? "");
check("public page lists quoted partnership setup", /Setup quoted/i.test(html));
if (EXPECT_MODE === "local_review") {
  check("local review shows isolated review banner", hasDraftBanner);
} else {
  check("public mode omits isolated review banner", !hasDraftBanner);
}
check("no buy-now or start-subscription CTA", !/Buy now|Start subscription/i.test(html));
check("hero explains human-led delivery", /Human-led work/i.test(html) && /Neil Stutes/i.test(html));
check("commissions and plans are both present", /#commissions/.test(html) && /#plans/.test(html));

const queryProbe = await goto(`${BASE}/pricing?review=1&preview=true`);
check("query parameter still loads pricing", queryProbe?.ok() === true);
const queryHtml = await page.content();
if (EXPECT_MODE === "public") {
  check("query parameter does not change published amounts", AMOUNT_RE.test(queryHtml));
  check("query parameter does not enable isolated review", !/Isolated local review/i.test(queryHtml));
}

const config = await page.evaluate(async () => {
  const res = await fetch("/api/config");
  return { status: res.status, body: await res.text() };
});
check("config API stays available", config.status === 200);
check("config API omits draft amounts", !AMOUNT_RE.test(config.body));
check("config API keeps pricing not_finalized", /"status":"not_finalized"/.test(config.body));

const hrefs = await page.evaluate(() =>
  [...document.querySelectorAll("a")].map((anchor) => ({
    text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
    href: anchor.getAttribute("href") || ""
  }))
);
check(
  "header includes Pricing",
  hrefs.some((item) => item.href === "/pricing" && /Pricing/i.test(item.text))
);
check(
  "commission CTA uses Discovery",
  hrefs.some((item) => item.href === "/discover?interest=website")
);
check(
  "plan CTA carries plan context",
  hrefs.some((item) => item.href === "/project?plan=connected")
);
check(
  "final actions stay on the existing journey",
  hrefs.some((item) => item.href === "/discover") && hrefs.some((item) => item.href === "/project")
);

await goto(`${BASE}/pricing`);
for (const width of [390, 884, 1440]) {
  await shot(`${EXPECT_MODE}_pricing`, width);
}

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.evaluate(() => document.getElementById("comparison")?.scrollIntoView());
await shot(`${EXPECT_MODE}_pricing_comparison`, 390, 844);
await page.evaluate(() => document.getElementById("faq")?.scrollIntoView());
const faqOpened = await page.evaluate(() => {
  const item = document.querySelector(".pricing-faq-item");
  if (!(item instanceof HTMLDetailsElement)) return false;
  item.open = true;
  return item.open;
});
check("FAQ opens on a phone-width viewport", faqOpened);
await shot(`${EXPECT_MODE}_pricing_faq`, 390, 844);

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await goto(`${BASE}/pricing`);
await shot(`${EXPECT_MODE}_pricing_200zoom`, 720, 900);

await page.setViewport({ width: 320, height: 640, deviceScaleFactor: 1 });
await goto(`${BASE}/pricing`);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
check("narrow 320px pricing does not force horizontal page pan", !overflow, `scrollWidth=${await page.evaluate(() => document.documentElement.scrollWidth)}`);
await shot(`${EXPECT_MODE}_pricing_narrow`, 320, 640);

await page.setViewport({ width: 884, height: 1100, deviceScaleFactor: 1 });
await goto(`${BASE}/project`);
await page.evaluate(() => {
  const area = document.querySelector("textarea");
  if (!area) return;
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  proto?.set?.call(area, "Keep this existing guest draft.");
  area.dispatchEvent(new Event("input", { bubbles: true }));
});
await goto(`${BASE}/project?plan=connected`);
const interest = await page.evaluate(() => document.body.innerText);
check("plan selection surfaces a reviewable note", /Atelier Connected/i.test(interest) && /did not create a subscription/i.test(interest));
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((el) => /Review this plan note/i.test(el.textContent || ""))?.click();
});
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((el) => /Apply to this brief/i.test(el.textContent || ""))?.click();
});
await new Promise((r) => setTimeout(r, 250));
const after = await page.evaluate(() => document.body.innerText);
check("existing draft vision is preserved", /Keep this existing guest draft/i.test(after));
check("plan note can be added without submitting", /Discuss the Atelier Connected ongoing plan/i.test(after));
check("apply is not treated as a purchase", !/payment collected|subscription started|sent to Neil/i.test(after));
await shot("plan_interest_review", 884, 1100);

await goto(`${BASE}/discover?interest=website`);
check("commission CTA lands on Discovery", /discover/i.test(page.url()) && /interest=website/.test(page.url()));
await shot("cta_discover_website", 884, 1100);

const focused = await page.evaluate(async () => {
  const link = document.querySelector("a.btn");
  if (!(link instanceof HTMLElement)) return false;
  link.focus();
  return document.activeElement === link;
});
check("primary actions are keyboard-focusable", focused);

await browser.close();

const failed = results.filter((item) => !item.ok);
console.log(`pricing-verify ${EXPECT_MODE}: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  process.exitCode = 1;
}
