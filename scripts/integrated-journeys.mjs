#!/usr/bin/env node
/**
 * Combined-head HTTP proof of the two release-candidate journeys.
 * Uses simulated identities only. This is not hosted Auth.js verification.
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
  return setCookie.map((item) => item.split(";")[0]).join("; ");
}

async function signIn(email) {
  const res = await req("/api/session/sign-in", { method: "POST", body: { email } });
  if (res.status !== 200) throw new Error(`sign-in ${email} ${res.status} ${JSON.stringify(res.json)}`);
  return cookieHeader(res.setCookie);
}

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok: Boolean(ok), extra: extra ? String(extra).slice(0, 280) : "" });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? ` ${String(extra).slice(0, 160)}` : ""}`);
}

function field(key, value) {
  return { key, value, provenance: value ? "client_statement" : "empty" };
}

function emptyFields() {
  return {
    audience: field("audience", ""),
    existingWebsite: field("existingWebsite", ""),
    bookingProvider: field("bookingProvider", ""),
    goals: field("goals", ""),
    references: field("references", ""),
    priorities: field("priorities", ""),
    timing: field("timing", ""),
    budget: field("budget", ""),
    constraints: field("constraints", "")
  };
}

function websiteBrief() {
  return {
    ...emptyFields(),
    vision: field("vision", `A public site for Meridian Sitting Room ${RUN}.`),
    projectType: field("projectType", "website"),
    audience: field("audience", "Local clients looking for a considered first visit."),
    references: field("references", "Quiet gold, deep green, and ivory."),
    goals: field("goals", "Look considered and invite enquiry."),
    context: { version: 1, purpose: "business", route: "business", exampleId: "", bookingNeeded: null }
  };
}

function workflowBrief() {
  return {
    ...emptyFields(),
    vision: field("vision", `A follow-up list for people I still need to return to ${RUN}.`),
    projectType: field("projectType", "undecided"),
    audience: field("audience", "Just me, later a small studio if it helps."),
    existingWebsite: field("existingWebsite", "A notes app and a few email reminders."),
    goals: field("goals", "See what is waiting and change priority or status."),
    context: {
      version: 1,
      purpose: "professional_workflow",
      route: "custom_project",
      exampleId: "follow_up_workspace",
      bookingNeeded: null
    }
  };
}

function guestDraft(brief, suffix) {
  return {
    version: 1,
    kind: "guest_draft",
    labeled: true,
    limitations: ["Saved only on this device."],
    draftId: `guest-${suffix}-${RUN}`,
    title: "Guest draft",
    brief,
    messages: [],
    updatedAt: new Date().toISOString()
  };
}

function priced(scope, amount) {
  return {
    ...scope,
    price: {
      amount,
      currency: "USD",
      terms: "Founder-set. Not a collected payment.",
      paymentStatus: "not_collected"
    }
  };
}

async function runJourney({ name, ownerCookie, otherCookie, founderCookie, brief, expected }) {
  const unadopted = await req("/api/projects/adopt", {
    method: "POST",
    cookie: ownerCookie,
    body: { confirmed: false, draft: guestDraft(brief, `${name}-unconfirmed`) }
  });
  check(`${name} unsigned-in-style adopt without confirm is rejected`, unadopted.status >= 400);

  const adoptOne = await req("/api/projects/adopt", {
    method: "POST",
    cookie: ownerCookie,
    body: { confirmed: true, draft: guestDraft(brief, name) }
  });
  const adoptTwo = await req("/api/projects/adopt", {
    method: "POST",
    cookie: ownerCookie,
    body: { confirmed: true, draft: guestDraft(brief, name) }
  });
  check(
    `${name} guest draft adopts once`,
    adoptOne.status === 200 && adoptTwo.status === 200 && adoptOne.json.project?.id === adoptTwo.json.project?.id,
    adoptOne.json.project?.id
  );
  const id = adoptOne.json.project.id;
  let version = adoptOne.json.project.version;
  check(`${name} adopted context is persisted`, adoptOne.json.project?.brief?.context?.purpose === expected.purpose);

  const loaded = await req(`/api/projects/${id}`, { cookie: ownerCookie });
  check(
    `${name} reload returns the same context`,
    loaded.status === 200 &&
      loaded.json.project?.brief?.context?.purpose === expected.purpose &&
      loaded.json.project?.brief?.context?.route === expected.route &&
      loaded.json.project?.brief?.vision?.value === brief.vision.value
  );

  const saved = await req(`/api/projects/${id}`, {
    method: "PATCH",
    cookie: ownerCookie,
    body: { expectedVersion: version, localGeneration: 1, brief }
  });
  check(`${name} save`, saved.status === 200);
  version = saved.json.project.version;

  const staleSave = await req(`/api/projects/${id}`, {
    method: "PATCH",
    cookie: ownerCookie,
    body: { expectedVersion: version - 1, localGeneration: 2, brief }
  });
  check(`${name} stale save is a conflict`, staleSave.status === 409);

  const otherRead = await req(`/api/projects/${id}`, { cookie: otherCookie });
  check(`${name} second account cannot read`, otherRead.status === 403);

  const otherWrite = await req(`/api/projects/${id}`, {
    method: "PATCH",
    cookie: otherCookie,
    body: { expectedVersion: version, brief }
  });
  check(`${name} second account cannot write`, otherWrite.status === 403);

  const unsigned = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    body: { consent: true, consentTextAcknowledged: true, idempotencyKey: `${RUN}-${name}`, expectedVersion: version }
  });
  check(`${name} unsigned submit is rejected`, unsigned.status === 401 || unsigned.status === 403);

  const submit = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    cookie: ownerCookie,
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: `${RUN}-${name}`,
      expectedVersion: version
    }
  });
  check(`${name} submit`, submit.status === 200 && Boolean(submit.json.receipt?.receiptId), submit.json.receipt?.receiptId);

  const retry = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    cookie: ownerCookie,
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: `${RUN}-${name}`,
      expectedVersion: version
    }
  });
  check(
    `${name} retry does not duplicate`,
    retry.status === 200 && retry.json.duplicate === true && retry.json.receipt?.receiptId === submit.json.receipt?.receiptId
  );

  const staleSubmit = await req(`/api/projects/${id}/submit`, {
    method: "POST",
    cookie: ownerCookie,
    body: {
      consent: true,
      consentTextAcknowledged: true,
      idempotencyKey: `${RUN}-${name}-stale`,
      expectedVersion: version - 1
    }
  });
  check(`${name} stale revision cannot be submitted`, staleSubmit.status === 409);

  const queue = await req("/api/founder/queue", { cookie: founderCookie });
  const queued = queue.json.queue?.find((item) => item.id === id);
  check(`${name} appears in founder queue`, queue.status === 200 && Boolean(queued));

  const ownerQueue = await req("/api/founder/queue", { cookie: ownerCookie });
  check(`${name} owner cannot read founder queue`, ownerQueue.status === 403);

  const review = await req(`/api/founder/projects/${id}/review`, { method: "POST", cookie: founderCookie });
  check(`${name} founder starts review`, review.status === 200);

  const founderView = await req(`/api/founder/projects/${id}`, { cookie: founderCookie });
  const snapshot = founderView.json.submission?.snapshot ?? founderView.json.project?.brief;
  check(
    `${name} founder sees persisted context`,
    founderView.status === 200 &&
      snapshot?.context?.purpose === expected.purpose &&
      snapshot?.context?.route === expected.route &&
      snapshot?.context?.exampleId === expected.exampleId &&
      snapshot?.vision?.value === brief.vision.value
  );

  const otherFounder = await req(`/api/founder/projects/${id}`, { cookie: otherCookie });
  check(`${name} second account cannot founder-review`, otherFounder.status === 403);

  const seeded = await req(`/api/founder/projects/${id}/proposals`, {
    method: "POST",
    cookie: founderCookie,
    body: { seedFromBrief: true, changeSummary: `${name} scoped offer` }
  });
  check(`${name} proposal seeds from the submitted brief`, seeded.status === 200 && seeded.json.proposal?.status === "draft");
  const draftId = seeded.json.proposal?.id;
  const scope = seeded.json.proposal?.scope;
  check(`${name} proposal summary is the submitted vision`, scope?.summary === brief.vision.value);
  for (const assertion of expected.scope) {
    check(`${name} ${assertion.name}`, assertion.ok(scope), assertion.detail?.(scope) ?? "");
  }

  const unpriced = await req(`/api/founder/projects/${id}/proposals/${draftId}/publish`, {
    method: "POST",
    cookie: founderCookie
  });
  check(`${name} unpriced proposal cannot publish`, unpriced.status >= 400);

  const pricedProposal = await req(`/api/founder/projects/${id}/proposals`, {
    method: "POST",
    cookie: founderCookie,
    body: { changeSummary: `${name} scoped offer`, scope: priced(scope, expected.price) }
  });
  check(`${name} founder prices the same draft`, pricedProposal.status === 200 && pricedProposal.json.proposal?.id === draftId);

  const published = await req(`/api/founder/projects/${id}/proposals/${draftId}/publish`, {
    method: "POST",
    cookie: founderCookie
  });
  check(
    `${name} published proposal is v1`,
    published.status === 200 && published.json.proposal?.status === "published" && published.json.proposal?.version === 1
  );

  const clientView = await req(`/api/projects/${id}`, { cookie: ownerCookie });
  check(
    `${name} client reviews the exact published version`,
    clientView.json.nextStep?.code === "review_proposal" && clientView.json.proposals?.[0]?.version === 1
  );

  const staleDecision = await req(`/api/projects/${id}/proposals/${draftId}/decide`, {
    method: "POST",
    cookie: ownerCookie,
    body: { action: "approve", expectedVersion: 99, consent: true, agreementTextAcknowledged: true }
  });
  check(`${name} stale proposal version cannot be approved`, staleDecision.status === 409);

  const otherDecide = await req(`/api/projects/${id}/proposals/${draftId}/decide`, {
    method: "POST",
    cookie: otherCookie,
    body: { action: "approve", expectedVersion: 1, consent: true, agreementTextAcknowledged: true }
  });
  check(`${name} second account cannot accept the proposal`, otherDecide.status === 403);

  const approve = await req(`/api/projects/${id}/proposals/${draftId}/decide`, {
    method: "POST",
    cookie: ownerCookie,
    body: { action: "approve", expectedVersion: 1, consent: true, agreementTextAcknowledged: true }
  });
  check(`${name} client accepts the exact proposal revision`, approve.status === 200 && approve.json.proposal?.status === "approved");

  const confirmed = await req(`/api/projects/${id}`, { cookie: ownerCookie });
  check(
    `${name} confirmed scope matches the accepted revision`,
    confirmed.json.nextStep?.code === "read_confirmed_scope" &&
      confirmed.json.proposals?.[0]?.version === 1 &&
      confirmed.json.proposals?.[0]?.scope?.summary === brief.vision.value
  );

  return id;
}

const owner = await signIn("owner.local@atelier.invalid");
const other = await signIn("owner-two.local@atelier.invalid");
const founder = await signIn("neil.local@atelier.invalid");
check("simulated identities signed in", Boolean(owner && other && founder), "not hosted Auth.js");

await runJourney({
  name: "website",
  ownerCookie: owner,
  otherCookie: other,
  founderCookie: founder,
  brief: websiteBrief(),
  expected: {
    purpose: "business",
    route: "business",
    exampleId: "",
    price: "8200",
    scope: [
      {
        name: "proposal includes website pages",
        ok: (scope) => JSON.stringify(scope?.includedPages) === JSON.stringify(["Home", "About", "Contact"])
      },
      {
        name: "proposal asks for brand materials",
        ok: (scope) => /brand materials/i.test((scope?.clientResponsibilities ?? []).join(" "))
      }
    ]
  }
});

await runJourney({
  name: "workflow",
  ownerCookie: owner,
  otherCookie: other,
  founderCookie: founder,
  brief: workflowBrief(),
  expected: {
    purpose: "professional_workflow",
    route: "custom_project",
    exampleId: "follow_up_workspace",
    price: "5400",
    scope: [
      {
        name: "proposal has no marketing pages",
        ok: (scope) => Array.isArray(scope?.includedPages) && scope.includedPages.length === 0
      },
      {
        name: "proposal stays a bounded workflow",
        ok: (scope) => /actions/i.test((scope?.includedFeatures ?? []).join(" "))
      },
      {
        name: "proposal does not ask for photographs",
        ok: (scope) => !/photographs/i.test((scope?.clientResponsibilities ?? []).join(" "))
      },
      {
        name: "proposal excludes a booking engine",
        ok: (scope) => /booking engine/i.test((scope?.exclusions ?? []).join(" "))
      }
    ]
  }
});

const failed = results.filter((item) => !item.ok);
console.log(`\nintegrated-journeys: ${results.filter((item) => item.ok).length}/${results.length} passed`);
console.log("Auth mode: simulated identities. Not hosted Auth.js / Google / Resend verification.");
if (failed.length) process.exit(1);
