#!/usr/bin/env node
/** Local simulated-identity journey: guest claim, confirmation, two-account isolation. */
const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";

async function req(path, { method = "GET", body, cookie } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie =
    res.headers.getSetCookie?.() ?? (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json, setCookie };
}

function cookieHeader(setCookie) {
  return setCookie.map((item) => item.split(";")[0]).join("; ");
}

async function signIn(email) {
  const res = await req("/api/session/sign-in", { method: "POST", body: { email } });
  if (res.status !== 200) throw new Error(`sign-in ${email} ${res.status}`);
  return cookieHeader(res.setCookie);
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`);
}

const owner = await signIn("owner.local@atelier.invalid");
const other = await signIn("owner-two.local@atelier.invalid");

const guestWorkId = `dsel_${crypto.randomUUID()}`;
const claimed = await req("/api/companion/guest-claim", {
  method: "POST",
  cookie: owner,
  body: { guestWorkId, kind: "discovery", destination: "/companion/confirm", payload: { selectedDirectionId: "lumen" } }
});
check("owner claims discovery", claimed.status === 200 && claimed.json.claim?.guestWorkId === guestWorkId);

const retry = await req("/api/companion/guest-claim", {
  method: "POST",
  cookie: owner,
  body: { guestWorkId, kind: "discovery", destination: "/companion/studio" }
});
check("claim is idempotent", retry.status === 200 && retry.json.claim?.createdAt === claimed.json.claim.createdAt);

const stolen = await req("/api/companion/guest-claim", {
  method: "POST",
  cookie: other,
  body: { guestWorkId, kind: "discovery", destination: "/companion/confirm" }
});
check("other account cannot steal claim", stolen.status === 403);

const ws = await req("/api/companion/workspace", { cookie: owner });
check("owner workspace", ws.status === 200 && Boolean(ws.json.business?.id));
const otherWs = await req("/api/companion/workspace", { cookie: other });
check("other workspace is different", otherWs.status === 200 && otherWs.json.business.id !== ws.json.business.id);

const foreign = await req(`/api/companion/workspace?businessId=${ws.json.business.id}`, { cookie: other });
check("other cannot read owner business", foreign.status === 403);

const confirmed = await req("/api/companion/confirm", {
  method: "POST",
  cookie: owner,
  body: {
    businessId: ws.json.business.id,
    businessName: "Northridge Sitting Room",
    businessContext: "A quiet sitting room.",
    sourceSelectionId: guestWorkId,
    sourceRevision: 1,
    directionId: "lumen"
  }
});
check("owner confirmation saved", confirmed.status === 200 && confirmed.json.confirmation?.businessName === "Northridge Sitting Room");

const conflict = await req("/api/companion/confirm", {
  method: "POST",
  cookie: owner,
  body: {
    businessId: ws.json.business.id,
    businessName: "Northridge Sitting Room",
    businessContext: "A quiet sitting room.",
    sourceSelectionId: "dsel_other",
    sourceRevision: 2,
    directionId: "hearth"
  }
});
check("stale direction conflicts", conflict.status === 409);

const otherConfirm = await req("/api/companion/confirm", {
  method: "POST",
  cookie: other,
  body: {
    businessId: ws.json.business.id,
    businessName: "Stolen",
    businessContext: "no"
  }
});
check("other cannot confirm owner business", otherConfirm.status === 403);

const badNext = await req("/api/session/start", {
  method: "POST",
  body: { provider: "google", callbackUrl: "https://evil.example" }
});
check("authjs start stays fail-closed locally", [401, 403, 503].includes(badNext.status));

const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`failed ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`passed ${checks.length}/${checks.length}`);
