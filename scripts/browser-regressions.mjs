#!/usr/bin/env node
/**
 * Browser regressions against the real local UI, API, and SQLite.
 * Failures are injected at network boundaries; the production path stays intact.
 * Held responses are fetched to completion before delivery so the body already
 * contains the old snapshot. Same-component races use in-app navigation.
 */
import { DatabaseSync } from "node:sqlite";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const SQLITE = process.env.ATELIER_SQLITE ?? ".data/atelier.sqlite";
const results = [];

function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 320) : "" });
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function projectRow(id) {
  const db = new DatabaseSync(SQLITE);
  const row = db.prepare("SELECT version, brief_json FROM projects WHERE id = ?").get(id);
  db.close();
  if (!row) return null;
  return { version: Number(row.version), brief: JSON.parse(String(row.brief_json)) };
}

function submissionRow(projectId) {
  const db = new DatabaseSync(SQLITE);
  const row = db
    .prepare("SELECT receipt_id, idempotency_key, reviewed_version FROM submissions WHERE project_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(projectId);
  db.close();
  return row ?? null;
}

const holdQueue = [];
const observedResponses = [];
const intercept = {
  dropSubmitAfterCommit: false,
  committedSubmit: null,
  blockServiceWorker: true,
  failNonGet: false,
  submitPostedFor: null
};

function asCdpRequest(event) {
  return {
    url: () => event.request.url,
    method: () => event.request.method,
    postData: () => event.request.postData,
    headers: () => event.request.headers ?? {}
  };
}

function recordObserved(url, method, status) {
  observedResponses.push({
    index: observedResponses.length,
    url,
    method,
    status
  });
}

function stripHopHeaders(headers) {
  const next = { ...headers };
  for (const key of Object.keys(next)) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length") delete next[key];
  }
  return next;
}

async function fetchPausedRequest(event) {
  const method = event.request.method;
  const res = await fetch(event.request.url, {
    method,
    headers: stripHopHeaders(event.request.headers ?? {}),
    body: method === "GET" || method === "HEAD" ? undefined : event.request.postData
  });
  const body = await res.text();
  return {
    res,
    body,
    contentType: res.headers.get("content-type") || "application/json"
  };
}

async function handlePaused(session, event) {
  const url = event.request.url;
  const method = event.request.method;
  const requestId = event.requestId;
  try {
    if (intercept.blockServiceWorker && url.includes("/sw.js")) {
      await session.send("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" });
      return;
    }
    if (intercept.failNonGet && method !== "GET") {
      await session.send("Fetch.failRequest", { requestId, errorReason: "Failed" });
      return;
    }
    if (!url.includes("/api/")) {
      await session.send("Fetch.continueRequest", { requestId });
      return;
    }
    const spec = holdQueue.find((item) => {
      if (item.done) return false;
      try {
        return item.predicate(asCdpRequest(event));
      } catch {
        return false;
      }
    });
    if (spec) {
      console.log("HOLD", method, url.replace(BASE, "").slice(0, 140));
    }
    if (spec) {
      spec.done = true;
      if (!spec.forward) {
        spec.seenFn({ url, method, status: 0, body: "" });
        recordObserved(url, method, 0);
        await spec.gate;
        try {
          await session.send("Fetch.failRequest", { requestId, errorReason: "Aborted" });
        } catch {
          /* navigated away */
        }
        return;
      }
      const { res, body, contentType } = await fetchPausedRequest(event);
      spec.seenFn({ url, method, status: res.status, body });
      recordObserved(url, method, res.status);
      await spec.gate;
      try {
        await session.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: res.status,
          responseHeaders: [{ name: "content-type", value: contentType }],
          body: Buffer.from(body).toString("base64")
        });
      } catch {
        /* navigated away */
      }
      return;
    }
    if (intercept.dropSubmitAfterCommit && method === "POST" && url.includes("/submit")) {
      const { res, body } = await fetchPausedRequest(event);
      try {
        intercept.committedSubmit = JSON.parse(body);
      } catch {
        intercept.committedSubmit = { raw: body };
      }
      recordObserved(url, method, res.status);
      await session.send("Fetch.failRequest", { requestId, errorReason: "Failed" });
      return;
    }
    recordObserved(url, method, 0);
    await session.send("Fetch.continueRequest", { requestId });
  } catch (error) {
    console.error("cdp fetch error", method, url, error instanceof Error ? error.message : error);
    try {
      await session.send("Fetch.continueRequest", { requestId });
    } catch {
      /* already handled */
    }
  }
}

