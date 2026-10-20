#!/usr/bin/env node
/**
 * HTTP acceptance for Auth.js accounts: two clients and a founder, including
 * direct API access checks. Uses the magic-link protocol with local capture —
 * not simulated identities and not fake hosted credentials.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = process.env.ATELIER_AUTH_ACCEPTANCE_PORT ?? "3017";
const BASE = process.env.ATELIER_BASE ?? `http://localhost:${PORT}`;
const spawned = !process.env.ATELIER_BASE;
const dataDir = mkdtempSync(path.join(os.tmpdir(), "atelier-auth-"));
const SECRET = "atelier-auth-acceptance-secret-value-32";
const FOUNDER = "founder.auth@atelier.invalid";
const CLIENT_A = "client.a@example.com";
const CLIENT_B = "client.b@example.com";

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
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

async function req(path, { method = "GET", body, jar, form } = {}) {
  const headers = {};
  if (jar) headers.cookie = jar.header();
  let payload;
  if (form) {
    headers["content-type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, { method, headers, body: payload, redirect: "manual" });
  const setCookie = res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  if (jar) jar.absorb(setCookie);
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { text };
  }
  return { status: res.status, json, setCookie, location: res.headers.get("location"), text };
}

async function signInEmail(email) {
  const jar = new CookieJar();
  const csrf = await req("/api/auth/csrf", { jar });
  const token = csrf.json.csrfToken;
  if (!token) throw new Error(`csrf missing ${JSON.stringify(csrf.json)}`);
  const started = await req("/api/auth/signin/email", {
    method: "POST",
    jar,
    form: {
      csrfToken: token,
      email,
      callbackUrl: `${BASE}/account`,
      json: "true"
    }
  });
  if (started.status >= 400) {
    const fallback = await req("/api/session/start", {
      method: "POST",
      jar,
      body: { provider: "email", email, callbackUrl: "/account" }
    });
    if (fallback.status >= 400) {
      throw new Error(`email start ${email} ${started.status}/${fallback.status} ${JSON.stringify(fallback.json)}`);
    }
  }
  const captured = await req(`/api/session/email/captured?email=${encodeURIComponent(email)}`);
  if (captured.status !== 200 || !captured.json.url) {
    throw new Error(`captured link missing for ${email}: ${captured.status} ${JSON.stringify(captured.json)}`);
  }
  let url = captured.json.url;
  for (let i = 0; i < 8 && url; i += 1) {
    const next = await req(url, { jar });
    if (next.status >= 300 && next.status < 400 && next.location) {
      url = next.location.startsWith("http") ? next.location : new URL(next.location, BASE).href;
      continue;
    }
    break;
  }
  const session = await req("/api/session", { jar });
  if (!session.json.user?.email) {
    throw new Error(`session missing after magic link for ${email}: ${JSON.stringify(session.json)}`);
  }
  return { jar, user: session.json.user };
}

function startServer() {
  const child = spawn("pnpm", ["exec", "next", "start", "--port", PORT], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "production",
      ATELIER_PERSISTENCE_ADAPTER: "sqlite_local",
      ATELIER_DATA_DIR: dataDir,
      ATELIER_AUTH_ADAPTER: "authjs",
      ATELIER_AUTH_EMAIL_CAPTURE: "true",
      ATELIER_ISOLATED_LOCAL: "true",
      ATELIER_PUBLIC_ORIGIN: BASE,
      ATELIER_SESSION_SECRET: SECRET,
      AUTH_SECRET: SECRET,
      AUTH_URL: BASE,
      AUTH_TRUST_HOST: "true",
      ATELIER_FOUNDER_EMAILS: FOUNDER,
      ATELIER_OPENAI_ENABLED: "false",
      ATELIER_BILLING_ENABLED: "false",
      ATELIER_ALLOW_SIMULATED_AUTH: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => {
    if (process.env.ATELIER_AUTH_ACCEPTANCE_LOG) process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    if (process.env.ATELIER_AUTH_ACCEPTANCE_LOG) process.stderr.write(chunk);
  });
  return child;
}

async function waitForHealth(child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`next start exited ${child.exitCode}`);
    }
    try {
      const health = await req("/api/health");
      if (health.status === 200 && health.json.auth?.ready) return health;
    } catch {
      // still booting
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error("Timed out waiting for Auth.js acceptance server");
}

const brief = {
  vision: { key: "vision", value: "A private family practice site.", provenance: "client_statement" },
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

let child;
try {
  if (spawned) child = startServer();
  const health = spawned ? await waitForHealth(child) : await req("/api/health");
  check("authjs adapter is ready", health.json.auth?.adapter === "authjs" && health.json.auth?.ready === true, health.json.auth?.adapter);

  const anonymous = await req("/api/projects");
  check("anonymous API access is 401", anonymous.status === 401, String(anonymous.status));

  const simulated = await req("/api/session/sign-in", {
    method: "POST",
    body: { email: "owner.local@atelier.invalid" }
  });
  check("simulated identities are refused on the Auth.js adapter", simulated.status >= 400);

  const captureDeniedShape = await req("/api/session/email/captured");
  check("captured-link endpoint requires an email", captureDeniedShape.status === 400);

  const clientA = await signInEmail(CLIENT_A);
  const clientB = await signInEmail(CLIENT_B);
  const founder = await signInEmail(FOUNDER);
  check("client A session recovered", clientA.user.email === CLIENT_A && clientA.user.role === "client");
  check("client B session recovered", clientB.user.email === CLIENT_B && clientB.user.role === "client");
  check("founder role is server-assigned", founder.user.email === FOUNDER && founder.user.role === "founder");
  check("client A is not founder", clientA.user.role !== "founder");

  const created = await req("/api/projects", { method: "POST", body: { brief }, jar: clientA.jar });
  check("client A creates a project", created.status === 201, created.json.project?.id);
  const id = created.json.project.id;

  const denied = await req(`/api/projects/${id}`, { jar: clientB.jar });
  check("client B is denied client A's project", denied.status === 403);

  const founderDenied = await req("/api/founder/queue", { jar: clientA.jar });
  check("client A is denied the founder queue", founderDenied.status === 403);

  const bList = await req("/api/projects", { jar: clientB.jar });
  check("client B workspace does not include client A's project", (bList.json.projects ?? []).every((project) => project.id !== id));

  const aList = await req("/api/projects", { jar: clientA.jar });
  check("client A sees their own project after a second request", (aList.json.projects ?? []).some((project) => project.id === id));

  const submitted = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    jar: clientA.jar,
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: `auth-acc-${Date.now()}`,
      expectedVersion: created.json.project.version
    }
  });
  check("client A can submit their own brief", submitted.status === 200, submitted.json.receipt?.receiptId);

  const queue = await req("/api/founder/queue", { jar: founder.jar });
  check("founder queue includes client A's submission", (queue.json.queue ?? []).some((item) => item.id === id));

  const otherFounder = await req(`/api/founder/projects/${id}`, { jar: clientB.jar });
  check("client B is denied founder project access", otherFounder.status === 403);

  const guestAdopt = await req("/api/projects/adopt", {
    method: "POST",
    jar: clientB.jar,
    body: {
      confirmed: false,
      draft: {
        version: 1,
        kind: "guest_draft",
        labeled: true,
        limitations: [],
        draftId: "guest-auth-acc",
        title: "Guest",
        brief,
        messages: [],
        updatedAt: new Date().toISOString()
      }
    }
  });
  check("adoption without explicit consent is refused", guestAdopt.status >= 400);

  const signedOut = await req("/api/session/sign-out", { method: "POST", jar: clientA.jar });
  check("sign-out succeeds", signedOut.status === 200);
  const afterSignOut = await req(`/api/projects/${id}`, { jar: clientA.jar });
  check("expired/signed-out session cannot read the project", afterSignOut.status === 401, String(afterSignOut.status));

  const switched = await signInEmail(CLIENT_B);
  const switchedView = await req(`/api/projects/${id}`, { jar: switched.jar });
  check("account switch does not reveal the previous account's project", switchedView.status === 403);

  const returned = await signInEmail(CLIENT_A);
  const returnedView = await req(`/api/projects/${id}`, { jar: returned.jar });
  check("client A recovers the same project on a new session", returnedView.status === 200 && returnedView.json.project?.id === id);
} catch (error) {
  check("acceptance harness", false, error instanceof Error ? error.message : String(error));
} finally {
  if (child) {
    child.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (child.exitCode == null) child.kill("SIGKILL");
  }
  rmSync(dataDir, { recursive: true, force: true });
}

const failed = results.filter((item) => !item.ok);
console.log(`\n${results.filter((item) => item.ok).length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
