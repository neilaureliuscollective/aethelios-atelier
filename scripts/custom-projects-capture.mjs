#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_CAPTURE_DIR ?? "/opt/cursor/artifacts/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1440,1100"]
});
const page = await browser.newPage();

async function shot(name, width, height, url, after) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle0" });
  if (after) await after(page);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log("captured", name);
}

await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.screenshot({ path: `${OUT}/homepage_business_first_desktop.png`, fullPage: false });
console.log("captured homepage_business_first_desktop");
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.screenshot({ path: `${OUT}/homepage_business_first_mobile.png`, fullPage: false });
console.log("captured homepage_business_first_mobile");
await shot("homepage_secondary_invite_desktop", 1440, 1100, "/", async (p) => {
  await p.evaluate(() => document.querySelector(".custom-invite")?.scrollIntoView({ block: "center" }));
});
await shot("custom_projects_examples", 1440, 1100, "/custom-projects");
await shot("custom_projects_follow_up_interactive", 1440, 1100, "/custom-projects", async (p) => {
  const buttons = await p.$$("article.service-feature button");
  if (buttons[0]) await buttons[0].click();
  if (buttons[1]) await buttons[1].click();
});
await shot("brief_study_tool", 1280, 900, "/project?purpose=study&example=study_organizer&route=custom_project");
await shot("brief_personal_utility", 1280, 900, "/project?purpose=personal&example=personal_tracker&route=custom_project");
await shot("brief_business_internal_tool", 1280, 900, "/project?interest=custom_apps_platforms&purpose=business");
await shot("brief_business_website", 1280, 900, "/project?interest=website&purpose=business");
await shot("services_secondary_invite", 1440, 1100, "/services", async (p) => {
  await p.evaluate(() => document.querySelector(".custom-invite-block")?.scrollIntoView({ block: "center" }));
});

await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
const created = await page.evaluate(async () => {
  const field = (key, value) => ({
    key,
    value,
    provenance: value ? "client_statement" : "empty"
  });
  const ownerSignIn = await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner.local@atelier.invalid" })
  });
  const brief = {
    vision: field("vision", "A study list for practice misses."),
    projectType: field("projectType", "undecided"),
    audience: field("audience", "Just me."),
    existingWebsite: field("existingWebsite", "Paper notes."),
    bookingProvider: field("bookingProvider", ""),
    goals: field("goals", "Review missed practice."),
    references: field("references", ""),
    priorities: field("priorities", "Topics and a short review."),
    timing: field("timing", ""),
    budget: field("budget", ""),
    constraints: field("constraints", "No school accounts."),
    context: { version: 1, purpose: "study", route: "custom_project", exampleId: "study_organizer", bookingNeeded: null }
  };
  const created = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief })
  }).then((r) => r.json());
  if (!created.project) {
    return { error: { ownerSignIn: ownerSignIn.status, created } };
  }
  const submitted = await fetch(`/api/projects/${created.project.id}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: `capture-study-${Date.now()}`,
      expectedVersion: created.project.version
    })
  }).then((r) => r.json());
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "neil.local@atelier.invalid" })
  });
  await fetch(`/api/founder/projects/${created.project.id}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  const draft = await fetch(`/api/founder/projects/${created.project.id}/proposals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ changeSummary: "Study seed", seedFromBrief: true })
  }).then((r) => r.json());
  return { id: created.project.id, submitted, draft };
});
if (!created.id) {
  console.error("founder capture skipped", JSON.stringify(created));
} else {
  await shot("founder_study_proposal_defaults", 1440, 1100, `/founder/${created.id}`);
}

await browser.close();
console.log("captures written to", OUT);
