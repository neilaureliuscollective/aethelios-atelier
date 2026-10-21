#!/usr/bin/env node
/**
 * Client early-access journey: distinct non-founder identity, save-and-return,
 * one submission, founder queue with exact snapshot, second-client isolation,
 * phone-sized install entry points. Uses simulated identities unless
 * ATELIER_BASE points at an already running server.
 */
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = process.env.ATELIER_EARLY_ACCESS_PORT ?? "3018";
const spawned = !process.env.ATELIER_BASE;
const BASE = process.env.ATELIER_BASE ?? `http://127.0.0.1:${PORT}`;
const dataDir = spawned ? mkdtempSync(path.join(os.tmpdir(), "atelier-early-")) : null;
const results = [];

function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 280) : "" });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
  absorb(setCookie = []) {
    for (const cookie of setCookie) {
      const pair = String(cookie).split(";")[0];
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
}

async function req(urlPath, { method = "GET", body, jar } = {}) {
  const headers = {};
  if (jar) headers.cookie = jar.header();
  if (body !== undefined) headers["content-type"] = "application/json";
  const url = urlPath.startsWith("http") ? urlPath : `${BASE}${urlPath}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const setCookie =
    res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  if (jar) jar.absorb(setCookie);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { text };
  }
  return { status: res.status, json, text };
}

async function signIn(email) {
  const jar = new CookieJar();
  const res = await req("/api/session/sign-in", { method: "POST", jar, body: { email } });
  if (res.status !== 200) {
    throw new Error(`sign-in ${email} ${res.status} ${JSON.stringify(res.json)}`);
  }
  return { jar, user: res.json.user };
}

const brief = {
  vision: {
    key: "vision",
    value: "Early-access salon site that keeps GlossGenius for booking.",
    provenance: "client_statement"
  },
  projectType: { key: "projectType", value: "website", provenance: "client_statement" },
  audience: { key: "audience", value: "Neighborhood clients.", provenance: "client_statement" },
  existingWebsite: { key: "existingWebsite", value: "", provenance: "empty" },
  bookingProvider: { key: "bookingProvider", value: "GlossGenius", provenance: "client_statement" },
  goals: { key: "goals", value: "Send people to the live booking page.", provenance: "client_statement" },
  references: { key: "references", value: "", provenance: "empty" },
  priorities: { key: "priorities", value: "Quiet luxury, not a template.", provenance: "client_statement" },
  timing: { key: "timing", value: "To confirm", provenance: "client_statement" },
  budget: { key: "budget", value: "", provenance: "empty" },
  constraints: {
    key: "constraints",
    value: "Discuss the Atelier ongoing plan. Selecting this did not start a subscription, accept terms, or set a price.",
    provenance: "client_statement"
  },
  context: {
    version: 1,
    purpose: "business",
    route: "business",
    exampleId: "",
    bookingNeeded: true,
    offerId: "barbers_salons",
    showcaseId: ""
  }
};

function startServer() {
  return spawn("pnpm", ["exec", "next", "start", "--port", PORT], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      ATELIER_PERSISTENCE_ADAPTER: "sqlite_local",
      ATELIER_DATA_DIR: dataDir,
      ATELIER_AUTH_ADAPTER: "simulated",
      ATELIER_ALLOW_SIMULATED_AUTH: "true",
      ATELIER_ISOLATED_LOCAL: "true",
      ATELIER_PUBLIC_ORIGIN: BASE,
      ATELIER_SESSION_SECRET: "atelier-early-access-secret-value-32",
      ATELIER_FOUNDER_EMAILS: "neil.local@atelier.invalid",
      ATELIER_OPENAI_ENABLED: "false",
      ATELIER_BILLING_ENABLED: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
}

async function waitForHealth(child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child?.exitCode != null) throw new Error(`next start exited ${child.exitCode}`);
    try {
      const health = await req("/api/health");
      if (health.status === 200) return health;
    } catch {
      // booting
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Timed out waiting for the early-access server");
}

async function runBrowserChecks() {
  if (!existsSync("/usr/bin/google-chrome-stable")) {
    check("browser chrome is available", false, "google-chrome-stable missing; phone layout unverified here");
    return;
  }
  const puppeteer = (await import("puppeteer-core")).default;
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome-stable",
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"]
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/install`, { waitUntil: "networkidle0" });
    const install = await page.content();
    check("phone-sized install page names Android and iPhone steps", /Android/i.test(install) && /iPhone/i.test(install));
    check("install page does not claim offline edits sync", !/offline edits have synced|already synced/i.test(install));

    await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
    await page.evaluate(async () => {
      await fetch("/api/session/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "owner.local@atelier.invalid" })
      });
    });
    await page.goto(`${BASE}/account/continue`, { waitUntil: "networkidle0" });
    const continuePage = await page.content();
    check(
      "first-login continue page offers a useful next action",
      /Start a project|Continue your saved brief|Welcome back/i.test(continuePage)
    );
    check("continue page does not grant founder access to a client", !/Founder workspace/i.test(continuePage));

    await page.goto(`${BASE}/founder`, { waitUntil: "networkidle0" });
    const founderDenied = await page.content();
    check(
      "client cannot open the founder page by URL",
      /Founder access denied|Restricted|authorization/i.test(founderDenied)
    );
  } finally {
    await browser.close();
  }
}

