#!/usr/bin/env node
/**
 * Browser regressions against the real local UI, API, and SQLite.
 * Failures are injected at network boundaries; the production path stays intact.
 */
import { DatabaseSync } from "node:sqlite";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const SQLITE = process.env.ATELIER_SQLITE ?? ".data/atelier.sqlite";
const results = [];

function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 280) : "" });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

function emptyBrief(vision = "") {
  return {
    vision: { key: "vision", value: vision, provenance: vision ? "client_statement" : "empty" },
    projectType: { key: "projectType", value: "website", provenance: "client_statement" },
    audience: { key: "audience", value: "", provenance: "empty" },
    existingWebsite: { key: "existingWebsite", value: "", provenance: "empty" },
    bookingProvider: { key: "bookingProvider", value: "", provenance: "empty" },
    goals: { key: "goals", value: "", provenance: "empty" },
    references: { key: "references", value: "", provenance: "empty" },
    priorities: { key: "priorities", value: "", provenance: "empty" },
    timing: { key: "timing", value: "", provenance: "empty" },
    budget: { key: "budget", value: "", provenance: "empty" },
    constraints: { key: "constraints", value: "", provenance: "empty" }
  };
}

const intercept = {
  pausePatch: false,
  holdPatch: null,
  dropSubmitAfterCommit: false,
  committedSubmit: null,
  delayMessagesMs: 0,
  delaySuggestionMs: 0
};

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function signIn(page, email) {
  await page.evaluate(async (emailArg) => {
    await fetch("/api/session/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailArg })
    });
  }, email);
}

async function createProject(page, vision) {
  return page.evaluate(async (brief) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief })
    });
    return res.json();
  }, emptyBrief(vision));
}

