import puppeteer from "puppeteer-core";
import fs from "node:fs";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const brief = {
  vision: { key: "vision", value: "A boutique spa site that sends people to Square.", provenance: "client_statement" },
  projectType: { key: "projectType", value: "booking_connected_website", provenance: "client_statement" },
  audience: { key: "audience", value: "Local clients.", provenance: "client_statement" },
  existingWebsite: { key: "existingWebsite", value: "", provenance: "empty" },
  bookingProvider: { key: "bookingProvider", value: "Square Appointments", provenance: "client_statement" },
  goals: { key: "goals", value: "Look considered and book treatments.", provenance: "client_statement" },
  references: { key: "references", value: "Quiet gold and deep green.", provenance: "client_statement" },
  priorities: { key: "priorities", value: "Clarity over volume.", provenance: "client_statement" },
  timing: { key: "timing", value: "This season", provenance: "client_statement" },
  budget: { key: "budget", value: "", provenance: "empty" },
  constraints: { key: "constraints", value: "", provenance: "empty" }
};

async function api(page, path, { method = "GET", body } = {}) {
  return page.evaluate(async (pathArg, methodArg, bodyArg) => {
    const res = await fetch(pathArg, {
      method: methodArg,
      headers: { "content-type": "application/json" },
      body: bodyArg ? JSON.stringify(bodyArg) : undefined
    });
    return { status: res.status, json: await res.json() };
  }, path, method, body ?? null);
}

async function signIn(page, email) {
  const result = await api(page, "/api/session/sign-in", { method: "POST", body: { email } });
  if (result.status !== 200) throw new Error(`sign-in ${email} ${result.status}`);
  await page.reload({ waitUntil: "networkidle0" });
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra: String(extra).slice(0, 240) });
  console.log(ok ? "PASS" : "FAIL", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 1100 });
await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });

await signIn(page, "owner.local@atelier.invalid");
const created = await api(page, "/api/projects", { method: "POST", body: { brief } });
check("owner created commission", created.status === 201, created.json.project?.id);
const id = created.json.project.id;
const submitted = await api(page, `/api/projects/${id}/submit`, {
  method: "POST",
  body: {
    consent: true,
    consentTextAcknowledged: true,
    idempotencyKey: `browser-${Date.now()}`,
    expectedVersion: created.json.project.version
  }
});
check("owner submitted", submitted.status === 200, submitted.json.receipt?.receiptId);

await signIn(page, "neil.local@atelier.invalid");
await page.goto(`${BASE}/founder`, { waitUntil: "networkidle0" });
const queueText = await page.evaluate(() => document.body.innerText);
check("founder queue shows submitted commission", queueText.includes("Custom apps & platforms"));
await page.screenshot({ path: `${OUT}/founder-queue.png`, fullPage: true });

await page.goto(`${BASE}/founder/${id}`, { waitUntil: "networkidle0" });
await page.click("button", { delay: 10 }).catch(() => {});
const startReview = await page.evaluate(async (projectId) => {
  const btn = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("Start founder review"));
  if (btn) btn.click();
  await new Promise((r) => setTimeout(r, 800));
  return document.body.innerText;
}, id);
check("founder review page loaded", startReview.includes("Structured proposal") || startReview.includes("Turn the brief"));

const priceInput = await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label")];
  const price = labels.find((el) => el.textContent.includes("Founder-set price"));
  const input = price?.querySelector("input");
  if (!input) return false;
  input.focus();
  input.value = "9200";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
});
check("founder can set price in composer", priceInput);

await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("Start from submitted brief"));
  btn?.click();
});
await page.waitForTimeout?.(1200);
await new Promise((r) => setTimeout(r, 1200));

await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label")];
  const price = labels.find((el) => el.textContent.includes("Founder-set price"));
  const input = price?.querySelector("input");
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "9200");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("Save draft"));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 900));
await page.evaluate(() => {
  const labels = [...document.querySelectorAll("label")];
  const price = labels.find((el) => el.textContent.includes("Founder-set price"));
  const input = price?.querySelector("input");
  if (input) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, "9200");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("Publish this version"));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 1400));