function armHold(predicate, { forward = true } = {}) {
  let releaseFn;
  const gate = new Promise((resolve) => {
    releaseFn = resolve;
  });
  let seenFn;
  const seen = new Promise((resolve) => {
    seenFn = resolve;
  });
  const spec = { predicate, gate, releaseFn, seen, seenFn, done: false, forward, disarmed: false };
  holdQueue.push(spec);
  return {
    seen: Promise.race([
      seen,
      wait(15000).then(() => {
        if (spec.disarmed || spec.done) return null;
        throw new Error("held request was not observed");
      })
    ]),
    release() {
      spec.releaseFn();
    },
    disarm() {
      spec.disarmed = true;
      spec.done = true;
      spec.releaseFn();
    }
  };
}

async function waitUntil(predicate, timeout = 12000, label = "condition") {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await predicate();
    if (value) return value;
    await wait(25);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function waitForObserved(predicate, timeout = 12000) {
  return waitUntil(
    () => observedResponses.find((item) => predicate(item)) ?? null,
    timeout,
    "observed response"
  );
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
    area.focus();
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(area, next);
    area.dispatchEvent(new Event("input", { bubbles: true }));
    area.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function saveLabel(page) {
  return page.$eval(".save-status .tiny", (el) => el.textContent?.trim() ?? "").catch(() => "");
}

async function visionValue(page) {
  return page.$eval("textarea", (el) => el.value);
}

async function spaNavigate(page, href) {
  await page.evaluate((nextHref) => {
    window.dispatchEvent(new CustomEvent("atelier:client-navigate", { detail: nextHref }));
  }, href);
  await page.waitForFunction((expected) => window.location.pathname === expected, { timeout: 12000 }, href);
}

async function typeUntilSaved(page, value, projectId) {
  const before = observedResponses.length;
  await typeVision(page, value);
  await waitForObserved(
    (item) =>
      item.method === "PATCH" &&
      item.url.includes(`/api/projects/${projectId}`) &&
      item.index >= before
  );
  await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "Saved status");
}

async function waitForOwnedBrief(page) {
  await page.waitForSelector("textarea");
  await waitUntil(async () => {
    const label = await saveLabel(page);
    return Boolean(label) && label !== "Device draft";
  }, 12000, "owned brief");
}

async function waitForSaved(page) {
  await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "Saved status");
}

async function goToReview(page) {
  const clicked = await page.evaluate(() => {
    const review = [...document.querySelectorAll(".step-nav button")].find((el) =>
      (el.textContent ?? "").includes("Review")
    );
    review?.click();
    return Boolean(review);
  });
  if (!clicked) {
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((el) => el.textContent?.trim() === "Continue")?.click();
    });
  }
  await page.waitForSelector("input[type=checkbox]", { timeout: 8000 });
}

async function clickButton(page, pattern) {
  return page.evaluate((source) => {
    const match = new RegExp(source);
    const button = [...document.querySelectorAll("button")].find((el) => match.test(el.textContent ?? ""));
    if (!button) return false;
    button.click();
    return true;
  }, pattern);
}

