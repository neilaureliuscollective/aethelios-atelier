#!/usr/bin/env node
/**
 * Public custom-project expansion: business-first homepage, secondary route,
 * tailored briefs, and labeled interactive examples.
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const results = [];

function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 240) : "" });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  const home = await page.evaluate(() => ({
    hero: document.querySelector("#home-hero")?.textContent ?? "",
    lede: document.querySelector(".cinematic-copy .lede")?.textContent ?? "",
    cta: [...document.querySelectorAll(".hero-actions a")].map((a) => a.textContent.trim()),
    services: document.querySelector("#services-heading")?.textContent ?? "",
    invite: document.querySelector(".custom-invite")?.textContent ?? "",
    audiences: (document.body.textContent || "").match(/Life|Learning|Work|Business/g) || []
  }));
  check("homepage still leads with the personal-built business hero", /Your vision/i.test(home.hero) && /Personally built/i.test(home.hero));
  check("homepage hero still names business services", /branded websites/i.test(home.lede));
  check("homepage primary CTA is still Discover / project, not audience selection", home.cta.some((label) => /Explore your direction/i.test(label)));
  check("homepage services remain the four business commissions", /Four ways a commission can begin/i.test(home.services));
  check("homepage has a secondary other-projects invitation", /Have another project in mind/i.test(home.invite));
  check("homepage is not a four-audience selector", !/Choose your audience/i.test(await page.content()));

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  const mobileHero = await page.$eval("#home-hero", (el) => el.textContent || "");
  check("narrow homepage keeps the same hero", /Personally built/i.test(mobileHero));

  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`${BASE}/custom-projects`, { waitUntil: "networkidle0" });
  const custom = await page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent ?? "",
    examples: [...document.querySelectorAll("article.service-feature h2")].map((el) => el.textContent),
    labels: document.body.textContent || ""
  }));
  check("custom projects page is part of Atelier", /Bring the idea/i.test(custom.title));
  check(
    "custom projects shows the three labeled examples",
    custom.examples.includes("Follow-up workspace") &&
      custom.examples.includes("Study organizer") &&
      custom.examples.includes("Personal tracker")
  );
  check("examples are labeled illustrative", /Illustrative/i.test(custom.labels));
  check("examples do not name Cisco or friends as clients", !/Cisco|endorsement/i.test(custom.labels));

  const followUp = await page.evaluate(async () => {
    const demo = document.querySelector("[data-demo='follow-up-workspace']");
    const before = demo?.querySelector("[data-task-meta='t1']")?.textContent || "";
    const change = demo?.querySelector("[data-action='cycle-status']");
    change?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 120));
    const after = demo?.querySelector("[data-task-meta='t1']")?.textContent || "";
    return { before, after, clicked: Boolean(change), found: Boolean(demo) };
  });
  check(
    "follow-up demo is interactive",
    followUp.clicked && followUp.after !== followUp.before,
    `${followUp.before} -> ${followUp.after}`
  );

  await page.goto(`${BASE}/project?purpose=study&example=study_organizer&route=custom_project`, {
    waitUntil: "networkidle0"
  });
  const study = await page.evaluate(() => ({
    heading: document.querySelector(".brief-heading")?.textContent ?? "",
    purpose: [...document.querySelectorAll("[aria-labelledby='commission-purpose-label'] button")]
      .find((btn) => btn.getAttribute("aria-pressed") === "true")
      ?.textContent,
    body: document.body.textContent || ""
  }));
  check("study brief asks what they are trying to create", /create or make easier/i.test(study.heading));
  check("study brief preselects study purpose", /Study/i.test(study.purpose || ""));
  check("study brief does not require a company or booking provider on step 1", !/Booking provider/i.test(study.body));

  await page.evaluate(async () => {
    const clickContinue = () =>
      [...document.querySelectorAll("button")].find((btn) => btn.textContent?.includes("Continue"))?.click();
    clickContinue();
    await new Promise((resolve) => setTimeout(resolve, 50));
    clickContinue();
    await new Promise((resolve) => setTimeout(resolve, 50));
    clickContinue();
  });
  await page.waitForFunction(() => /useful first version|Must-haves|Booking provider/i.test(document.body.innerText));
  const studyScope = await page.evaluate(() => document.body.innerText);
  check("study scope step has no booking provider", !/Booking provider/i.test(studyScope));
  check("study scope asks for a useful first version", /useful first version/i.test(studyScope));

  await page.goto(`${BASE}/project?interest=custom_apps_platforms&purpose=business`, {
    waitUntil: "networkidle0"
  });
  await page.evaluate(async () => {
    const clickContinue = () =>
      [...document.querySelectorAll("button")].find((btn) => btn.textContent?.includes("Continue"))?.click();
    clickContinue();
    await new Promise((resolve) => setTimeout(resolve, 50));
    clickContinue();
    await new Promise((resolve) => setTimeout(resolve, 50));
    clickContinue();
  });
  await page.waitForFunction(() => /Goals|useful first version|Booking provider/i.test(document.body.innerText));
  const toolScope = await page.evaluate(() => document.body.innerText);
  check("business tool brief does not force a booking provider", !/Booking provider/i.test(toolScope));

  await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
  const services = await page.evaluate(() => ({
    appHref: document.querySelector("a[href*='custom_apps_platforms']")?.getAttribute("href") || "",
    invite: document.body.textContent || ""
  }));
  check("services send functional apps to the brief, not Discovery", /\/project\?/.test(services.appHref));
  check("services keep a secondary other-projects invitation", /Have another project in mind/i.test(services.invite));
} catch (error) {
  check("custom-projects browser journey completed", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.ok);
if (failed.length) {
  console.error(`custom-projects-browser: ${failed.length} failed`);
  process.exit(1);
}
console.log(`custom-projects-browser: ${results.length} passed`);
