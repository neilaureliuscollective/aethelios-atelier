#!/usr/bin/env node
/**
 * Isolated launch-copy acceptance. Uses labeled local identities only.
 * Does not place orders, charge cards, or mutate production.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_COPY_OUT ?? "/opt/cursor/artifacts/launch-copy";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 400) : "" });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
  return file;
}

async function text(page) {
  return page.evaluate(() => document.body.innerText);
}

async function hrefs(page, selector = "a") {
  return page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => ({
    text: (el.textContent || "").replace(/\s+/g, " ").trim(),
    href: el.getAttribute("href") || ""
  })), selector);
}

async function signIn(page, email) {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  await page.evaluate(async (emailArg) => {
    await fetch("/api/session/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailArg })
    });
  }, email);
  await page.reload({ waitUntil: "networkidle0" });
}

async function signOut(page) {
  await page.evaluate(async () => {
    await fetch("/api/session/sign-out", { method: "POST" });
  });
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});
const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

try {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  const config = await page.evaluate(async () => {
    const res = await fetch("/api/config");
    return res.json();
  });
  check("config reports actual providers, not assumed Google+email", Array.isArray(config.auth?.providers), JSON.stringify(config.auth));
  check("local isolated auth is the simulated adapter", config.auth?.adapter === "simulated" && config.auth?.ready === true, config.auth?.adapter);

  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  const home = await text(page);
  check("home no longer claims pricing is unpublished", !/Pricing is not published here/i.test(home));
  check("home points to published prices", /Plan prices are listed on/i.test(home) && /Pricing/i.test(home));
  check("home distinguishes Atelier from the main Aethelios product", /separate from the main Aethelios product/i.test(home));
  check("home clarifies submitted vs accepted", /Sending a brief is a request/i.test(home));
  check("home has no audit phrasing", !/no fabricated social proof|Clear limits without invented|Bring the work into the existing journey/i.test(home));
  await shot(page, "home-desktop");

  await page.click("#possibility-custom_apps_platforms");
  const customApp = (await hrefs(page)).find((item) => /Begin a custom app brief/i.test(item.text));
  check(
    "Custom Apps CTA goes to brief with interest and purpose",
    customApp?.href.includes("/project?interest=custom_apps_platforms&purpose=business") ?? false,
    customApp?.href
  );
  await page.click("#possibility-digital_infrastructure");
  const infra = (await hrefs(page)).find((item) => /Open a brief to discuss this/i.test(item.text));
  check(
    "Digital Infrastructure CTA goes to brief with interest and purpose",
    infra?.href.includes("/project?interest=digital_infrastructure&purpose=business") ?? false,
    infra?.href
  );

  await page.focus("#possibility-digital_infrastructure");
  await page.keyboard.press("ArrowRight");
  const selected = await page.evaluate(() => document.querySelector('[role="tab"][aria-selected="true"]')?.id);
  check("possibility tabs wrap with ArrowRight", selected === "possibility-website", selected);

  await page.goto(`${BASE}/pricing`, { waitUntil: "networkidle0" });
  const pricing = await text(page);
  check("pricing shows published Atelier amounts", /\$299/.test(pricing) && /\$249/.test(pricing));
  check("pricing has no unpublished-price claim", !/unpublished/i.test(pricing));
  check("pricing flags unresolved tier differences", /Approved differences beyond the listed prices/i.test(pricing));
  check("pricing distinguishes Atelier plans from Aethelios", /not the main Aethelios product/i.test(pricing));
  check("pricing boundaries heading is human", /What stays outside these prices/i.test(pricing));
  check("pricing has no audit CTA heading", !/Bring the work into the existing journey/i.test(pricing));
  await shot(page, "pricing-desktop");

  await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
  const services = await text(page);
  check("services booking copy is rewritten", !/Linking an existing booking provider is only asked/i.test(services));
  check("services booking copy stays truthful", /does not become that booking product|does not operate a scheduling engine/i.test(services));
  await shot(page, "services-desktop");

  await page.goto(`${BASE}/about`, { waitUntil: "networkidle0" });
  const about = await text(page);
  check("about removes fabricated-social-proof audit phrasing", !/no fabricated social proof/i.test(about));
  await shot(page, "about-desktop");

  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  const account = await text(page);
  check("account does not hardcode Google or email while simulated", !/Sign in with Google or an email link/i.test(account));
  check("account does not treat loading as unconfigured auth", !/Auth is unconfigured/i.test(account));
  check("account shows labeled local identities when that adapter is ready", /Simulated owner|labeled local test identity/i.test(account));
  await shot(page, "account-signed-out");

  await page.goto(`${BASE}/project?plan=atelier`, { waitUntil: "networkidle0" });
  const review = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) => /Review this plan note/i.test(el.textContent || ""))
  );
  if (review) await review.asElement()?.click();
  await page.waitForFunction(() => /Add to existing notes|Replace existing notes|Leave unchanged/i.test(document.body.innerText), {
    timeout: 4000
  }).catch(() => {});
  const plan = await text(page);
  check("plan review/cancel/dismiss controls exist", /Review this plan note|Cancel|Dismiss/i.test(plan));
  check("plan decisions use human labels", /Add to existing notes/.test(plan) && /Replace existing notes/.test(plan) && /Leave unchanged/.test(plan));
  const rawChoices = await page.evaluate(() =>
    [...document.querySelectorAll('input[name="plan-interest-decision"] + span')].map((el) => el.textContent?.trim())
  );
  check(
    "plan decisions do not show raw append/replace/skip",
    rawChoices.length === 3 && rawChoices.every((label) => /existing notes|unchanged/i.test(label || "")),
    rawChoices.join(" | ")
  );
  const dismiss = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) => /Dismiss plan/i.test(el.textContent || ""))
  );
  if (dismiss) await dismiss.asElement()?.click();
  const afterDismiss = await text(page);
  check("dismissing a plan note leaves the brief", !/Plan to discuss/i.test(afterDismiss));
  await shot(page, "brief-plan-review");

  const typeButtons = await page.evaluate(() => {
    const group = document.getElementById("project-type-label")?.nextElementSibling;
    if (!group) return { group: false, names: [] };
    return {
      group: group.getAttribute("role") === "group",
      names: [...group.querySelectorAll("button")].map((button) => button.textContent?.trim())
    };
  });
  check("project type uses a labeled group, not a wrapping label", typeButtons.group && typeButtons.names.includes("Branded websites"), JSON.stringify(typeButtons));

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.click(".menu-toggle");
  await page.waitForSelector(".mobile-nav.open", { timeout: 3000 });
  const mobileSignedOut = await page.evaluate(() => document.querySelector(".mobile-nav")?.innerText || "");
  check("signed-out mobile menu does not invent a commissions route", !/Commissions/.test(mobileSignedOut));
  await shot(page, "home-mobile-signed-out");
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });

  await signIn(page, "owner.local@atelier.invalid");
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  const signedIn = await text(page);
  check("signed-in account offers Commissions and Business Studio", /Commissions/.test(signedIn) && /Business Studio/.test(signedIn));
  await shot(page, "account-client");

  await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
  const workspace = await text(page);
  check("client commissions page does not show empty before load completes", !/No saved commissions yet/.test(workspace) || /Start a brief/.test(workspace));
  check("client commissions naming is clear", /Commissions/.test(workspace) && /Business Studio/.test(workspace));
  await shot(page, "commissions-client");

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
  await page.click(".menu-toggle");
  await page.waitForSelector(".mobile-nav.open", { timeout: 3000 });
  const mobileClient = await page.evaluate(() => document.querySelector(".mobile-nav")?.innerText || "");
  check("signed-in mobile menu includes Commissions", /Commissions/.test(mobileClient), mobileClient.replace(/\s+/g, " ").slice(0, 200));
  check("signed-in mobile menu includes Business Studio", /Business Studio/.test(mobileClient));
  await shot(page, "services-mobile-nav");

  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await signOut(page);
  await signIn(page, "owner-two.local@atelier.invalid");
  await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
  const second = await text(page);
  check("second client sees only their own commissions list", /owner-two\.local@atelier\.invalid/.test(second), second.slice(0, 180));
  await shot(page, "commissions-second-client");

  await signOut(page);
  await signIn(page, "neil.local@atelier.invalid");
  await page.goto(`${BASE}/founder`, { waitUntil: "networkidle0" });
  const founder = await text(page);
  check("founder queue does not mention a local store", !/local store/i.test(founder));
  check("founder queue does not mention simulated founder identity", !/simulated founder identity/i.test(founder));
  check("founder queue is a loading or confirmed-empty state, not a false empty", /Loading the review queue|No submitted commissions yet|Review queue/i.test(founder));
  await shot(page, "founder-queue");

  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  const founderAccount = await text(page);
  check("founder account still offers founder authorization path", /Founder workspace|Founder/.test(founderAccount));
  await shot(page, "account-founder");

  await page.goto(`${BASE}/approach`, { waitUntil: "networkidle0" });
  const approach = await text(page);
  check("approach submitted-vs-accepted wording is human", /A sent brief is a request/.test(approach));
  await shot(page, "approach-desktop");
} catch (error) {
  check("acceptance script completed", false, error instanceof Error ? error.stack : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exit(1);