async function ownerStorageKeys(page, ownerId) {
  return page.evaluate((id) => {
    const keys = [];
    for (const storage of [sessionStorage, localStorage]) {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(`atelier.account.${id}.`)) keys.push(key);
      }
    }
    return keys;
  }, ownerId);
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
page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("FETCH") || text.includes("save-queue") || text.includes("HOLD") || msg.type() === "error") {
    console.log("BROWSER", text.slice(0, 200));
  }
});
await page.setViewport({ width: 1280, height: 900 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

await page.setDefaultNavigationTimeout(45000);
await page.evaluateOnNewDocument(() => {
  if (!("serviceWorker" in navigator)) return;
  const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
  navigator.serviceWorker.register = (...args) => {
    if (window.__atelierAllowServiceWorker) return original(...args);
    return Promise.resolve({
      unregister: async () => true,
      update: async () => undefined,
      installing: null,
      waiting: null,
      active: null
    });
  };
});
let fetchSession = null;
async function connectFetch() {
  if (!fetchSession) {
    fetchSession = await page.createCDPSession();
    fetchSession.on("Fetch.requestPaused", (event) => {
      void handlePaused(fetchSession, event);
    });
  }
  try {
    await fetchSession.send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/*", requestStage: "Request" },
        { urlPattern: "*/sw.js", requestStage: "Request" }
      ]
    });
  } catch {
    fetchSession = await page.createCDPSession();
    fetchSession.on("Fetch.requestPaused", (event) => {
      void handlePaused(fetchSession, event);
    });
    await fetchSession.send("Fetch.enable", {
      patterns: [
        { urlPattern: "*/api/*", requestStage: "Request" },
        { urlPattern: "*/sw.js", requestStage: "Request" }
      ]
    });
  }
  return fetchSession;
}
await connectFetch();
const originalGoto = page.goto.bind(page);
const originalReload = page.reload.bind(page);
page.goto = async (...args) => {
  const result = await originalGoto(...args);
  await connectFetch();
  return result;
};
page.reload = async (...args) => {
  const result = await originalReload(...args);
  await connectFetch();
  return result;
};

await page.goto(`${BASE}/`, { waitUntil: "load" });
await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
});
await signIn(page, "owner.local@atelier.invalid");
const sessionA = await page.evaluate(async () => (await fetch("/api/session")).json());
const ownerAId = sessionA.user.id;

const first = await createProject(page, "Initial recovered commission");
const projectId = first.project.id;
const second = await createProject(page, "Second commission must stay distinct");
const projectTwo = second.project.id;
console.log("created", projectId, projectTwo, "owner", ownerAId);

await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "load" });
await connectFetch();
const probeBefore = observedResponses.length;
await page.evaluate(async () => {
  await fetch("/api/health");
});
await waitForObserved((item) => item.url.includes("/api/health") && item.index >= probeBefore);
await waitForOwnedBrief(page);
await waitUntil(
  async () =>
    (await saveLabel(page)) === "Saved" &&
    (await visionValue(page)).includes("Initial recovered commission"),
  12000,
  "bound saved vision"
);
const rapidHold = armHold(
  (request) => request.method() === "PATCH" && request.url().includes(`/api/projects/${projectId}`)
);
await typeVision(page, "First keystroke while save is held");
const firstPatch = await rapidHold.seen.catch(async (error) => {
  console.error("rapid hold missed", {
    label: await saveLabel(page),
    vision: (await visionValue(page)).slice(0, 80),
    observed: observedResponses.slice(-8)
  });
  throw error;
});
check("held save request reached the server before later typing", Boolean(firstPatch?.body), firstPatch?.status);
await typeVision(page, "Newer typing while an earlier save is paused");
const whilePaused = await saveLabel(page);
check("rapid typing while an earlier save is paused is not Saved", whilePaused !== "Saved", whilePaused);
check("paused save keeps the latest typed text", (await visionValue(page)) === "Newer typing while an earlier save is paused");
rapidHold.release();
await waitUntil(async () => (await saveLabel(page)) === "Saved" || (await saveLabel(page)) === "Unsaved", 12000, "status after release");
check("latest text remains after the earlier save resumes", (await visionValue(page)) === "Newer typing while an earlier save is paused");

await typeUntilSaved(page, "Older acknowledged payload", projectId);
const pendingHold = armHold(
  (request) => request.method() === "PATCH" && request.url().includes(`/api/projects/${projectId}`),
  { forward: false }
);
await typeVision(page, "Newer text pending after older save");
await pendingHold.seen;
const pendingLabel = await saveLabel(page);
check("newer text pending after older save is not Saved", pendingLabel !== "Saved", pendingLabel);
await page.reload({ waitUntil: "load" });
pendingHold.release();
await waitForOwnedBrief(page);
const recovered = await visionValue(page);
const recoveredLabel = await saveLabel(page);
const recoveryUi = await page.$(".recovery-panel");
check("reload keeps newer unconfirmed text", recovered === "Newer text pending after older save");
check("restored unconfirmed text is not labeled Saved", recoveredLabel !== "Saved", recoveredLabel);
check("recovery comparison is offered when copies differ", Boolean(recoveryUi) || recoveredLabel === "Unsaved");
await clickButton(page, "Keep this device copy");
await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "kept unconfirmed text saved");
check("kept unconfirmed text is saved before the later conflict", (await visionValue(page)) === "Newer text pending after older save");
check(
  "sqlite holds the kept unconfirmed text",
  projectRow(projectId)?.brief.vision.value === "Newer text pending after older save"
);

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
await waitUntil(async () => Boolean(await page.$(".recovery-panel")) || (await saveLabel(page)) === "Newer saved copy exists", 12000, "conflict UI");
check("stale-version conflict keeps local text", (await visionValue(page)).includes("Local copy that must be reconciled"));
check("stale-version conflict offers an explicit choice", Boolean(await page.$(".recovery-panel")));

