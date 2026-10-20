#!/usr/bin/env node
/** Browser proof of two distinct identities plus revision-two adoption. */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_SCREENSHOT_DIR ?? "/opt/cursor/artifacts/screenshots";
fs.mkdirSync(OUT, { recursive: true });

function makeSelection({ selectionId, localRevision, selectedDirectionId, paletteId, visualDirectionId, businessName, headline, audience }) {
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

const lumen = makeSelection({
  selectionId: `dsel_lumen_${crypto.randomUUID().slice(0, 8)}`,
  localRevision: 1,
  selectedDirectionId: "lumen",
  paletteId: "ivory_hall",
  visualDirectionId: "glass",
  businessName: "Lumen House",
  headline: "Glass evening",
  audience: "Quiet light."
});
const hearth = makeSelection({
  selectionId: `dsel_hearth_${crypto.randomUUID().slice(0, 8)}`,
  localRevision: 1,
  selectedDirectionId: "hearth",
  paletteId: "hearth_linen",
  visualDirectionId: "material",
  businessName: "Hearth Room",
  headline: "Linen gathering",
  audience: "Warm rooms."
});

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width <= 390 ? 844 : width <= 884 ? 1100 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width <= 390 });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const file = path.join(OUT, `visual_${name}_${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
  return file;
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

async function seedHandoff(page, next) {
  await page.evaluate((value) => {
    window.sessionStorage.setItem(
      "aethelios.atelier.discovery.handoff.v1",
      JSON.stringify({ kind: "discovery_handoff", selection: value })
    );
    window.sessionStorage.setItem(
      "aethelios.atelier.guestIntent.v1",
      JSON.stringify({
        version: 1,
        kind: "guest_intent",
        guestWorkId: value.selectionId,
        destination: "/companion/confirm",
        selectionId: value.selectionId,
        localRevision: value.localRevision,
        updatedAt: new Date().toISOString()
      })
    );
  }, next);
}

async function confirmAndOpen(page, next, shotsPrefix) {
  await seedHandoff(page, next);
  await page.goto(`${BASE}/companion/confirm`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => !/Checking this workspace|Checking authorization/i.test(document.body.innerText), {
    timeout: 12000
  }).catch(() => {});
  await page.waitForFunction(
    (headline) => document.body.innerText.includes(headline),
    { timeout: 12000 },
    next.visualPreferences.headline
  );
  await shot(page, 1440, `${shotsPrefix}_confirm`);
  await shot(page, 390, `${shotsPrefix}_confirm`);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      /Confirm and continue|Adopt the newer revision/i.test(node.textContent || "")
    );
    button?.click();
  });
  await page.waitForFunction(() => /Brand Studio|Opening the matching Studio|Adopt the newer revision/i.test(document.body.innerText), {
    timeout: 15000
  });
  const needsReplace = await page.evaluate(() => /Adopt the newer revision|Replace the previous direction/i.test(document.body.innerText));
  if (needsReplace) {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("button")].find((node) =>
        /Adopt the newer revision|Replace the previous direction/i.test(node.textContent || "")
      );
      button?.click();
    });
  }
  await page.waitForFunction(
    (headline) => /Brand Studio/i.test(document.body.innerText) && document.body.innerText.includes(headline),
    { timeout: 15000 },
    next.visualPreferences.headline
  );
  await page.waitForFunction(() => !/Checking this workspace|Resolving authorization/i.test(document.body.innerText), {
    timeout: 10000
  }).catch(() => {});
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-studio-preview], canvas");
    return el instanceof HTMLCanvasElement && el.dataset.renderState === "ready";
  }, { timeout: 8000 }).catch(() => {});
  await shot(page, 1440, `${shotsPrefix}_studio`);
  await shot(page, 884, `${shotsPrefix}_studio`);
  await shot(page, 390, `${shotsPrefix}_studio`);
  const draftId = await page.evaluate(() => new URL(window.location.href).searchParams.get("draftId"));
  if (!draftId) throw new Error(`${shotsPrefix} did not open an exact Studio draft`);
  const canvas = await page.evaluate(() => {
    const el = document.querySelector("[data-studio-preview], .previewCanvas, canvas");
    const box = document.querySelector("[aria-label='Composition preview']");
    return {
      renderState: el instanceof HTMLCanvasElement ? el.dataset.renderState ?? "" : "",
      background: box instanceof HTMLElement ? box.style.background : ""
    };
  });
  return { draftId, canvas };
}

const ownerPage = await browser.newPage();
await ownerPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await ownerPage.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(ownerPage, "owner.local@atelier.invalid");
const lumenOpen = await confirmAndOpen(ownerPage, lumen, "lumen");

await ownerPage.evaluate(() => {
  const headline = document.querySelector("#headline");
  if (headline instanceof HTMLInputElement) {
    headline.focus();
    headline.value = "Glass evening · reserved";
    headline.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await ownerPage.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => /Save layers/i.test(node.textContent || ""));
  button?.click();
});
await ownerPage.waitForFunction(() => /Saved/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
await shot(ownerPage, 1440, "lumen_saved");

await ownerPage.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});

const reopen = await browser.newPage();
await reopen.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await reopen.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(reopen, "owner.local@atelier.invalid");
await reopen.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(lumenOpen.draftId)}`, { waitUntil: "networkidle0" });
await reopen.waitForFunction(() => /Glass evening/i.test(document.body.innerText), { timeout: 12000 });
await shot(reopen, 1440, "lumen_reopened");
await shot(reopen, 390, "lumen_reopened");