let child;
try {
  if (spawned) child = startServer();
  const health = await waitForHealth(child);
  check("server is reachable", health.status === 200);

  const clientA = await signIn("owner.local@atelier.invalid");
  const clientB = await signIn("owner-two.local@atelier.invalid");
  const founder = await signIn("neil.local@atelier.invalid");
  check("distinct non-founder identity is a client", clientA.user.role === "client" && clientA.user.email === "owner.local@atelier.invalid");
  check("second client is isolated from the founder role", clientB.user.role === "client");
  check("founder login still works", founder.user.role === "founder");

  const created = await req("/api/projects", { method: "POST", jar: clientA.jar, body: { brief } });
  check("client workspace creates its own project", created.status === 201, created.json.project?.id);
  const id = created.json.project.id;
  const version = created.json.project.version;

  const saved = await req(`/api/projects/${id}`, {
    method: "PATCH",
    jar: clientA.jar,
    body: { expectedVersion: version, brief }
  });
  check("client can save the project", saved.status === 200);

  await req("/api/session/sign-out", { method: "POST", jar: clientA.jar });
  const signedOut = await req(`/api/projects/${id}`, { jar: clientA.jar });
  check("signed-out session cannot read the saved project", signedOut.status === 401);

  const returned = await signIn("owner.local@atelier.invalid");
  const restored = await req(`/api/projects/${id}`, { jar: returned.jar });
  check(
    "same account sees the same saved content after return",
    restored.status === 200 && restored.json.project?.brief?.vision?.value === brief.vision.value
  );

  const submitKey = `early-replay-same-${id}`;
  const submitted = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    jar: returned.jar,
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: submitKey,
      expectedVersion: restored.json.project.version
    }
  });
  check("client submits the reviewed project once", submitted.status === 200 && Boolean(submitted.json.receipt?.receiptId));
  check("success is a confirmed receipt, not an optimistic flag", submitted.json.submitted === true && Boolean(submitted.json.receipt?.submittedAt));

  const replay = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    jar: returned.jar,
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: submitKey,
      expectedVersion: restored.json.project.version
    }
  });
  check("duplicate submit with the same key does not create a second snapshot", replay.status === 200 && replay.json.duplicate === true && replay.json.receipt?.receiptId === submitted.json.receipt?.receiptId);

  const later = await req(`/api/projects/${id}`, {
    method: "PATCH",
    jar: returned.jar,
    body: {
      expectedVersion: restored.json.project.version,
      brief: {
        ...brief,
        vision: { ...brief.vision, value: "Later draft after the receipt." }
      }
    }
  });
  check("later draft edits are accepted on the working copy", later.status === 200);

  const queue = await req("/api/founder/queue", { jar: founder.jar });
  const queued = (queue.json.queue ?? []).find((item) => item.id === id);
  check("founder sees the matching submission", Boolean(queued));
  check("founder queue has the client, receipt, and plan context", Boolean(queued?.owner?.email === "owner.local@atelier.invalid" && queued?.receiptId && /Barbers|Atelier/.test(queued?.handoffSummary ?? "")));

  const founderView = await req(`/api/founder/projects/${id}`, { jar: founder.jar });
  check(
    "founder sees the exact submitted content",
    founderView.json.submission?.snapshot?.vision?.value === brief.vision.value &&
      founderView.json.submission?.snapshot?.constraints?.value.includes("did not start a subscription")
  );

  const otherView = await req(`/api/projects/${id}`, { jar: clientB.jar });
  check("another client cannot read the private brief", otherView.status === 403);
  const otherSubmit = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    jar: clientB.jar,
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: "early-other",
      expectedVersion: 1
    }
  });
  check("another client cannot submit the private brief", otherSubmit.status === 403);
  const otherFounder = await req("/api/founder/queue", { jar: clientB.jar });
  check("another client cannot open founder APIs", otherFounder.status === 403);
  const otherFounderProject = await req(`/api/founder/projects/${id}`, { jar: clientB.jar });
  check("another client cannot open founder project APIs", otherFounderProject.status === 403);

  const continuePage = await req("/account/continue", { jar: returned.jar });
  check("continue page is available to the signed-in client", continuePage.status === 200);
  const installPage = await req("/install");
  check("install page is available without a session", installPage.status === 200 && /Android/i.test(installPage.text) && /iPhone/i.test(installPage.text));

  await runBrowserChecks();
} catch (error) {
  check("early-access harness", false, error instanceof Error ? error.message : String(error));
} finally {
  if (child) {
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (child.exitCode == null) child.kill("SIGKILL");
  }
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.filter((item) => item.ok).length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
