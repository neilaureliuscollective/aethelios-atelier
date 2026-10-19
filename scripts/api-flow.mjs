#!/usr/bin/env node
/**
 * HTTP acceptance against the running local candidate.
 * Uses simulated identities. Distinguishes real local persistence from browser fixtures.
 */
const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const RUN = crypto.randomUUID();

async function req(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, setCookie };
}

function cookieHeader(setCookie) {
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function signIn(email) {
  const res = await req("/api/session/sign-in", { method: "POST", body: { email } });
  if (res.status !== 200) throw new Error(`sign-in ${email} ${res.status} ${JSON.stringify(res.json)}`);
  return cookieHeader(res.setCookie);
}

const brief = {
  vision: { key: "vision", value: "A boutique wellness studio site that links to my existing booking page.", provenance: "client_statement" },
  projectType: { key: "projectType", value: "booking_connected_website", provenance: "client_statement" },
  audience: { key: "audience", value: "Local clients booking treatments.", provenance: "client_statement" },
  existingWebsite: { key: "existingWebsite", value: "", provenance: "empty" },
  bookingProvider: { key: "bookingProvider", value: "Square Appointments", provenance: "client_statement" },
  goals: { key: "goals", value: "Look considered and send people to the live booking destination.", provenance: "client_statement" },
  references: { key: "references", value: "", provenance: "empty" },
  priorities: { key: "priorities", value: "Clarity over volume.", provenance: "client_statement" },
  timing: { key: "timing", value: "To confirm", provenance: "client_statement" },
  budget: { key: "budget", value: "", provenance: "empty" },
  constraints: { key: "constraints", value: "", provenance: "empty" }
};

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const owner = await signIn("owner.local@atelier.invalid");
const other = await signIn("owner-two.local@atelier.invalid");
const founder = await signIn("neil.local@atelier.invalid");

const created = await req("/api/projects", { method: "POST", body: { brief }, cookie: owner });
check("create project as owner", created.status === 201, created.json.project?.id);
const id = created.json.project.id;
const version = created.json.project.version;

const denied = await req(`/api/projects/${id}`, { cookie: other });
check("second owner denied client view", denied.status === 403);

const founderDenied = await req("/api/founder/queue", { cookie: owner });
check("owner denied founder queue", founderDenied.status === 403);

const saved = await req(`/api/projects/${id}`, {
  method: "PATCH",
  cookie: owner,
  body: { expectedVersion: version, localGeneration: 1, brief }
});
check("owner save", saved.status === 200);

const stale = await req(`/api/projects/${id}`, {
  method: "PATCH",
  cookie: owner,
  body: { expectedVersion: version, localGeneration: 2, brief }
});
check("stale save conflict keeps newer typing contract", stale.status === 409);

const missingVersion = await req(`/api/projects/${id}/submit`, {
  method: "POST",
  cookie: owner,
  body: { consent: true, consentTextAcknowledged: true, idempotencyKey: `${RUN}-missing` }
});
check("submit without reviewed version is rejected", missingVersion.status >= 400);

const staleSubmit = await req(`/api/projects/${id}/submit`, {
  method: "POST",
  cookie: owner,
  body: {
    consent: true,
    consentTextAcknowledged: true,
    idempotencyKey: `${RUN}-stale`,
    expectedVersion: version
  }
});
check("stale reviewed version cannot be submitted", staleSubmit.status === 409);

const savedVersion = saved.json.project.version;
const submit = await req(`/api/projects/${id}/submit`, {
  method: "POST",
  cookie: owner,
  body: {
    consent: true,
    consentTextAcknowledged: true,
    idempotencyKey: `${RUN}-key-1`,
    expectedVersion: savedVersion
  }
});
check("submit with consent", submit.status === 200 && submit.json.receipt?.receiptId, submit.json.receipt?.receiptId);

const retry = await req(`/api/projects/${id}/submit`, {
  method: "POST",
  cookie: owner,
  body: {
    consent: true,
    consentTextAcknowledged: true,
    idempotencyKey: `${RUN}-key-1`,
    expectedVersion: savedVersion
  }
});
check("idempotent retry does not duplicate", retry.status === 200 && retry.json.duplicate === true);
check(
  "receipt version comes from persisted submission",
  retry.json.receipt?.version === savedVersion && retry.json.receipt?.receiptId === submit.json.receipt?.receiptId
);

const laterBrief = {
  ...brief,
  vision: { ...brief.vision, value: "Later draft must not rewrite the snapshot." }
};
const laterSave = await req(`/api/projects/${id}`, {
  method: "PATCH",
  cookie: owner,
  body: { expectedVersion: savedVersion, brief: laterBrief }
});
check("later draft save after submit", laterSave.status === 200);

const reusedChanged = await req(`/api/projects/${id}/submit`, {
  method: "POST",
  cookie: owner,
  body: {
    consent: true,
    consentTextAcknowledged: true,
    idempotencyKey: `${RUN}-key-1`,
    expectedVersion: laterSave.json.project.version
  }
});
check("reused key with a different reviewed version conflicts", reusedChanged.status === 409);

const revised = await req(`/api/projects/${id}/submit`, {
  method: "POST",
  cookie: owner,
  body: {
    consent: true,
    consentTextAcknowledged: true,
    idempotencyKey: `${RUN}-key-revised`,
    expectedVersion: laterSave.json.project.version
  }
});
check(
  "deliberate revised submission gets a new receipt",
  revised.status === 200 &&
    revised.json.receipt?.receiptId &&
    revised.json.receipt.receiptId !== submit.json.receipt.receiptId &&
    revised.json.receipt.version === laterSave.json.project.version
);

const createdTwo = await req("/api/projects", { method: "POST", body: { brief }, cookie: owner });
check("second project created", createdTwo.status === 201, createdTwo.json.project?.id);
const idTwo = createdTwo.json.project.id;
const sameKeyOtherProject = await req(`/api/projects/${idTwo}/submit`, {
  method: "POST",
  cookie: owner,
  body: {
    consent: true,
    consentTextAcknowledged: true,
    idempotencyKey: `${RUN}-key-1`,
    expectedVersion: createdTwo.json.project.version
  }
});
check("same key on a different project conflicts", sameKeyOtherProject.status === 409);

const openedTwo = await req(`/api/projects/${idTwo}`, { cookie: owner });
check("second project loads by explicit id", openedTwo.status === 200 && openedTwo.json.project?.id === idTwo);

const guestDraft = {
  version: 1,
  kind: "guest_draft",
  labeled: true,
  limitations: ["Saved only on this device."],
    draftId: `guest-adopt-${RUN}`,
  title: "Guest draft",
  brief,
  messages: [],
  updatedAt: new Date().toISOString()
};
const adoptOne = await req("/api/projects/adopt", {
  method: "POST",
  cookie: owner,
  body: { confirmed: true, draft: guestDraft }
});
const adoptTwo = await req("/api/projects/adopt", {
  method: "POST",
  cookie: owner,
  body: { confirmed: true, draft: guestDraft }
});
check(
  "duplicate adoption is idempotent",
  adoptOne.status === 200 && adoptTwo.status === 200 && adoptOne.json.project?.id === adoptTwo.json.project?.id
);

const beforeReview = await req(`/api/projects/${id}`, { cookie: owner });
check(
  "submitted is not under review",
  beforeReview.json.nextStep?.code === "awaiting_founder_receipt" && !beforeReview.json.reviewStartedAt
);

const chat = await req(`/api/projects/${id}/messages`, {
  method: "POST",
  cookie: owner,
  body: { body: "Can you quote this as a finished website?" }
});
check(
  "unavailable assistant is not live AI",
  chat.status === 200 && chat.json.liveAi === false && String(chat.json.message?.body).includes("not a live AI reply")
);

const start = await req(`/api/founder/projects/${id}/review`, { method: "POST", cookie: founder });
check("founder starts review", start.status === 200);

const afterReview = await req(`/api/projects/${id}`, { cookie: owner });
check("client sees review only after event", afterReview.json.nextStep?.code === "founder_is_reviewing");

const note = await req(`/api/founder/projects/${id}/notes`, {
  method: "POST",
  cookie: founder,
  body: { kind: "internal_proposal", body: "Private sketch 8400 — never publish" }
});
check("private note stored", note.status === 200 && note.json.visibility === "founder_only");

const clientView = await req(`/api/projects/${id}`, { cookie: owner });
const leaked = JSON.stringify(clientView.json).includes("8400") || JSON.stringify(clientView.json).includes("privateNotes");
check("private note isolated from client payload", !leaked);

const otherFounder = await req(`/api/founder/projects/${id}`, { cookie: other });
check("second user denied founder project", otherFounder.status === 403);

const clar = await req(`/api/founder/projects/${id}/updates`, {
  method: "POST",
  cookie: founder,
  body: { kind: "clarification", body: "Which booking platform do you currently use?" }
});
check("clarification published", clar.status === 200 && clar.json.visibility === "client_visible");

const waiting = await req(`/api/projects/${id}`, { cookie: owner });
check("client asked to respond", waiting.json.nextStep?.code === "respond_to_clarification", waiting.json.nextStep?.code);
const cid = waiting.json.updates.find((u) => u.kind === "clarification")?.id;

const answer = await req(`/api/projects/${id}/clarifications/${cid}`, {
  method: "POST",
  cookie: owner,
  body: { body: "Square Appointments remains the booking destination." }
});
check("client clarification response", answer.status === 200);

const snapshotAfter = await req(`/api/projects/${id}`, { cookie: owner });
check(
  "submitted snapshot unchanged by later edits/replies",
  snapshotAfter.json.submission?.snapshot?.bookingProvider?.value === "Square Appointments"
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