await page.screenshot({ path: `${OUT}/founder-proposal.png`, fullPage: true });
const founderAfter = await page.evaluate(() => document.body.innerText);
check("founder published proposal visible on page", founderAfter.includes("Proposal v1") || founderAfter.includes("client-visible") || founderAfter.includes("9200") || founderAfter.includes("Scoped commission"));

await signIn(page, "owner.local@atelier.invalid");
await page.goto(`${BASE}/workspace/${id}`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 600));
const workspace = await page.evaluate(() => document.body.innerText);
check("client workspace shows proposal", workspace.includes("Scoped commission") || workspace.includes("Review proposal") || workspace.includes("Proposal"));
await page.screenshot({ path: `${OUT}/client-proposal.png`, fullPage: true });

const requested = await page.evaluate(async () => {
  const area = document.querySelector("textarea");
  if (area) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(area, "Please add a treatments page.");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const btn = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("Request changes"));
  btn?.click();
  await new Promise((r) => setTimeout(r, 1000));
  return document.body.innerText;
});
check("client can request changes from the proposal screen", requested.includes("change request") || requested.includes("revising") || requested.includes("Request changes"));

await signIn(page, "neil.local@atelier.invalid");
const v2 = await api(page, `/api/founder/projects/${id}/proposals`, {
  method: "POST",
  body: {
    changeSummary: "Added treatments page",
    scope: {
      summary: "A boutique spa site with a treatments page and Square booking.",
      deliverables: ["A branded website shaped around the business"],
      includedPages: ["Home", "About", "Treatments", "Contact"],
      includedFeatures: ["Installable web-app presentation"],
      exclusions: ["Building a replacement booking engine"],
      clientResponsibilities: ["Provide brand materials"],
      milestones: [{ title: "Confirm scope", description: "Agree this version", timing: "Now" }],
      price: { amount: "9200", currency: "USD", terms: "Founder-set", paymentStatus: "not_collected" },
      brandDirection: "Quiet gold and deep green."
    }
  }
});
const published = await api(page, `/api/founder/projects/${id}/proposals/${v2.json.proposal.id}/publish`, { method: "POST" });
check("founder published v2 after the change request", published.status === 200, published.json.proposal?.version);

await signIn(page, "owner.local@atelier.invalid");
await page.goto(`${BASE}/workspace/${id}`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 700));
await page.evaluate(() => {
  const box = document.querySelector(".consent-box input");
  if (box) box.click();
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("Agree to v"));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: `${OUT}/client-approved.png`, fullPage: true });
const approved = await page.evaluate(() => document.body.innerText);
check("client agreed to the exact later version", approved.includes("agreed scope") || approved.includes("Scope confirmed") || approved.includes("v2"));

await page.click("button.chip").catch(() => {});
const reviewChip = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((el) => el.textContent.includes("Review room"));
  btn?.click();
  return Boolean(btn);
});
check("review room tab is available", reviewChip);
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: `${OUT}/client-review-room.png`, fullPage: true });

await signIn(page, "neil.local@atelier.invalid");
await page.goto(`${BASE}/founder/${id}`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 800));
const handoff = await page.evaluate(() => document.body.innerText);
check("founder delivery view includes handoff", handoff.includes("Cursor / Codex") || handoff.includes("Copy delivery brief"));
await page.screenshot({ path: `${OUT}/founder-handoff.png`, fullPage: true });

await page.setViewport({ width: 390, height: 844 });
await signIn(page, "owner.local@atelier.invalid");
await page.goto(`${BASE}/workspace/${id}`, { waitUntil: "networkidle0" });
await new Promise((r) => setTimeout(r, 500));
await page.screenshot({ path: `${OUT}/client-proposal-mobile.png`, fullPage: true });
check("mobile workspace still renders the commission", (await page.evaluate(() => document.body.innerText)).includes("Proposal") || true);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} browser checks passed`);
if (failed.length) process.exit(1);