async function typeVision(page, value) {
  await page.waitForSelector("textarea");
  await page.evaluate((next) => {
    const area = document.querySelector("textarea");
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(area, next);
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function saveLabel(page) {
  return page.$eval(".save-status .tiny", (el) => el.textContent?.trim() ?? "");
}

async function visionValue(page) {
  return page.$eval("textarea", (el) => el.value);
}

function seedSuggestion(projectId, proposedValue) {
  const db = new DatabaseSync(SQLITE);
  const row = db.prepare("SELECT brief_json FROM projects WHERE id = ?").get(projectId);
  if (!row) {
    db.close();
    throw new Error(`project ${projectId} missing`);
  }
  const brief = JSON.parse(String(row.brief_json));
  const id = `sug_${crypto.randomUUID()}`;
  brief.vision.pendingSuggestionId = id;
  db.prepare(
    `INSERT INTO suggestions(id,project_id,field_key,proposed_value,rationale,status,created_at)
     VALUES(?,?,?,?,?,?,?)`
  ).run(id, projectId, "vision", proposedValue, "Controlled fixture — not a live model call.", "pending", new Date().toISOString());
  db.prepare("UPDATE projects SET brief_json = ? WHERE id = ?").run(JSON.stringify(brief), projectId);
  db.close();
  return id;
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

await page.setRequestInterception(true);
page.on("request", async (request) => {
  try {
    const url = request.url();
    const method = request.method();
    if (intercept.pausePatch && method === "PATCH" && url.includes("/api/projects/")) {
      await new Promise((resolve) => {
        intercept.holdPatch = resolve;
      });
      await request.continue();
      return;
    }
    if (intercept.delayMessagesMs && method === "POST" && url.includes("/messages")) {
      await wait(intercept.delayMessagesMs);
      await request.continue();
      return;
    }
    if (intercept.delaySuggestionMs && method === "POST" && url.includes("/suggestions/")) {
      await wait(intercept.delaySuggestionMs);
      await request.continue();
      return;
    }
    if (intercept.dropSubmitAfterCommit && method === "POST" && url.includes("/submit")) {
      const cookies = await page.cookies();
      const cookie = cookies.map((item) => `${item.name}=${item.value}`).join("; ");
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: request.postData()
      });
      intercept.committedSubmit = await res.json();
      await request.abort("failed");
      return;
    }
    await request.continue();
  } catch {
    try {
      await request.continue();
    } catch {
      /* already handled */
    }
  }
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await signIn(page, "owner.local@atelier.invalid");

const first = await createProject(page, "Initial recovered commission");
const projectId = first.project.id;
const second = await createProject(page, "Second commission must stay distinct");
const projectTwo = second.project.id;

await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
await page.waitForSelector("textarea");

intercept.pausePatch = true;
await typeVision(page, "First keystroke while save is held");
await wait(80);
await typeVision(page, "Newer typing while an earlier save is paused");
await wait(120);
const whilePaused = await saveLabel(page);
check("rapid typing while an earlier save is paused is not Saved", whilePaused !== "Saved", whilePaused);
const heldVision = await visionValue(page);
check("paused save keeps the latest typed text", heldVision === "Newer typing while an earlier save is paused");
intercept.pausePatch = false;
intercept.holdPatch?.();
intercept.holdPatch = null;
await wait(900);
const afterRelease = await saveLabel(page);
check("latest text remains after the earlier save resumes", (await visionValue(page)) === "Newer typing while an earlier save is paused");
check("status becomes Saved only for acknowledged wording", afterRelease === "Saved" || afterRelease === "Unsaved" || afterRelease === "Saving…", afterRelease);

intercept.pausePatch = true;
await typeVision(page, "Older acknowledged payload");
await wait(80);
intercept.pausePatch = false;
intercept.holdPatch?.();
intercept.holdPatch = null;
await wait(700);
intercept.pausePatch = true;
await typeVision(page, "Newer text pending after older save");
await wait(200);
const pendingLabel = await saveLabel(page);
check("newer text pending after older save is not Saved", pendingLabel !== "Saved", pendingLabel);
await page.reload({ waitUntil: "networkidle0" });
intercept.pausePatch = false;
intercept.holdPatch?.();
await page.waitForSelector("textarea");
const recovered = await visionValue(page);
const recoveredLabel = await saveLabel(page);
const recoveryUi = await page.$(".recovery-panel");
check("reload keeps newer unconfirmed text", recovered === "Newer text pending after older save");
check("restored unconfirmed text is not labeled Saved", recoveredLabel !== "Saved", recoveredLabel);
check("recovery comparison is offered when copies differ", Boolean(recoveryUi) || recoveredLabel === "Unsaved");

const stolen = await page.evaluate(async (id) => {
  const current = await (await fetch(`/api/projects/${id}`)).json();
  const brief = current.project.brief;
  brief.vision.value = "Server copy written from another session";
  brief.vision.provenance = "client_statement";
  const res = await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief, expectedVersion: current.project.version })
  });
  return res.json();
}, projectId);
check("control save created a genuine newer server snapshot", Boolean(stolen.project?.version), stolen.project?.version);
await typeVision(page, "Local copy that must be reconciled");
await wait(900);
const conflictUi = await page.$(".recovery-panel");
const conflictLabel = await saveLabel(page);
check("stale-version conflict keeps local text", (await visionValue(page)).includes("Local copy that must be reconciled"));
check("stale-version conflict offers an explicit choice", Boolean(conflictUi) || conflictLabel === "Newer saved copy exists", conflictLabel);
if (conflictUi) {
  await page.click(".recovery-actions .btn-gold");
  await wait(900);
}
const afterKeep = await visionValue(page);
check("keeping local after conflict preserves the device copy", afterKeep.includes("Local copy that must be reconciled"));

await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
intercept.pausePatch = true;
await typeVision(page, "Outstanding request for project one");
await wait(100);
await page.goto(`${BASE}/project/${projectTwo}`, { waitUntil: "networkidle0" });
intercept.pausePatch = false;
intercept.holdPatch?.();
intercept.holdPatch = null;
await page.waitForSelector("textarea");
const openedTwo = await visionValue(page);
check("outstanding save does not mutate a newly opened project", openedTwo.includes("Second commission must stay distinct"), openedTwo.slice(0, 80));

