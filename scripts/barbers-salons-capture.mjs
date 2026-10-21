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

await shot("barbers_hero_desktop_1440", 1440, 1100, "/services/barbers-salons");
await shot("barbers_hero_tablet_768", 768, 1024, "/services/barbers-salons");
await shot("barbers_hero_phone_390", 390, 844, "/services/barbers-salons");

await shot("barbers_showcase_desktop", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#demonstration")?.scrollIntoView({ block: "start" }));
  const buttons = await p.$$(".barbers-demo-nav button");
  if (buttons[2]) await buttons[2].click();
  await new Promise((resolve) => setTimeout(resolve, 250));
});

await shot("barbers_showcase_book_handoff", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#demonstration")?.scrollIntoView({ block: "start" }));
  const buttons = await p.$$(".barbers-demo-nav button");
  const last = buttons[buttons.length - 1];
  if (last) await last.click();
  await new Promise((resolve) => setTimeout(resolve, 250));
});

await shot("barbers_scope_care", 1440, 1100, "/services/barbers-salons", async (p) => {
  await p.evaluate(() => document.querySelector("#care")?.scrollIntoView({ block: "start" }));
});

await shot("barbers_intake_mobile_390", 390, 844, "/project?offer=barbers_salons&interest=website&purpose=business&booking=1");
await shot("barbers_intake_desktop", 1440, 1100, "/project?offer=barbers_salons&interest=website&purpose=business&booking=1");

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
    vision: field("vision", "Ash Street Barbers — isolated capture brief."),
    projectType: field("projectType", "website"),
    audience: field("audience", "Barber"),
    existingWebsite: field("existingWebsite", ""),
    bookingProvider: field("bookingProvider", "https://example.com/book"),
    goals: field("goals", "Cuts, beard work, and a clear booking action."),
    references: field("references", "Gold emblem pending. Shop photographs to follow."),
    priorities: field("priorities", "Story and team · Services · Booking action"),
    timing: field("timing", ""),
    budget: field("budget", ""),
    constraints: field("constraints", "One location. Keep the current booking provider."),
    context: {
      version: 1,
      purpose: "business",
      route: "business",
      exampleId: "",
      bookingNeeded: true,
      offerId: "barbers_salons"
    }
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
      idempotencyKey: `capture-barbers-${Date.now()}`,
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
  return { id: created.project.id, submitted };
});

if (!created.id) {
  console.error("founder capture skipped", JSON.stringify(created));
} else {
  await shot("barbers_founder_review", 1440, 1100, `/founder/${created.id}`);
}

await browser.close();
console.log("captures written to", OUT);