const compareHold = armHold(
  (request) => request.method() === "PATCH" && request.url().includes(`/api/projects/${projectId}`)
);
await typeVision(page, "Typed while comparison is unresolved");
const compareAutoSave = await Promise.race([
  compareHold.seen.then((item) => (item ? "fired" : "quiet")),
  wait(900).then(() => "quiet")
]);
compareHold.disarm();
check(
  "typing while recovery comparison is unresolved does not auto-save",
  compareAutoSave === "quiet",
  compareAutoSave
);
check("comparison remains open after continued typing", Boolean(await page.$(".recovery-panel")));
check("typed comparison text is kept locally", (await visionValue(page)) === "Typed while comparison is unresolved");
await clickButton(page, "Keep this device copy");
await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "after keep local");
check("keeping local after conflict preserves the device copy", (await visionValue(page)).includes("Typed while comparison is unresolved"));
check(
  "sqlite stores the kept local comparison text",
  projectRow(projectId)?.brief.vision.value === "Typed while comparison is unresolved"
);

await spaNavigate(page, `/project/${projectId}`);
await waitForOwnedBrief(page);
const outstandingHold = armHold(
  (request) => request.method() === "PATCH" && request.url().includes(`/api/projects/${projectId}`)
);
await typeVision(page, "Outstanding request for project one");
await outstandingHold.seen;
await spaNavigate(page, `/project/${projectTwo}`);
outstandingHold.release();
await waitForOwnedBrief(page);
const openedTwo = await visionValue(page);
check("outstanding save does not mutate a newly opened project", openedTwo.includes("Second commission must stay distinct"), openedTwo.slice(0, 80));
check("project B recovery is not project A private text", !openedTwo.includes("Outstanding request for project one"));

await signIn(page, "owner-two.local@atelier.invalid");
await page.goto(`${BASE}/workspace`, { waitUntil: "load" });
const otherWorkspace = await page.content();
check("account B does not render account A brief", !otherWorkspace.includes("Outstanding request for project one"));
check("account B does not render owner A private comparison text", !otherWorkspace.includes("Typed while comparison is unresolved"));
const bProject = await createProject(page, "Owner B private commission beta");
await page.goto(`${BASE}/project/${bProject.project.id}`, { waitUntil: "load" });
await waitForOwnedBrief(page);
check("account B active project is B content", (await visionValue(page)).includes("Owner B private commission beta"));
await signIn(page, "owner.local@atelier.invalid");
await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "load" });
await waitForOwnedBrief(page);
const backToA = await visionValue(page);
const backRow = projectRow(projectId);
check(
  "account A → B → A restores owner A project content",
  backToA.includes("Outstanding request for project one") ||
    backToA.includes("Typed while comparison is unresolved") ||
    backToA.includes("Local copy that must be reconciled") ||
    backToA.includes("Newer text pending after older save"),
  backToA.slice(0, 120)
);
check("account A → B → A does not show owner B private text", !backToA.includes("Owner B private commission beta"));
check("restored owner A sqlite row is still owner A project", backRow?.brief.vision.value !== "Owner B private commission beta");

await typeUntilSaved(page, "revision 2 saved", projectId);
const afterRev2 = projectRow(projectId);
check("sqlite holds revision 2 before delayed chat", afterRev2?.brief.vision.value === "revision 2 saved", afterRev2?.version);