const otherPage = await browser.newPage();
await otherPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await otherPage.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(otherPage, "owner-two.local@atelier.invalid");
const hearthOpen = await confirmAndOpen(otherPage, hearth, "hearth");
const isolation = await otherPage.evaluate(async (id) => {
  const workspace = await fetch("/api/companion/workspace").then((res) => res.json());
  const stolen = await fetch(`/api/companion/studio?businessId=${workspace.business.id}&draftId=${encodeURIComponent(id)}`);
  return { stolenStatus: stolen.status, otherBusiness: workspace.business?.id ?? null };
}, lumenOpen.draftId);
if (isolation.stolenStatus === 200) throw new Error("second account obtained the first identity draft");
await otherPage.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(lumenOpen.draftId)}`, { waitUntil: "networkidle0" });
await shot(otherPage, 1440, "lumen_foreign_blocked");

const revise = await browser.newPage();
await revise.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await revise.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(revise, "owner.local@atelier.invalid");
const revised = {
  ...lumen,
  localRevision: 2,
  selectedDirectionId: "signal",
  visualPreferences: { paletteId: "signal_ink", visualDirectionId: "mark", headline: "A clear mark" }
};
await seedHandoff(revise, revised);
await revise.goto(`${BASE}/companion/confirm`, { waitUntil: "networkidle0" });
await revise.waitForFunction(() => /A clear mark|Signal/i.test(document.body.innerText), { timeout: 12000 });
await shot(revise, 1440, "revision_two_confirm");
await revise.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) =>
    /Adopt the newer revision|Confirm and continue/i.test(node.textContent || "")
  );
  button?.click();
});
await revise.waitForFunction(() => /A clear mark|Brand Studio|Adopt the newer revision/i.test(document.body.innerText), {
  timeout: 15000
});
const replaceVisible = await revise.evaluate(() => /Adopt the newer revision/i.test(document.body.innerText));
if (replaceVisible) {
  await revise.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => /Adopt the newer revision/i.test(node.textContent || ""));
    button?.click();
  });
}
await revise.waitForFunction(() => /A clear mark/i.test(document.body.innerText) && /Brand Studio/i.test(document.body.innerText), {
  timeout: 15000
});
await shot(revise, 1440, "revision_two_studio");
const revisionTwoId = await revise.evaluate(() => new URL(window.location.href).searchParams.get("draftId"));
await revise.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(lumenOpen.draftId)}`, { waitUntil: "networkidle0" });
await revise.waitForFunction(() => /Glass evening/i.test(document.body.innerText), { timeout: 12000 });
await shot(revise, 1440, "revision_one_preserved");

const summary = {
  lumenDraft: lumenOpen.draftId,
  hearthDraft: hearthOpen.draftId,
  revisionTwoDraft: revisionTwoId,
  isolation,
  lumenCanvas: lumenOpen.canvas,
  hearthCanvas: hearthOpen.canvas
};
fs.writeFileSync(path.join(OUT, "visual_journeys.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (lumenOpen.draftId === hearthOpen.draftId) throw new Error("both identities opened the same draft");
if (revisionTwoId === lumenOpen.draftId) throw new Error("revision two overwrote the first draft id");
await browser.close();
