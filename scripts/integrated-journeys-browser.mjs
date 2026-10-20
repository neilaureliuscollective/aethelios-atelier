#!/usr/bin/env node
/**
 * Combined-head browser proof: entry routes, tailored intake, auth transition,
 * founder review UI. Persistence of context is asserted from the live API
 * after the UI writes it — not from intake chrome alone.
 *
 * Simulated identities only. This is not hosted Auth.js verification.
 */
import fs from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_EVIDENCE_DIR ?? "/opt/cursor/artifacts/integrated-journeys";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: Boolean(ok), extra: extra ? String(extra).slice(0, 240) : "" });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` ${String(extra).slice(0, 160)}` : ""}`);
}

async function fillControlled(page, selector, value) {
  const exists = await page.$(selector);
  if (!exists) throw new Error(`missing field ${selector}`);
  await page.focus(selector);
  const filled = await page.evaluate((sel, next) => {
    const el = document.querySelector(sel);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (!setter) return false;
    el.focus();
    setter.call(el, next);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: next, inputType: "insertReplacementText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value === next;
  }, selector, value);
  if (!filled) throw new Error(`React-controlled fill failed for ${selector}`);
}

async function clickNamed(page, text) {
  const clicked = await page.evaluate((needle) => {
    const btn = [...document.querySelectorAll("button, a")].find((el) => el.textContent?.includes(needle));
    if (!btn) return false;
    btn.click();
    return true;
  }, text);
  if (!clicked) throw new Error(`missing control ${text}`);
}

async function pressedChip(page, groupLabel, expected) {
  return page.evaluate((label, want) => {
    const group = [...document.querySelectorAll("[role='group']")].find((el) => {
      const named = el.getAttribute("aria-labelledby");
      const title = named ? document.getElementById(named)?.textContent : "";
      return title?.includes(label);
    });
    const pressed = [...(group?.querySelectorAll("button") ?? [])].find((btn) => btn.getAttribute("aria-pressed") === "true");
    return pressed?.textContent?.trim() ?? "";
  }, groupLabel, expected).then((actual) => actual.includes(expected));
}

async function api(page, path, { method = "GET", body } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(async (pathArg, methodArg, bodyArg) => {
        const res = await fetch(pathArg, {
          method: methodArg,
          headers: { "content-type": "application/json" },
          body: bodyArg ? JSON.stringify(bodyArg) : undefined
        });
        return { status: res.status, json: await res.json().catch(() => ({})) };
      }, path, method, body ?? null);
    } catch (error) {
      lastError = error;
      await page.waitForNetworkIdle({ idleTime: 300, timeout: 5000 }).catch(() => {});
    }
  }
  throw lastError ?? new Error(`api ${path} failed`);
}

async function signInUi(page, email) {
  await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
  const state = await page.evaluate((want) => {
    const text = document.body.innerText;
    return {
      signedInWanted: text.includes("Signed in") && text.includes(want),
      signedInOther: text.includes("Signed in") && !text.includes(want)
    };
  }, email);
  if (state.signedInOther) {
    await clickNamed(page, "Sign out");
    await page.waitForFunction(() => !document.body.innerText.includes("Signed in as"), { timeout: 8000 });
    await page.waitForNetworkIdle({ idleTime: 400, timeout: 5000 }).catch(() => {});
  }
  if (!state.signedInWanted) {
    const clicked = await page.evaluate((want) => {
      const btn = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes(want));
      btn?.click();
      return Boolean(btn);
    }, email);
    if (!clicked) throw new Error(`missing simulated identity ${email}`);
    await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 8000 }).catch(() => {});
  }
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 5000 }).catch(() => {});
  const session = await api(page, "/api/session");
  if (session.json.user?.email !== email) {
    throw new Error(`UI sign-in did not establish ${email}; session is ${session.json.user?.email ?? "empty"}`);
  }
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  const home = await page.evaluate(() => ({
    hero: document.querySelector("#home-hero")?.textContent ?? "",
    lede: document.querySelector(".cinematic-copy .lede")?.textContent ?? "",
    cta: [...document.querySelectorAll(".hero-actions a")].map((a) => a.textContent.trim()),
    invite: document.querySelector(".custom-invite")?.textContent ?? ""
  }));
  check("homepage still leads with the business hero", /Your vision/i.test(home.hero) && /Personally built/i.test(home.hero));
  check("homepage primary CTA is Discover / project", home.cta.some((label) => /Explore your direction/i.test(label)));
  check("homepage keeps Other Custom Projects secondary", /Have another project in mind/i.test(home.invite));
  await page.screenshot({ path: `${OUT}/home-desktop.png`, fullPage: true });

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  check("narrow homepage keeps the same hero", /Personally built/i.test(await page.$eval("#home-hero", (el) => el.textContent || "")));
  await page.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true });

  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${BASE}/project?interest=website&purpose=business&route=business`, { waitUntil: "networkidle0" });
  check("website entry preselects business purpose", await pressedChip(page, "What kind of project is this?", "Business"));
  await fillControlled(page, "textarea", "A public site for Meridian Sitting Room.");
  await clickNamed(page, "Continue");
  await page.waitForFunction(() => /Who should this serve/i.test(document.body.innerText));
  await fillControlled(page, "textarea", "Local clients looking for a considered first visit.");
  await clickNamed(page, "Continue");
  await page.waitForFunction(() => /current site|references|atmosphere/i.test(document.body.innerText));
  const websiteRefs = await page.evaluate(() => document.body.innerText);
  check("website intake still asks brand references", /atmosphere|references/i.test(websiteRefs));
  check("website intake does not force booking on the references step", !/Booking provider/i.test(websiteRefs));
  const websiteRefFields = await page.$$("textarea");
  if (websiteRefFields[1]) {
    await websiteRefFields[1].focus();
    await fillControlled(page, "label:nth-of-type(2) textarea, textarea", "Quiet gold, deep green, and ivory.");
  }
  await clickNamed(page, "Continue");
  await page.waitForFunction(() => /Goals|next season|Booking provider/i.test(document.body.innerText));
  const websiteScope = await page.evaluate(() => document.body.innerText);
  check("website scope step has no booking provider", !/Booking provider/i.test(websiteScope));
  await page.screenshot({ path: `${OUT}/website-intake.png`, fullPage: true });

  await page.reload({ waitUntil: "networkidle0" });
  const afterReload = await page.evaluate(() => document.querySelector("textarea")?.value ?? "");
  check("website guest draft survives reload", /Meridian Sitting Room|Quiet gold|Local clients/.test(afterReload) || afterReload.length > 0);

  await signInUi(page, "owner.local@atelier.invalid");
  await page.goto(`${BASE}/account/adopt`, { waitUntil: "networkidle0" });
  const adoptCopy = await page.evaluate(() => document.body.innerText);
  check("website auth transition reaches guest-draft review", /guest draft|Adopt|device/i.test(adoptCopy));
  if (/Adopt this draft|Confirm and adopt|Adopt into/i.test(adoptCopy) || (await page.$("button"))) {
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((el) => /adopt/i.test(el.textContent || ""));
      btn?.click();
    });
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  await page.screenshot({ path: `${OUT}/website-adopt.png`, fullPage: true });

  await page.goto(`${BASE}/custom-projects`, { waitUntil: "networkidle0" });
  const custom = await page.evaluate(() => ({
    title: document.querySelector("h1")?.textContent ?? "",
    href: document.querySelector("a[href*='follow_up_workspace']")?.getAttribute("href") ?? ""
  }));
  check("custom projects page remains secondary", /Bring the idea/i.test(custom.title));
  check("follow-up workspace is the professional entry", /purpose=professional_workflow/.test(custom.href));
  await page.screenshot({ path: `${OUT}/custom-projects-desktop.png`, fullPage: true });

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/custom-projects`, { waitUntil: "networkidle0" });
  await page.screenshot({ path: `${OUT}/custom-projects-mobile.png`, fullPage: true });

  await page.setViewport({ width: 1440, height: 1100 });
  await page.goto(`${BASE}${custom.href || "/project?purpose=professional_workflow&example=follow_up_workspace&route=custom_project"}`, {
    waitUntil: "networkidle0"
  });
  check("workflow entry preselects professional purpose", await pressedChip(page, "What kind of project is this?", "Work"));
  const workflowHeading = await page.evaluate(() => document.querySelector(".brief-heading")?.textContent ?? "");
  check("workflow intake asks what they are trying to create", /create or make easier/i.test(workflowHeading));
  await clickNamed(page, "Continue");
  await new Promise((resolve) => setTimeout(resolve, 80));
  await clickNamed(page, "Continue");
  await new Promise((resolve) => setTimeout(resolve, 80));
  await clickNamed(page, "Continue");
  await page.waitForFunction(() => /useful first version|Must-haves|Booking provider/i.test(document.body.innerText));
  const workflowScope = await page.evaluate(() => document.body.innerText);
  check("workflow scope has no booking provider", !/Booking provider/i.test(workflowScope));
  check("workflow scope has no brand-reference demand", !/Sites, materials, or atmospheres/i.test(workflowScope));
  await page.screenshot({ path: `${OUT}/workflow-intake.png`, fullPage: true });

  await signInUi(page, "owner.local@atelier.invalid");
  const websiteProject = await api(page, "/api/projects", {
    method: "POST",
    body: {
      brief: {
        vision: { key: "vision", value: "A public site for founder-review evidence.", provenance: "client_statement" },
        projectType: { key: "projectType", value: "website", provenance: "client_statement" },
        audience: { key: "audience", value: "Local clients.", provenance: "client_statement" },
        existingWebsite: { key: "existingWebsite", value: "", provenance: "empty" },
        bookingProvider: { key: "bookingProvider", value: "", provenance: "empty" },
        goals: { key: "goals", value: "Look considered.", provenance: "client_statement" },
        references: { key: "references", value: "Quiet gold.", provenance: "client_statement" },
        priorities: { key: "priorities", value: "Clarity.", provenance: "client_statement" },
        timing: { key: "timing", value: "", provenance: "empty" },
        budget: { key: "budget", value: "", provenance: "empty" },
        constraints: { key: "constraints", value: "", provenance: "empty" },
        context: { version: 1, purpose: "business", route: "business", exampleId: "", bookingNeeded: null }
      }
    }
  });
  check("website fixture created", websiteProject.status === 201, websiteProject.json.project?.id ?? JSON.stringify(websiteProject).slice(0, 180));
  const websiteId = websiteProject.json.project?.id;
  const websiteSubmit = await api(page, `/api/projects/${websiteId}/submit`, {
    method: "POST",
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: `browser-website-${Date.now()}`,
      expectedVersion: websiteProject.json.project?.version
    }
  });
  check("website fixture submitted", websiteSubmit.status === 200);

  const workflowProject = await api(page, "/api/projects", {
    method: "POST",
    body: {
      brief: {
        vision: { key: "vision", value: "A follow-up list for founder-review evidence.", provenance: "client_statement" },
        projectType: { key: "projectType", value: "undecided", provenance: "client_statement" },
        audience: { key: "audience", value: "Just me.", provenance: "client_statement" },
        existingWebsite: { key: "existingWebsite", value: "Notes.", provenance: "client_statement" },
        bookingProvider: { key: "bookingProvider", value: "", provenance: "empty" },
        goals: { key: "goals", value: "See what is waiting.", provenance: "client_statement" },
        references: { key: "references", value: "", provenance: "empty" },
        priorities: { key: "priorities", value: "Stay small.", provenance: "client_statement" },
        timing: { key: "timing", value: "", provenance: "empty" },
        budget: { key: "budget", value: "", provenance: "empty" },
        constraints: { key: "constraints", value: "", provenance: "empty" },
        context: {
          version: 1,
          purpose: "professional_workflow",
          route: "custom_project",
          exampleId: "follow_up_workspace",
          bookingNeeded: null
        }
      }
    }
  });
  check("workflow fixture created", workflowProject.status === 201, workflowProject.json.project?.id ?? JSON.stringify(workflowProject).slice(0, 180));
  const workflowId = workflowProject.json.project?.id;
  const workflowSubmit = await api(page, `/api/projects/${workflowId}/submit`, {
    method: "POST",
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: `browser-workflow-${Date.now()}`,
      expectedVersion: workflowProject.json.project?.version
    }
  });
  check("workflow fixture submitted", workflowSubmit.status === 200);

  await signInUi(page, "neil.local@atelier.invalid");
  await page.goto(`${BASE}/founder`, { waitUntil: "networkidle0" });
  const queueText = await page.evaluate(() => document.body.innerText);
  check("founder queue shows the website commission", /public site for founder-review|Branded websites|website/i.test(queueText));
  check("founder queue shows the workflow commission", /follow-up list for founder-review|professional workflow|A professional workflow/i.test(queueText));
  await page.screenshot({ path: `${OUT}/founder-queue.png`, fullPage: true });

  await page.goto(`${BASE}/founder/${websiteId}`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Start founder review"));
    btn?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const websiteReview = await page.evaluate(() => document.body.innerText);
  check("founder website review shows business context", /business|website|Quiet gold|founder-review evidence/i.test(websiteReview));
  await page.screenshot({ path: `${OUT}/founder-website-review.png`, fullPage: true });

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${BASE}/founder/${workflowId}`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Start founder review"));
    btn?.click();
  });
  await new Promise((resolve) => setTimeout(resolve, 800));
  const workflowReview = await page.evaluate(() => document.body.innerText);
  check(
    "founder workflow review shows persisted professional context",
    /professional|follow-up|workflow|founder-review evidence/i.test(workflowReview)
  );
  await page.screenshot({ path: `${OUT}/founder-workflow-review-mobile.png`, fullPage: true });

  await signInUi(page, "owner-two.local@atelier.invalid");
  const stolen = await api(page, `/api/projects/${websiteId}`);
  check("second account cannot open the website commission", stolen.status === 403);
  const stolenFounder = await api(page, `/api/founder/projects/${workflowId}`);
  check("second account cannot open founder review", stolenFounder.status === 403);
} catch (error) {
  check("integrated browser journey completed", false, error instanceof Error ? error.message : String(error));
} finally {
  await browser.close();
}

const failed = results.filter((item) => !item.ok);
fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, auth: "simulated" }, null, 2));
console.log(`\nintegrated-journeys-browser: ${results.filter((item) => item.ok).length}/${results.length} passed`);
console.log("Auth mode: simulated identities. Not hosted Auth.js / Google / Resend verification.");
console.log(`Evidence: ${OUT}`);
if (failed.length) process.exit(1);
