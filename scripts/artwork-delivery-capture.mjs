#!/usr/bin/env node
/** Real UI export/download proof for two identities. Not hosted Auth.js verification. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_SCREENSHOT_DIR ?? "/opt/cursor/artifacts/screenshots";
const FILES = process.env.ATELIER_EXPORT_DIR ?? "/opt/cursor/artifacts/exports";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(FILES, { recursive: true });

function writeMarkPng(file, [r, g, b]) {
  const png = new PNG({ width: 64, height: 32 });
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const i = (y * 64 + x) * 4;
      const mark = x > 12 && x < 52 && y > 8 && y < 24;
      png.data[i] = mark ? r : 255;
      png.data[i + 1] = mark ? g : 255;
      png.data[i + 2] = mark ? b : 255;
      png.data[i + 3] = mark ? 255 : 0;
    }
  }
  fs.writeFileSync(file, PNG.sync.write(png));
}

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

const lumenLogo = path.join(FILES, "lumen-logo.png");
const hearthLogo = path.join(FILES, "hearth-logo.png");
writeMarkPng(lumenLogo, [20, 40, 30]);
writeMarkPng(hearthLogo, [212, 180, 110]);

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width <= 390 ? 844 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: width <= 390 });
  await new Promise((resolve) => setTimeout(resolve, 200));
  const file = path.join(OUT, `delivery_${name}_${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
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

async function waitStudio(page, headline) {
  await page.waitForFunction(
    (text) => /Brand Studio/i.test(document.body.innerText) && document.body.innerText.includes(text),
    { timeout: 20000 },
    headline
  );
  await page.waitForFunction(() => {
    const el = document.querySelector("[data-studio-preview], canvas");
    return el instanceof HTMLCanvasElement && (el.dataset.renderState === "ready" || el.width > 0);
  }, { timeout: 10000 }).catch(() => {});
}

async function confirmAndOpen(page, next) {
  await seedHandoff(page, next);
  await page.goto(`${BASE}/companion/confirm`, { waitUntil: "networkidle0" });
  await page.waitForFunction((headline) => document.body.innerText.includes(headline), { timeout: 15000 }, next.visualPreferences.headline);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      /Confirm and continue|Adopt the newer revision/i.test(node.textContent || "")
    );
    button?.click();
  });
  const needsReplace = await page
    .waitForFunction(() => /Adopt the newer revision|Brand Studio/i.test(document.body.innerText), { timeout: 15000 })
    .then(() => page.evaluate(() => /Adopt the newer revision/i.test(document.body.innerText)));
  if (needsReplace) {
    await page.evaluate(() => {
      [...document.querySelectorAll("button")]
        .find((node) => /Adopt the newer revision/i.test(node.textContent || ""))
        ?.click();
    });
  }
  await waitStudio(page, next.visualPreferences.headline);
  return page.evaluate(() => new URL(window.location.href).searchParams.get("draftId"));
}

async function prepareDownload(page, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  return client;
}

async function waitForDownload(dir, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const files = fs.readdirSync(dir).filter((name) => name.endsWith(".png") && !name.endsWith(".crdownload"));
    if (files.length) {
      const file = path.join(dir, files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)[0]);
      const bytes = fs.readFileSync(file);
      if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return { file, bytes };
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`No PNG download appeared in ${dir}`);
}

function inspectPng(bytes, expected) {
  const decoded = PNG.sync.read(bytes);
  const samples = new Set();
  for (let i = 0; i < decoded.data.length; i += 64) {
    samples.add(`${decoded.data[i]},${decoded.data[i + 1]},${decoded.data[i + 2]}`);
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (decoded.width !== expected.width || decoded.height !== expected.height) {
    throw new Error(`unexpected dimensions ${decoded.width}x${decoded.height}`);
  }
  if (samples.size < 4) {
    throw new Error(`export looks flat (${samples.size} colors) — not finished artwork`);
  }
  const hasCanvas = [...samples].some((value) => {
    const [r, g, b] = value.split(",").map(Number);
    return Math.abs(r - expected.canvas[0]) < 18 && Math.abs(g - expected.canvas[1]) < 18 && Math.abs(b - expected.canvas[2]) < 18;
  });
  if (!hasCanvas) throw new Error(`expected canvas color ${expected.canvas.join(",")} missing`);
  return { width: decoded.width, height: decoded.height, uniqueSamples: samples.size, hash, bytes: bytes.length };
}

async function editAndExport(page, { headline, logoPath, prefix, canvas }) {
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((node) => /Aa · Text|Content/i.test(node.textContent || ""))?.click();
  });
  await page.evaluate((nextHeadline) => {
    const field = document.querySelector("#headline");
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.focus();
      field.value = nextHeadline;
      field.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, headline);
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((node) => /◇ · Logo|Brand/i.test(node.textContent || ""))?.click();
  });
  const failedUpload = path.join(FILES, `${prefix}-not-an-image.txt`);
  fs.writeFileSync(failedUpload, "not an image");
  const logoInput = await page.$("#logo");
  await logoInput.uploadFile(failedUpload);
  await page.waitForFunction(() => /Logo upload failed|failed/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
  await shot(page, 1440, `${prefix}_upload_error`);
  await logoInput.uploadFile(logoPath);
  await page.waitForFunction(() => /Original logo stored/i.test(document.body.innerText), { timeout: 12000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((node) => /Save layers/i.test(node.textContent || ""))?.click();
  });
  await page.waitForFunction(() => /Saved|Original logo stored/i.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
  const preview = await page.evaluate(() => {
    const canvasEl = document.querySelector("[data-studio-preview], canvas");
    return canvasEl instanceof HTMLCanvasElement ? { width: canvasEl.width, height: canvasEl.height, dataUrl: canvasEl.toDataURL("image/png") } : null;
  });
  const downloadDir = path.join(FILES, `${prefix}-download`);
  fs.rmSync(downloadDir, { recursive: true, force: true });
  await prepareDownload(page, downloadDir);
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Export")?.click();
  });
  const downloaded = await waitForDownload(downloadDir);
  const inspected = inspectPng(downloaded.bytes, canvas);
  fs.writeFileSync(path.join(FILES, `${prefix}-export.png`), downloaded.bytes);
  await page.waitForFunction(() => /Export saved|Download failed|Download again/i.test(document.body.innerText), { timeout: 10000 });
  await shot(page, 1440, `${prefix}_exported`);
  await shot(page, 390, `${prefix}_exported`);
  const meta = await page.evaluate(async () => {
    const workspace = await fetch("/api/companion/workspace").then((res) => res.json());
    const studio = await fetch(`/api/companion/studio?businessId=${workspace.business.id}`).then((res) => res.json());
    const draft = studio.draft ?? (studio.drafts || []).find((item) => item.id === (window.__atelierDraftId || item.id));
    const exportAsset = (studio.assets || []).find((item) => item.prompt === "composition_export" && (!draft || item.draftId === draft.id));
    return {
      draftId: draft?.id,
      revisionId: exportAsset?.compositionRevisionId ?? null,
      assetId: exportAsset?.id ?? null,
      outputHash: exportAsset?.outputHash ?? null,
      assetUrl: exportAsset?.id
        ? `/api/companion/assets/${exportAsset.id}?businessId=${encodeURIComponent(workspace.business.id)}`
        : null
    };
  });
  return {
    preview,
    downloaded,
    inspected,
    meta: { ...meta, draftId: new URL(page.url()).searchParams.get("draftId") || meta.draftId }
  };
}

async function reopenAndRedownload(page, meta, prefix, canvas) {
  if (!meta.draftId) throw new Error(`${prefix} missing draft id for reopen`);
  await page.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(meta.draftId)}`, { waitUntil: "networkidle0" });
  await waitStudio(page, "");
  await page.waitForFunction(() => /Download saved export|Download again|Composition exports/i.test(document.body.innerText), {
    timeout: 12000
  });
  const downloadDir = path.join(FILES, `${prefix}-reopen`);
  fs.rmSync(downloadDir, { recursive: true, force: true });
  await prepareDownload(page, downloadDir);
  const clicked = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) =>
      /Download saved export|Download again|Download exported revision/i.test(node.textContent || "")
    );
    button?.click();
    return Boolean(button);
  });
  if (!clicked && meta.assetUrl) {
    const bytes = Buffer.from(await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: "same-origin" });
      return Array.from(new Uint8Array(await res.arrayBuffer()));
    }, meta.assetUrl));
    return inspectPng(bytes, canvas);
  }
  const downloaded = await waitForDownload(downloadDir);
  return inspectPng(downloaded.bytes, canvas);
}

const ownerPage = await browser.newPage();
await ownerPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await ownerPage.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(ownerPage, "owner.local@atelier.invalid");
const lumenDraft = await confirmAndOpen(ownerPage, lumen);
await shot(ownerPage, 1440, "lumen_studio");
const lumenExport = await editAndExport(ownerPage, {
  headline: "Glass reserved",
  logoPath: lumenLogo,
  prefix: "lumen",
  canvas: { width: 1600, height: 1200, canvas: [244, 240, 230] }
});

await ownerPage.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
const reopen = await browser.newPage();
await reopen.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await reopen.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(reopen, "owner.local@atelier.invalid");
const lumenAgain = await reopenAndRedownload(reopen, { ...lumenExport.meta, draftId: lumenDraft }, "lumen", {
  width: 1600,
  height: 1200,
  canvas: [244, 240, 230]
});
if (lumenAgain.hash !== lumenExport.inspected.hash) {
  throw new Error("reopened Lumen export was not byte-identical");
}
await shot(reopen, 1440, "lumen_reopened");

const otherPage = await browser.newPage();
await otherPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await otherPage.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(otherPage, "owner-two.local@atelier.invalid");
const hearthDraft = await confirmAndOpen(otherPage, hearth);
await shot(otherPage, 1440, "hearth_studio");
const hearthExport = await editAndExport(otherPage, {
  headline: "Linen reserved",
  logoPath: hearthLogo,
  prefix: "hearth",
  canvas: { width: 1600, height: 1200, canvas: [26, 22, 18] }
});
const isolation = await otherPage.evaluate(async (url) => {
  const file = await fetch(url, { credentials: "same-origin" });
  return { exportStatus: file.status, bodyPreview: (await file.text()).slice(0, 80) };
}, lumenExport.meta.assetUrl);
if (isolation.exportStatus === 200) throw new Error("second account read the first account export bytes");

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
const revisionTwoDraft = await confirmAndOpen(revise, revised);
await shot(revise, 1440, "revision_two_studio");
await revise.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(lumenDraft)}`, { waitUntil: "networkidle0" });
await revise.waitForFunction(() => /Glass evening/i.test(document.body.innerText), { timeout: 12000 });
await shot(revise, 1440, "revision_one_preserved");
const firstExportAgain = await reopenAndRedownload(revise, { ...lumenExport.meta, draftId: lumenDraft }, "lumen-kept", {
  width: 1600,
  height: 1200,
  canvas: [244, 240, 230]
});
if (firstExportAgain.hash !== lumenExport.inspected.hash) {
  throw new Error("revision two adoption changed the first export bytes");
}

const summary = {
  lumenDraft,
  hearthDraft,
  revisionTwoDraft,
  lumen: { ...lumenExport.inspected, ...lumenExport.meta },
  hearth: { ...hearthExport.inspected, ...hearthExport.meta },
  isolation,
  reopenHash: lumenAgain.hash
};
fs.writeFileSync(path.join(FILES, "artwork-delivery.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (lumenDraft === hearthDraft) throw new Error("both identities opened the same draft");
if (revisionTwoDraft === lumenDraft) throw new Error("revision two overwrote the first draft");
await browser.close();
