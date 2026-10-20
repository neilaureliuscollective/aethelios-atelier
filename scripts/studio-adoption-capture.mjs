#!/usr/bin/env node
/** Browser proof: confirm → matching Studio draft → edit → save → reopen. */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const selection = {
  selectionId: `dsel_${crypto.randomUUID()}`,
  localRevision: 1,
  catalogVersion: 1,
  templateVersion: 1,
  businessName: "AETHELIOS RESERVE",
  businessType: "not_sure",
  audience: "Planning study for supplier-backed catalogs.",
  desiredQualities: ["refined"],
  intent: "clearer_presence",
  intentNote: "Full brand and existing-identity extension. Planning only.",
  customerFeeling: "calm",
  selectedDirectionId: "lumen",
  visualPreferences: { paletteId: "ivory_hall", visualDirectionId: "glass", headline: "Considered sourcing" },
  serviceInterest: "unspecified",
  likesNote: "",
  changeNote: "",
  visitorNotes: "",
  exclusions: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width <= 390 ? 844 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  const file = path.join(OUT, `adopt_${name}_${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

async function signIn(page, email) {
  const result = await page.evaluate(async (emailArg) => {
    const res = await fetch("/api/session/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailArg })
    });
    return { status: res.status, ok: res.ok };
  }, email);
  if (!result.ok) throw new Error(`sign-in ${email} ${result.status}`);
  await page.reload({ waitUntil: "networkidle0" });
}

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(page, "owner.local@atelier.invalid");

await page.evaluate((next) => {
  window.sessionStorage.setItem(
    "aethelios.atelier.discovery.handoff.v1",
    JSON.stringify({ kind: "discovery_handoff", selection: next })
  );
  window.sessionStorage.setItem(
    "aethelios.atelier.guestIntent.v1",
    JSON.stringify({
      version: 1,
      kind: "guest_intent",
      guestWorkId: next.selectionId,
      destination: "/companion/confirm",
      selectionId: next.selectionId,
      localRevision: next.localRevision,
      updatedAt: new Date().toISOString()
    })
  );
}, selection);

await page.goto(`${BASE}/companion/confirm`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => /Lumen|Checking/i.test(document.body.innerText), { timeout: 8000 });
await page.waitForFunction(() => !/Checking authorization/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
await page.waitForFunction(() => /Lumen/i.test(document.body.innerText), { timeout: 8000 });
await shot(page, 1440, "confirm_direction");
await shot(page, 390, "confirm_direction");

const nameInput = await page.$("input");
if (nameInput) {
  await nameInput.click({ clickCount: 3 });
  await nameInput.type("AETHELIOS RESERVE");
}
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => /Confirm and continue/i.test(node.textContent || ""));
  button?.click();
});
await page.waitForFunction(() => /Replace the previous direction|Adopt the newer revision|Opening the matching Studio|Brand Studio|Considered sourcing/i.test(document.body.innerText), {
  timeout: 12000
});
const needsReplace = await page.evaluate(() => /Replace the previous direction|Adopt the newer revision/i.test(document.body.innerText));
if (needsReplace) {
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => /Replace the previous direction|Adopt the newer revision/i.test(node.textContent || ""));
    button?.click();
  });
}
await page.waitForFunction(() => /Opening the matching Studio|Brand Studio|Considered sourcing/i.test(document.body.innerText), {
  timeout: 12000
});
await page.waitForFunction(() => !/Checking this workspace|Resolving authorization/i.test(document.body.innerText), {
  timeout: 10000
}).catch(() => {});
await shot(page, 1440, "studio_matching");
await shot(page, 390, "studio_matching");
await shot(page, 884, "studio_matching");

const draftId = await page.evaluate(() => new URL(window.location.href).searchParams.get("draftId"));
if (!draftId) throw new Error("confirmation did not navigate to an exact Studio draft");

const headlineEl = await page.$("#headline");
if (!headlineEl) throw new Error("Studio headline field was not available");
await headlineEl.click({ clickCount: 3 });
await headlineEl.type("Considered sourcing · reserved");
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => /Save layers/i.test(node.textContent || ""));
  button?.click();
});
await page.waitForFunction(() => /Saved/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
await shot(page, 1440, "studio_edited");
await shot(page, 390, "studio_edited");

await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});

const fresh = await browser.newPage();
await fresh.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await fresh.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(fresh, "owner.local@atelier.invalid");
await fresh.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(draftId)}`, { waitUntil: "networkidle0" });
await fresh.waitForFunction(() => /Considered sourcing/i.test(document.body.innerText), { timeout: 10000 });
await shot(fresh, 1440, "studio_reopened");

const other = await browser.newPage();
await other.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(other, "owner-two.local@atelier.invalid");
const isolation = await other.evaluate(async (id) => {
  const workspace = await fetch("/api/companion/workspace").then((res) => res.json());
  const stolen = await fetch(`/api/companion/studio?businessId=${workspace.business.id}&draftId=${encodeURIComponent(id)}`);
  const foreign = await fetch(`/api/companion/studio?draftId=${encodeURIComponent(id)}`);
  return {
    otherBusiness: workspace.business?.id ?? null,
    stolenStatus: stolen.status,
    foreignStatus: foreign.status
  };
}, draftId);
console.log("isolation", JSON.stringify(isolation));
if (isolation.stolenStatus === 200 || isolation.foreignStatus === 200) {
  throw new Error("second account obtained the adopted Studio draft");
}
await other.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(draftId)}`, { waitUntil: "networkidle0" });
await shot(other, 1440, "studio_foreign_blocked");

fs.writeFileSync(
  path.join(OUT, "adopt_journey.json"),
  JSON.stringify({ draftId, selectionId: selection.selectionId, isolation }, null, 2)
);

await browser.close();
console.log("draft", draftId);