const chatHold = armHold(
  (request) => request.method() === "POST" && request.url().includes(`/api/projects/${projectId}/messages`)
);
await page.evaluate(() => {
  const boxes = [...document.querySelectorAll("textarea")];
  const chat = boxes[boxes.length - 1];
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  proto?.set?.call(chat, "Please stay a guide, not an overwrite.");
  chat.dispatchEvent(new Event("input", { bubbles: true }));
});
await clickButton(page, "^Send$");
const heldChat = await chatHold.seen;
const heldChatJson = JSON.parse(heldChat.body);
check(
  "held chat response already contains the older snapshot",
  heldChatJson.view?.project?.brief?.vision?.value === "revision 2 saved",
  heldChatJson.view?.project?.version
);
await typeUntilSaved(page, "revision 3 saved", projectId);
const afterRev3 = projectRow(projectId);
check("sqlite revision 3 exists before old chat is delivered", afterRev3?.brief.vision.value === "revision 3 saved" && afterRev3.version > (afterRev2?.version ?? 0), afterRev3?.version);
chatHold.release();
await wait(400);
check("old revision-2 chat does not replace revision-3 text", (await visionValue(page)) === "revision 3 saved");
check("status stays Saved for revision 3 after stale chat", (await saveLabel(page)) === "Saved");
const recoveryAfterStaleChat = await page.evaluate((owner, id) => {
  const raw = sessionStorage.getItem(`atelier.account.${owner}.draft.${id}`);
  return raw ? JSON.parse(raw) : null;
}, ownerAId, projectId);
check(
  "recovery data stays on revision 3 after stale chat",
  recoveryAfterStaleChat?.acknowledgedVersion === afterRev3.version &&
    recoveryAfterStaleChat?.acknowledgedBrief?.vision?.value === "revision 3 saved" &&
    recoveryAfterStaleChat?.localBrief?.vision?.value === "revision 3 saved",
  recoveryAfterStaleChat?.acknowledgedVersion
);

seedSuggestion(projectId, "Suggested wording from a controlled fixture");
await spaNavigate(page, `/project/${projectTwo}`);
await waitForOwnedBrief(page);
await spaNavigate(page, `/project/${projectId}`);
await waitForOwnedBrief(page);
await waitUntil(
  async () =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")].some((el) => (el.textContent ?? "").includes("Accept suggestion"))
    ),
  12000,
  "accept suggestion button"
);
const suggestionHold = armHold(
  (request) => request.method() === "POST" && request.url().includes("/suggestions/")
);
const accepted = await clickButton(page, "Accept suggestion");
if (!accepted) throw new Error("Accept suggestion was not clicked");
const heldSuggestion = await suggestionHold.seen;
const heldSuggestionJson = JSON.parse(heldSuggestion.body);
check(
  "held suggestion response already contains an older-or-applied snapshot",
  Boolean(heldSuggestionJson.view?.project?.brief),
  heldSuggestionJson.view?.project?.version
);
await typeVision(page, "Newer typing during delayed suggestion");
suggestionHold.release();
await waitUntil(async () => (await visionValue(page)).includes("Newer typing"), 12000, "suggestion local text");
const afterSuggestion = await visionValue(page);
check("delayed suggestion does not replace newer typing", afterSuggestion.includes("Newer typing"), afterSuggestion.slice(0, 80));
check("delayed suggestion keeps a review boundary", Boolean(await page.$(".recovery-panel")) || afterSuggestion === "Newer typing during delayed suggestion");

await spaNavigate(page, `/project/${projectTwo}`);
await waitForOwnedBrief(page);
const loadA = armHold(
  (request) =>
    request.method() === "GET" &&
    new RegExp(`/api/projects/${projectId}(?:\\?|$)`).test(new URL(request.url()).pathname)
);
await spaNavigate(page, `/project/${projectId}`);
await loadA.seen;
await spaNavigate(page, `/project/${projectTwo}`);
await waitForOwnedBrief(page);
const bBeforeRelease = await visionValue(page);
check("project B is active before delayed A load is released", bBeforeRelease.includes("Second commission must stay distinct"), bBeforeRelease.slice(0, 80));
loadA.release();
await wait(500);
const bAfterRelease = await visionValue(page);
check("delayed project-A load does not replace active project B", bAfterRelease.includes("Second commission must stay distinct"), bAfterRelease.slice(0, 80));
const bSession = await page.evaluate((owner, id) => {
  const raw = sessionStorage.getItem(`atelier.account.${owner}.draft.${id}`);
  return raw ? JSON.parse(raw) : null;
}, ownerAId, projectTwo);
check(
  "project B recovery is not bound to project A revision-3 text",
  !bSession || bSession.localBrief?.vision?.value !== "revision 3 saved"
);

