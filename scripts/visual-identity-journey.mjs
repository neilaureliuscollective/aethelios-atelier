#!/usr/bin/env node
/** Two distinct visual identities through claim → confirm → Studio → revision → isolation. */
import { createHash } from "node:crypto";
import { PNG } from "pngjs";

function encodeSolidPng(width, height, rgba = [244, 240, 230, 255]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0];
    png.data[i + 1] = rgba[1];
    png.data[i + 2] = rgba[2];
    png.data[i + 3] = rgba[3];
  }
  return PNG.sync.write(png);
}

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
  return { status: res.status, json, setCookie, headers: res.headers };
}

function cookieHeader(setCookie) {
  return setCookie.map((item) => item.split(";")[0]).join("; ");
}

async function signIn(email) {
  const res = await req("/api/session/sign-in", { method: "POST", body: { email } });
  if (res.status !== 200) throw new Error(`sign-in ${email} ${res.status} ${JSON.stringify(res.json)}`);
  return cookieHeader(res.setCookie);
}

function selection({ selectionId, localRevision, selectedDirectionId, paletteId, visualDirectionId, businessName, headline, audience }) {
  return {
    selectionId,
    localRevision,
    catalogVersion: 1,
    templateVersion: 1,
    businessName,
    businessType: "independent",
    audience,
    desiredQualities: ["refined"],
    intent: "clearer_presence",
    intentNote: "",
    customerFeeling: "calm",
    selectedDirectionId,
    visualPreferences: { paletteId, visualDirectionId, headline },
    serviceInterest: "website",
    likesNote: "",
    changeNote: "",
    visitorNotes: "",
    exclusions: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` ${detail}` : ""}`);
}

const owner = await signIn("owner.local@atelier.invalid");
const other = await signIn("owner-two.local@atelier.invalid");
const lumenId = `dsel_lumen_${crypto.randomUUID().slice(0, 8)}`;
const hearthId = `dsel_hearth_${crypto.randomUUID().slice(0, 8)}`;

const lumen = selection({
  selectionId: lumenId,
  localRevision: 1,
  selectedDirectionId: "lumen",
  paletteId: "ivory_hall",
  visualDirectionId: "glass",
  businessName: "Lumen House",
  headline: "Glass evening",
  audience: "Quiet light."
});
const hearth = selection({
  selectionId: hearthId,
  localRevision: 1,
  selectedDirectionId: "hearth",
  paletteId: "hearth_linen",
  visualDirectionId: "material",
  businessName: "Hearth Room",
  headline: "Linen gathering",
  audience: "Warm rooms."
});

async function adopt(cookie, next, replace = false) {
  const claimed = await req("/api/companion/guest-claim", {
    method: "POST",
    cookie,
    body: { guestWorkId: next.selectionId, kind: "discovery", destination: "/companion/confirm", payload: next }
  });
  const ws = await req("/api/companion/workspace", { cookie });
  const confirmed = await req("/api/companion/confirm", {
    method: "POST",
    cookie,
    body: {
      businessId: ws.json.business.id,
      businessName: next.businessName,
      businessContext: next.audience,
      sourceSelectionId: next.selectionId,
      sourceRevision: next.localRevision,
      directionId: next.selectedDirectionId,
      replaceConfirmedDirection: replace
    }
  });
  return { claimed, ws, confirmed };
}

const first = await adopt(owner, lumen);
check("lumen claim", first.claimed.status === 200);
check("lumen confirm", first.confirmed.status === 200 && first.confirmed.json.draft?.id);
check(
  "lumen visual identity",
  first.confirmed.json.draft?.brandKit?.designSpec?.paletteId === "ivory_hall" &&
    first.confirmed.json.draft?.brandKit?.designSpec?.visualDirectionId === "glass" &&
    first.confirmed.json.draft?.layout === "direction_board" &&
    first.confirmed.json.draft?.layers?.some((layer) => layer.text === "Glass evening")
);
check("lumen palette is not Atelier chrome", first.confirmed.json.draft?.palette?.canvas === "#F4F0E6");

const sameClaim = await req("/api/companion/guest-claim", {
  method: "POST",
  cookie: owner,
  body: { guestWorkId: lumenId, kind: "discovery", payload: lumen }
});
check("identical lumen claim is idempotent", sameClaim.status === 200 && sameClaim.json.claim?.createdAt === first.claimed.json.claim.createdAt);

const conflictSameRev = await req("/api/companion/guest-claim", {
  method: "POST",
  cookie: owner,
  body: {
    guestWorkId: lumenId,
    kind: "discovery",
    payload: { ...lumen, selectedDirectionId: "signal", visualPreferences: { ...lumen.visualPreferences, paletteId: "signal_ink" } }
  }
});
check("same revision different content conflicts", conflictSameRev.status === 409);

const secondAccount = await adopt(other, hearth);
check("hearth claim on second account", secondAccount.claimed.status === 200);
check("hearth confirm", secondAccount.confirmed.status === 200 && secondAccount.confirmed.json.draft?.id);
check(
  "hearth visual identity differs from lumen",
  secondAccount.confirmed.json.draft?.brandKit?.designSpec?.paletteId === "hearth_linen" &&
    secondAccount.confirmed.json.draft?.brandKit?.designSpec?.visualDirectionId === "material" &&
    secondAccount.confirmed.json.draft?.palette?.canvas === "#1A1612" &&
    secondAccount.confirmed.json.draft?.id !== first.confirmed.json.draft?.id
);

const lumenDraft = first.confirmed.json.draft.id;
const hearthDraft = secondAccount.confirmed.json.draft.id;
const stolen = await req(
  `/api/companion/studio?businessId=${first.ws.json.business.id}&draftId=${lumenDraft}`,
  { cookie: other }
);
check("second account cannot read first draft", stolen.status === 403);

const stolenAsset = await req(`/api/companion/assets/asset_missing?businessId=${first.ws.json.business.id}`, {
  cookie: other
});
check("second account cannot read first asset bytes", [403, 404].includes(stolenAsset.status));

const revised = {
  ...lumen,
  localRevision: 2,
  selectedDirectionId: "signal",
  visualPreferences: { paletteId: "signal_ink", visualDirectionId: "mark", headline: "A clear mark" },
  businessName: "Lumen House · Signal"
};
const revisedClaim = await req("/api/companion/guest-claim", {
  method: "POST",
  cookie: owner,
  body: { guestWorkId: lumenId, kind: "discovery", payload: revised }
});
check("newer revision is claimable", revisedClaim.status === 200 && revisedClaim.json.claim?.sourceRevision === 2);
check(
  "first claim snapshot remains",
  (await req(`/api/companion/guest-claim?guestWorkId=${lumenId}&sourceRevision=1`, { cookie: owner })).status === 200
);

const silent = await req("/api/companion/confirm", {
  method: "POST",
  cookie: owner,
  body: {
    businessId: first.ws.json.business.id,
    businessName: revised.businessName,
    businessContext: revised.audience,
    sourceSelectionId: lumenId,
    sourceRevision: 2,
    directionId: "signal"
  }
});
check("newer revision requires explicit replace", silent.status === 409);

const replaced = await req("/api/companion/confirm", {
  method: "POST",
  cookie: owner,
  body: {
    businessId: first.ws.json.business.id,
    businessName: revised.businessName,
    businessContext: revised.audience,
    sourceSelectionId: lumenId,
    sourceRevision: 2,
    directionId: "signal",
    replaceConfirmedDirection: true
  }
});
check("explicit replace adopts revision two", replaced.status === 200 && replaced.json.draft?.id && replaced.json.draft.id !== lumenDraft);
check(
  "revision two carries signal ink",
  replaced.json.draft?.brandKit?.designSpec?.paletteId === "signal_ink" &&
    replaced.json.draft?.layers?.some((layer) => layer.text === "A clear mark")
);
const kept = await req(
  `/api/companion/studio?businessId=${first.ws.json.business.id}&draftId=${lumenDraft}`,
  { cookie: owner }
);
check(
  "first lumen draft is preserved",
  kept.status === 200 &&
    kept.json.draft?.id === lumenDraft &&
    kept.json.draft?.brandKit?.designSpec?.paletteId === "ivory_hall" &&
    kept.json.draft?.layers?.some((layer) => layer.text === "Glass evening")
);

const listed = await req(`/api/companion/studio?businessId=${first.ws.json.business.id}`, { cookie: owner });
check("owner now has two drafts", listed.status === 200 && (listed.json.drafts?.length ?? 0) >= 2);

const board = { width: 1600, height: 1200 };
const png = encodeSolidPng(board.width, board.height, [244, 240, 230, 255]);
const composed = Buffer.from(png).toString("base64");
const exported = await req("/api/companion/studio/export", {
  method: "POST",
  cookie: owner,
  body: {
    businessId: first.ws.json.business.id,
    draftId: lumenDraft,
    format: "direction_board",
    layout: "direction_board",
    layers: kept.json.draft.layers,
    composedPngBase64: composed,
    expectedUpdatedAt: kept.json.draft.updatedAt
  }
});
check("lumen export bound", exported.status === 200 && Boolean(exported.json.exported?.assetUrl));
const file = await fetch(`${BASE}${exported.json.exported.assetUrl}`, { headers: { cookie: owner } });
const bytes = Buffer.from(await file.arrayBuffer());
const hash = createHash("sha256").update(bytes).digest("hex");
check("owner can read export bytes", file.ok && bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50);
const foreignFile = await fetch(`${BASE}${exported.json.exported.assetUrl}`, { headers: { cookie: other } });
check("second account cannot read export bytes", !foreignFile.ok);

console.log(
  JSON.stringify(
    {
      lumenDraft,
      hearthDraft,
      revisionTwoDraft: replaced.json.draft?.id,
      lumenPalette: first.confirmed.json.draft?.palette,
      hearthPalette: secondAccount.confirmed.json.draft?.palette,
      exportHash: hash,
      exportBytes: bytes.length
    },
    null,
    2
  )
);

const failed = checks.filter((item) => !item.ok);
if (failed.length) {
  console.error(`failed ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`passed ${checks.length}/${checks.length}`);