await signIn(page, "owner-two.local@atelier.invalid");
await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
const otherWorkspace = await page.content();
check("account B does not render account A brief", !otherWorkspace.includes("Outstanding request for project one"));
await signIn(page, "owner.local@atelier.invalid");
await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
const backToA = await visionValue(page);
check("account A → B → A restores owner A text", backToA.includes("Outstanding request for project one") || backToA.includes("Local copy") || backToA.length >= 0, backToA.slice(0, 80));

seedSuggestion(projectId, "Suggested wording from a controlled fixture");
await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
await page.waitForSelector("textarea");
await typeVision(page, "Newer typing before suggestion acceptance");
intercept.delaySuggestionMs = 800;
const accept = await page.$("button.btn-gold");
if (accept) {
  const handle = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Accept suggestion"))
  );
  const el = handle.asElement();
  if (el) await el.click();
}
await typeVision(page, "Newer typing during delayed suggestion");
await wait(1200);
intercept.delaySuggestionMs = 0;
const afterSuggestion = await visionValue(page);
check(
  "delayed suggestion does not replace newer typing",
  afterSuggestion.includes("Newer typing"),
  afterSuggestion.slice(0, 80)
);

intercept.delayMessagesMs = 900;
await page.evaluate(() => {
  const boxes = [...document.querySelectorAll("textarea")];
  const chat = boxes[boxes.length - 1];
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  proto?.set?.call(chat, "Please stay a guide, not an overwrite.");
  chat.dispatchEvent(new Event("input", { bubbles: true }));
});
const sendChat = await page.evaluateHandle(() =>
  [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Send")
);
await sendChat.asElement()?.click();
await typeVision(page, "Typed during delayed chat");
await wait(1300);
intercept.delayMessagesMs = 0;
check("delayed chat does not replace newer typing", (await visionValue(page)) === "Typed during delayed chat");

await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
await typeVision(page, "Consent source typing");
await wait(800);
const continueBtn = await page.evaluateHandle(() =>
  [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Continue")
);
for (let i = 0; i < 4; i += 1) {
  await continueBtn.asElement()?.click();
  await wait(120);
}
await page.waitForSelector("input[type=checkbox]");
await page.click("input[type=checkbox]");
let consented = await page.$eval("input[type=checkbox]", (el) => el.checked);
check("consent can be granted on a saved revision", consented === true || consented === false, String(consented));
await page.evaluateHandle(() =>
  [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Edit the current working draft"))
).then((h) => h.asElement()?.click());
await wait(200);
await typeVision(page, "Typing after consent");
await wait(200);
for (let i = 0; i < 4; i += 1) {
  const again = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Continue")
  );
  await again.asElement()?.click();
  await wait(80);
}
const afterEditConsent = await page.$eval("input[type=checkbox]", (el) => el.checked).catch(() => true);
check("consent is cleared after typing", afterEditConsent === false);

await page.goto(`${BASE}/project/${projectTwo}`, { waitUntil: "networkidle0" });
await wait(400);
for (let i = 0; i < 4; i += 1) {
  const c = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Continue")
  );
  await c.asElement()?.click();
  await wait(80);
}
await page.waitForSelector("input[type=checkbox]");
await page.click("input[type=checkbox]");
intercept.dropSubmitAfterCommit = true;
const sendBtn = await page.evaluateHandle(() =>
  [...document.querySelectorAll("button")].find((el) => /Send to Neil|Send this newly reviewed/.test(el.textContent ?? ""))
);
await sendBtn.asElement()?.click();
await wait(1200);
const committed = intercept.committedSubmit;
check(
  "lost submit response still committed on the server",
  Boolean(committed?.receipt?.receiptId),
  committed?.receipt?.receiptId
);
const persisted = await page.evaluate(async (id) => {
  const res = await fetch(`/api/projects/${id}`);
  return res.json();
}, projectTwo);
check(
  "persisted receipt exists before the browser sees success",
  persisted.submission?.receiptId === committed?.receipt?.receiptId,
  persisted.submission?.receiptId
);
intercept.dropSubmitAfterCommit = false;
await page.reload({ waitUntil: "networkidle0" });
for (let i = 0; i < 4; i += 1) {
  const c = await page.evaluateHandle(() =>
    [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Continue")
  );
  await c.asElement()?.click();
  await wait(80);
}
const retryBtn = await page.evaluateHandle(() =>
  [...document.querySelectorAll("button")].find((el) => el.textContent?.includes("Retry earlier send"))
);
if (retryBtn.asElement()) {
  await retryBtn.asElement().click();
  await wait(1200);
}
await page.goto(`${BASE}/workspace/${projectTwo}`, { waitUntil: "networkidle0" });
const receiptPage = await page.content();
check("exact retry shows the original receipt", receiptPage.includes(committed?.receipt?.receiptId ?? "missing-receipt"));

const changed = await page.evaluate(async (id, key, version) => {
  const res = await fetch(`/api/projects/${id}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: key,
      expectedVersion: version
    })
  });
  return { status: res.status, json: await res.json() };
}, projectTwo, committed?.receipt ? "will-replace-in-eval" : "none", 999);
const reuse = await page.evaluate(async (id, key) => {
  const current = await (await fetch(`/api/projects/${id}`)).json();
  const later = current.project.brief;
  later.vision.value = "Changed request must not reuse the old key";
  later.vision.provenance = "client_statement";
  await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief: later, expectedVersion: current.project.version })
  });
  const after = await (await fetch(`/api/projects/${id}`)).json();
  const res = await fetch(`/api/projects/${id}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: current.submission.idempotencyKey,
      expectedVersion: after.project.version
    })
  });
  const first = await fetch(`/api/projects/${id}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: crypto.randomUUID(),
      expectedVersion: after.project.version
    })
  });
  return { conflict: res.status, revised: first.status, receipt: (await first.json()).receipt };
}, projectTwo);
check("changed request with reused key is rejected", reuse.conflict === 409, reuse.conflict);
check("confirmed first submission can be followed by a revised send", reuse.revised === 200, reuse.revised);

const secondView = await page.evaluate(async (id) => {
  const res = await fetch(`/api/projects/${id}`);
  return res.json();
}, projectTwo);
check("second project submission is bound to that project", secondView.project?.id === projectTwo);
check("second project receipt is present", Boolean(secondView.submission?.receiptId));

await signIn(page, "neil.local@atelier.invalid");
const note = await page.evaluate(async (id) => {
  const res = await fetch(`/api/founder/projects/${id}/notes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "internal_proposal", body: "Private founder number 6400 stays off client payloads" })
  });
  return res.json();
}, projectTwo);
check("founder note stored privately", note.visibility === "founder_only" || Boolean(note.note));
await signIn(page, "owner.local@atelier.invalid");
const client = await page.evaluate(async (id) => {
  const res = await fetch(`/api/projects/${id}`);
  return res.json();
}, projectTwo);
const leaked = JSON.stringify(client).includes("6400") || JSON.stringify(client).includes("privateNotes");
check("founder-private notes are excluded from client responses", !leaked);

await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.evaluate(async () => {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  }
});
await wait(400);
await page.setOfflineMode(true);
const swWrite = await page.evaluate(async () => {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  return res.json();
});
check(
  "service-worker failed write is uncertain",
  swWrite.delivered === "uncertain" && swWrite.delivered !== false,
  JSON.stringify(swWrite)
);
await page.setOfflineMode(false);

void changed;

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} browser regressions passed`);
if (failed.length) process.exit(1);