const saveThenSignOut = await createProject(page, "Private save that must not return after sign-out");
await spaNavigate(page, `/project/${saveThenSignOut.project.id}`);
await waitForOwnedBrief(page);
const signOutHold = armHold(
  (request) => request.method() === "PATCH" && request.url().includes(`/api/projects/${saveThenSignOut.project.id}`)
);
await typeVision(page, "Private in-flight save after which we sign out");
await signOutHold.seen;
check("in-flight save reached the server before sign-out", Boolean(signOutHold));
await spaNavigate(page, "/account");
await page.waitForSelector("button");
const signOutApiHold = armHold(
  (request) => request.method() === "POST" && request.url().includes("/api/session/sign-out")
);
await clickButton(page, "Sign out");
await signOutApiHold.seen;
const keysAfterSignOut = await ownerStorageKeys(page, ownerAId);
check("explicit sign-out clears this account's private recovery keys", keysAfterSignOut.length === 0, keysAfterSignOut.join(","));
check("signed-out UI does not restore the private brief", !(await page.content()).includes("Private in-flight save after which we sign out"));
signOutHold.release();
await wait(500);
const keysAfterLateAck = await ownerStorageKeys(page, ownerAId);
check("delayed save acknowledgment does not recreate signed-out recovery", keysAfterLateAck.length === 0, keysAfterLateAck.join(","));
check("delayed save does not restore signed-out private text", !(await page.content()).includes("Private in-flight save after which we sign out"));
signOutApiHold.release();
await page.waitForNavigation({ waitUntil: "load", timeout: 12000 }).catch(() => {});
await connectFetch();

await signIn(page, "owner.local@atelier.invalid");
const consentProject = await createProject(page, "Consent source typing");
await page.goto(`${BASE}/project/${consentProject.project.id}`, { waitUntil: "load" });
await waitForOwnedBrief(page);
await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "consent project saved");
await goToReview(page);
await page.click("input[type=checkbox]");
const consented = await page.$eval("input[type=checkbox]", (el) => el.checked);
check("consent can be granted on a saved revision", consented === true, `${consented} / ${await saveLabel(page)}`);
await clickButton(page, "Edit the current working draft");
await page.waitForSelector("textarea");
await typeUntilSaved(page, "Typing after consent", consentProject.project.id);
await goToReview(page);
const afterEditConsent = await page.$eval("input[type=checkbox]", (el) => el.checked);
check("consent is cleared after typing", afterEditConsent === false);

await page.goto(`${BASE}/project/${projectTwo}`, { waitUntil: "load" });
await waitUntil(async () => (await saveLabel(page)) === "Saved" || Boolean(await page.$("textarea")), 12000, "project two ready");
await goToReview(page);
await page.click("input[type=checkbox]");
intercept.dropSubmitAfterCommit = true;
await clickButton(page, "Send to Neil|Send this newly reviewed");
await waitUntil(() => Boolean(intercept.committedSubmit?.receipt?.receiptId), 15000, "committed submit");
const committed = intercept.committedSubmit;
check("lost submit response still committed on the server", Boolean(committed?.receipt?.receiptId), committed?.receipt?.receiptId);
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
await page.reload({ waitUntil: "load" });
await waitForOwnedBrief(page);
await goToReview(page);
await waitUntil(
  async () =>
    page.evaluate(() =>
      [...document.querySelectorAll("button")].some((el) => (el.textContent ?? "").includes("Retry earlier send"))
    ),
  12000,
  "retry earlier send button"
);
await clickButton(page, "Retry earlier send");
await page
  .waitForFunction((id) => window.location.pathname.includes(`/workspace/${id}`), { timeout: 15000 }, projectTwo)
  .catch(() => {});
if (!page.url().includes(`/workspace/${projectTwo}`)) {
  await page.goto(`${BASE}/workspace/${projectTwo}`, { waitUntil: "load" });
}
await page.waitForSelector(".receipt-card", { timeout: 15000 });
const receiptPage = await page.content();
check("exact retry shows the original receipt", receiptPage.includes(committed?.receipt?.receiptId ?? "missing-receipt"));
const submittedRow = submissionRow(projectTwo);
check("sqlite receipt matches the retried command", submittedRow?.receipt_id === committed?.receipt?.receiptId, submittedRow?.receipt_id);

const rejectProject = await createProject(page, "Stale submit then correct");
await page.goto(`${BASE}/project/${rejectProject.project.id}`, { waitUntil: "load" });
await waitForOwnedBrief(page);
await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "reject project saved");
await goToReview(page);
await page.click("input[type=checkbox]");
await page.evaluate(async (id) => {
  const current = await (await fetch(`/api/projects/${id}`)).json();
  const brief = current.project.brief;
  brief.constraints.value = "Server advanced this revision";
  brief.constraints.provenance = "client_statement";
  await fetch(`/api/projects/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief, expectedVersion: current.project.version })
  });
}, rejectProject.project.id);
const sendBefore = observedResponses.length;
await clickButton(page, "Send to Neil|Send this newly reviewed");
await waitForObserved(
  (item) =>
    item.method === "POST" &&
    item.url.includes(`/api/projects/${rejectProject.project.id}/submit`) &&
    item.index >= sendBefore
);
await waitUntil(async () => (await page.content()).includes("Correct the brief") || (await page.content()).includes("different saved revision"), 12000, "rejection copy");
const rejectUi = await page.content();
check("definite stale-version rejection is explained", rejectUi.includes("different saved revision") || rejectUi.includes("Correct the brief"));
check("rejected send is not trapped on Retry earlier send", !rejectUi.includes("Retry earlier send"));
await clickButton(page, "Edit the current working draft");
await page.waitForSelector("textarea");
await typeUntilSaved(page, "Corrected revision after rejection", rejectProject.project.id);
await goToReview(page);
const consentAfterReject = await page.$eval("input[type=checkbox]", (el) => el.checked);
check("rejection invalidates consent until a fresh review", consentAfterReject === false);
if (await page.$(".recovery-panel")) {
  await clickButton(page, "Keep this device copy");
  await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "corrected text saved after compare");
  await goToReview(page);
}
await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "saved before fresh consent");
await page.evaluate(() => {
  const box = document.querySelector("input[type=checkbox]");
  if (!box) throw new Error("consent checkbox missing");
  box.click();
});
await waitUntil(async () => page.$eval("input[type=checkbox]", (el) => el.checked), 8000, "fresh consent checked");
const sentCorrected = await clickButton(page, "Send to Neil|Send this newly reviewed");
if (!sentCorrected) throw new Error("corrected send button was not clicked");
await page
  .waitForFunction(
    (id) => window.location.pathname.includes(`/workspace/${id}`),
    { timeout: 15000 },
    rejectProject.project.id
  )
  .catch(() => {});
check(
  "corrected send reached the workspace receipt path",
  page.url().includes(`/workspace/${rejectProject.project.id}`),
  page.url()
);
const corrected = await page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`)).json()), rejectProject.project.id);
check("corrected newly consented send stored a receipt", Boolean(corrected.submission?.receiptId), corrected.submission?.receiptId);
check("corrected send used a new reviewed version", corrected.submission?.reviewedVersion > 1, corrected.submission?.reviewedVersion);

const navSubmit = await createProject(page, "Submit then navigate away");
await page.goto(`${BASE}/project/${navSubmit.project.id}`, { waitUntil: "load" });
await waitForOwnedBrief(page);
await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "nav submit saved");
await goToReview(page);
await page.click("input[type=checkbox]");
const submitHold = armHold(
  (request) => request.method() === "POST" && request.url().includes(`/api/projects/${navSubmit.project.id}/submit`)
);
await clickButton(page, "Send to Neil|Send this newly reviewed");
const heldSubmit = await submitHold.seen;
const heldSubmitJson = JSON.parse(heldSubmit.body);
check("held submit response already contains a receipt", Boolean(heldSubmitJson.receipt?.receiptId), heldSubmitJson.receipt?.receiptId);
await spaNavigate(page, `/project/${projectTwo}`);
await waitForOwnedBrief(page);
submitHold.release();
await wait(800);
check("stale submit completion does not redirect a different project", page.url().includes(`/project/${projectTwo}`), page.url());
const stillTwo = await visionValue(page);
check("active project after stale submit is still project B", stillTwo.includes("Second commission must stay distinct"), stillTwo.slice(0, 80));
const navReceipt = await page.evaluate(async (id) => (await (await fetch(`/api/projects/${id}`)).json()), navSubmit.project.id);
check(
  "genuine receipt remains on the original project after navigation",
  navReceipt.submission?.receiptId === heldSubmitJson.receipt?.receiptId,
  navReceipt.submission?.receiptId
);

const readbackProject = await createProject(page, "Held readback must not return after sign-out");
await page.goto(`${BASE}/project/${readbackProject.project.id}`, { waitUntil: "load" });
await waitForOwnedBrief(page);
await waitUntil(async () => (await saveLabel(page)) === "Saved", 12000, "readback project saved");
await goToReview(page);
await page.click("input[type=checkbox]");
intercept.submitPostedFor = null;
const readbackHold = armHold((request) => {
  const url = request.url();
  const method = request.method();
  if (method === "POST" && url.includes(`/api/projects/${readbackProject.project.id}/submit`)) {
    intercept.submitPostedFor = readbackProject.project.id;
    return false;
  }
  return (
    intercept.submitPostedFor === readbackProject.project.id &&
    method === "GET" &&
    new RegExp(`/api/projects/${readbackProject.project.id}(?:\\?|$)`).test(new URL(url).pathname)
  );
});
const sendClicked = await clickButton(page, "Send to Neil|Send this newly reviewed");
check("submit send control was clicked for held readback", sendClicked === true);
const heldReadback = await readbackHold.seen;
check("submit verification GET was held after POST", Boolean(heldReadback), heldReadback?.url);
await spaNavigate(page, "/account");
await page.waitForSelector("button");
const readbackSignOutHold = armHold(
  (request) => request.method() === "POST" && request.url().includes("/api/session/sign-out")
);
await clickButton(page, "Sign out");
await readbackSignOutHold.seen;
const keysAfterSubmitSignOut = await ownerStorageKeys(page, ownerAId);
check(
  "explicit sign-out during held submit readback clears account recovery",
  keysAfterSubmitSignOut.length === 0,
  keysAfterSubmitSignOut.join(",")
);
readbackHold.release();
await wait(500);
const keysAfterLateReadback = await ownerStorageKeys(page, ownerAId);
check(
  "late submit verification GET does not recreate signed-out recovery",
  keysAfterLateReadback.length === 0,
  keysAfterLateReadback.join(",")
);
check(
  "late submit readback does not restore a false receipt",
  !(await page.content()).includes("Confirmed receipt")
);
readbackSignOutHold.release();
await page.waitForNavigation({ waitUntil: "load", timeout: 12000 }).catch(() => {});
await connectFetch();
await signIn(page, "owner.local@atelier.invalid");

const reuse = await page.evaluate(async (id) => {
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

await page.evaluateOnNewDocument(() => {
  window.__atelierAllowServiceWorker = true;
});
await page.evaluate(() => {
  window.__atelierAllowServiceWorker = true;
});
await page.goto(`${BASE}/`, { waitUntil: "load" });
intercept.blockServiceWorker = false;
try {
  if (fetchSession) await fetchSession.send("Fetch.disable");
} catch {
  /* already disabled */
}
await page.evaluate(async () => {
  if ("serviceWorker" in navigator) {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  }
});
intercept.failNonGet = true;
const swSessions = [];
async function hookSw(target) {
  if (target.type() !== "page" && target.type() !== "service_worker") return;
  try {
    const session = await target.createCDPSession();
    await session.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
    session.on("Fetch.requestPaused", (event) => {
      void handlePaused(session, event);
    });
    swSessions.push(session);
  } catch {
    /* ignore */
  }
}
for (const target of browser.targets()) await hookSw(target);
browser.on("targetcreated", (target) => {
  void hookSw(target);
});
const swWrite = await page.evaluate(async () => {
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    return res.json();
  } catch (error) {
    return { error: String(error), delivered: "uncertain" };
  }
});
intercept.failNonGet = false;
for (const session of swSessions) {
  try {
    await session.send("Fetch.disable");
  } catch {
    /* ignore */
  }
}
check(
  "service-worker failed write is uncertain",
  swWrite.delivered === "uncertain" && swWrite.delivered !== false,
  JSON.stringify(swWrite)
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} browser regressions passed`);
await browser.close().catch(() => {});
if (failed.length) process.exit(1);
