#!/usr/bin/env node
/** Strict UI export/download proof. Simulated local identities — not hosted Auth.js verification. */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_SCREENSHOT_DIR ?? "/opt/cursor/artifacts/screenshots";
const FILES = process.env.ATELIER_EXPORT_DIR ?? "/opt/cursor/artifacts/exports";
/** Same documented preview/export raster tolerance as src/lib/cofounder/png.ts. */
const RASTER_TOLERANCE = 2;
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

async function waitArtworkReady(page, timeout = 30000) {
  await page.evaluate(() => document.fonts.ready);
  try {
    await page.waitForFunction(() => {
      const el = document.querySelector("[data-studio-preview='canvas']");
      return el instanceof HTMLCanvasElement && el.dataset.renderState === "ready" && el.width > 8 && el.height > 8;
    }, { timeout });
  } catch (error) {
    const diag = await page.evaluate(() => {
      const el = document.querySelector("[data-studio-preview='canvas']");
      return {
        title: document.title,
        canvas: el instanceof HTMLCanvasElement ? { width: el.width, height: el.height, state: el.dataset.renderState } : null,
        images: [...document.images].map((img) => ({
          src: img.currentSrc.slice(-96),
          complete: img.complete,
          naturalWidth: img.naturalWidth
        })),
        excerpt: document.body.innerText.replace(/\s+/g, " ").slice(0, 280)
      };
    });
    throw new Error(`Artwork was not ready: ${error.message} ${JSON.stringify(diag)}`);
  }
}

async function waitStudio(page, headline, { requireArtwork = true } = {}) {
  await page.waitForFunction(
    (text) => /Brand Studio/i.test(document.body.innerText) && (!text || document.body.innerText.includes(text)),
    { timeout: 20000 },
    headline
  );
  if (requireArtwork) await waitArtworkReady(page);
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
  const needsReplace = await page.waitForFunction(
    () => /Adopt the newer revision|Brand Studio/i.test(document.body.innerText),
    { timeout: 15000 }
  ).then(() => page.evaluate(() => /Adopt the newer revision/i.test(document.body.innerText)));
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

async function clickNamed(page, pattern) {
  const clicked = await page.evaluate((source) => {
    const match = new RegExp(source, "i");
    const button = [...document.querySelectorAll("button")].find((node) => match.test(node.textContent || ""));
    button?.click();
    return Boolean(button);
  }, pattern);
  if (!clicked) throw new Error(`control not found: ${pattern}`);
}

async function fillControlled(page, selector, value) {
  const exists = await page.$(selector);
  if (!exists) throw new Error(`missing field ${selector}`);
  await page.focus(selector);
  const filled = await page.evaluate((sel, next) => {
    const el = document.querySelector(sel);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (!setter) return false;
    el.focus();
    setter.call(el, next);
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: next, inputType: "insertReplacementText" }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return el.value === next;
  }, selector, value);
  if (!filled) throw new Error(`React-controlled fill failed for ${selector}`);
  const actual = await page.$eval(selector, (el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement ? el.value : "");
  if (actual !== value) {
    throw new Error(`field ${selector} is ${JSON.stringify(actual)}, expected ${JSON.stringify(value)}`);
  }
}

async function assertHeadline(page, expected, when) {
  const actual = await page.$eval("#headline", (el) => el instanceof HTMLInputElement ? el.value : "");
  if (actual !== expected) {
    throw new Error(`${when}: headline is ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

async function prepareDownload(page, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  return client;
}

async function waitForDownload(dir, timeoutMs = 20000) {
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
  throw new Error(`No PNG download appeared in ${dir} within ${timeoutMs}ms`);
}

function decodePng(bytes) {
  return PNG.sync.read(bytes, { checkCRC: true });
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function maxChannelDelta(left, right) {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let max = 0;
  for (let i = 0; i < left.length; i += 1) {
    const delta = Math.abs((left[i] ?? 0) - (right[i] ?? 0));
    if (delta > max) max = delta;
  }
  return max;
}

function inspectArtwork(bytes, expected) {
  const decoded = decodePng(bytes);
  const samples = new Set();
  for (let i = 0; i < decoded.data.length; i += 64) {
    samples.add(`${decoded.data[i]},${decoded.data[i + 1]},${decoded.data[i + 2]}`);
  }
  const hash = hashBytes(bytes);
  if (decoded.width !== expected.width || decoded.height !== expected.height) {
    throw new Error(`unexpected dimensions ${decoded.width}x${decoded.height}, expected ${expected.width}x${expected.height}`);
  }
  if (samples.size < 8) {
    throw new Error(`export looks flat (${samples.size} colors) — not finished artwork`);
  }
  const hasCanvas = [...samples].some((value) => {
    const [r, g, b] = value.split(",").map(Number);
    return Math.abs(r - expected.canvas[0]) < 18 && Math.abs(g - expected.canvas[1]) < 18 && Math.abs(b - expected.canvas[2]) < 18;
  });
  if (!hasCanvas) throw new Error(`expected canvas color ${expected.canvas.join(",")} missing`);
  const inkish = [...decoded.data].filter((_, index) => index % 4 !== 3).some((value, index) => {
    if (index % 3 !== 0) return false;
    const r = decoded.data[index];
    const g = decoded.data[index + 1];
    const b = decoded.data[index + 2];
    return Math.abs(r - expected.canvas[0]) > 40 || Math.abs(g - expected.canvas[1]) > 40 || Math.abs(b - expected.canvas[2]) > 40;
  });
  if (!inkish) throw new Error("decoded artwork has no meaningful ink/image contrast against the canvas");
  return { width: decoded.width, height: decoded.height, uniqueSamples: samples.size, hash, bytes: bytes.length };
}

function comparePreviewAndDownload(previewBytes, downloadBytes, expected) {
  const preview = decodePng(previewBytes);
  const downloaded = decodePng(downloadBytes);
  if (preview.width !== downloaded.width || preview.height !== downloaded.height) {
    throw new Error(
      `preview ${preview.width}×${preview.height} does not match download ${downloaded.width}×${downloaded.height}`
    );
  }
  if (preview.width !== expected.width || preview.height !== expected.height) {
    throw new Error(`comparison dimensions ${preview.width}×${preview.height} do not match ${expected.width}×${expected.height}`);
  }
  const delta = maxChannelDelta(preview.data, downloaded.data);
  if (delta > RASTER_TOLERANCE) {
    throw new Error(`preview/export raster delta ${delta} exceeds documented tolerance ${RASTER_TOLERANCE}`);
  }
  return { delta, width: preview.width, height: preview.height, tolerance: RASTER_TOLERANCE };
}

function assertIsolationContract(status, body, expected) {
  if (status === 200) throw new Error("Cross-account or missing-artifact read returned HTTP 200.");
  if (expected === "unauthenticated" && status === 401 && body?.ok === false && body?.error === "unauthenticated") return;
  if (expected === "forbidden" && status === 403 && body?.ok === false && body?.error === "forbidden") return;
  if (expected === "not_found" && status === 404 && body?.ok === false && body?.error === "not_found") return;
  throw new Error(
    `Isolation contract failed: expected ${expected}, got HTTP ${status} error=${String(body?.error)}. A server error is not isolation evidence.`
  );
}

async function capturePreviewPng(page) {
  await waitArtworkReady(page);
  const dataUrl = await page.evaluate(() => {
    const canvas = document.querySelector("[data-studio-preview='canvas']");
    if (!(canvas instanceof HTMLCanvasElement) || canvas.dataset.renderState !== "ready") {
      throw new Error("preview canvas is not ready");
    }
    return { dataUrl: canvas.toDataURL("image/png"), width: canvas.width, height: canvas.height };
  });
  const bytes = Buffer.from(dataUrl.dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  return { bytes, width: dataUrl.width, height: dataUrl.height };
}

async function exportBinding(page) {
  return page.evaluate(() => {
    const status = document.querySelector("[data-export-bound-draft]");
    const download = document.querySelector("[data-download-saved-export]");
    return {
      boundDraft: status?.getAttribute("data-export-bound-draft") || "",
      revision: status?.getAttribute("data-export-revision") || "",
      prior: status?.getAttribute("data-export-prior-revision") || "false",
      stage: status?.getAttribute("data-export-stage") || "",
      selected: document.querySelector("#studio-draft")?.value || "",
      downloadDraft: download?.getAttribute("data-download-saved-export") || "",
      hasDownload: Boolean(download),
      body: document.body.innerText
    };
  });
}

async function readStudioMeta(page, draftId) {
  return page.evaluate(async (wanted) => {
    const workspace = await fetch("/api/companion/workspace").then((res) => res.json());
    const studio = await fetch(`/api/companion/studio?businessId=${workspace.business.id}`).then((res) => res.json());
    const drafts = studio.drafts || [];
    const draft = drafts.find((item) => item.id === wanted) || drafts[0];
    const exports = (studio.assets || []).filter((item) => item.prompt === "composition_export" && item.draftId === draft?.id);
    const exportAsset = exports.sort((left, right) => right.revision - left.revision)[0];
    return {
      businessId: workspace.business.id,
      draftId: draft?.id ?? null,
      headline: draft?.layers?.find((layer) => layer.kind === "headline")?.text ?? "",
      layout: draft?.layout ?? null,
      exportCount: exports.length,
      revisionId: exportAsset?.compositionRevisionId ?? null,
      assetId: exportAsset?.id ?? null,
      outputHash: exportAsset?.outputHash ?? null,
      assetUrl: exportAsset?.id
        ? `/api/companion/assets/${exportAsset.id}?businessId=${encodeURIComponent(workspace.business.id)}`
        : null
    };
  }, draftId);
}

async function chooseDraft(page, draftId) {
  await clickNamed(page, "Aa · Text|Content");
  await page.waitForSelector("#studio-draft", { timeout: 8000 });
  await page.select("#studio-draft", draftId);
  await page.waitForFunction((id) => document.querySelector("#studio-draft")?.value === id, { timeout: 8000 }, draftId);
}

async function chooseLayout(page, layoutId, label) {
  await clickNamed(page, "▣ · Format|Layout");
  await page.waitForSelector("#studio-layout", { timeout: 8000 });
  await page.select("#studio-layout", layoutId);
  const actual = await page.$eval("#studio-layout", (el) => el instanceof HTMLSelectElement ? el.value : "");
  if (actual !== layoutId) throw new Error(`layout is ${actual}, expected ${layoutId} (${label})`);
}

async function editAndExport(page, { headline, logoPath, prefix, canvas, layoutId, layoutLabel }) {
  await clickNamed(page, "Aa · Text|Content");
  await fillControlled(page, "#headline", headline);
  await assertHeadline(page, headline, "before save");
  if (layoutId) {
    await chooseLayout(page, layoutId, layoutLabel ?? layoutId);
  }
  await clickNamed(page, "◇ · Logo|Brand");
  const failedUpload = path.join(FILES, `${prefix}-not-an-image.txt`);
  fs.writeFileSync(failedUpload, "not an image");
  const logoInput = await page.$("#logo");
  if (!logoInput) throw new Error("logo input missing");
  await logoInput.uploadFile(failedUpload);
  await page.waitForFunction(
    () => /Logo must be an image file|Logos must be an image file|Logo upload failed/i.test(document.body.innerText),
    { timeout: 15000 }
  );
  await shot(page, 1440, `${prefix}_upload_error`);
  await logoInput.uploadFile(logoPath);
  await page.waitForFunction(() => /Original logo stored/i.test(document.body.innerText), { timeout: 20000 });
  await clickNamed(page, "Aa · Text|Content");
  await assertHeadline(page, headline, "after logo upload");
  const saveNeeded = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((node) => /Save layers/i.test(node.textContent || ""))
  );
  if (saveNeeded) {
    await clickNamed(page, "Save layers");
    await page.waitForFunction(() => /Saved|Original logo stored/i.test(document.body.innerText), { timeout: 15000 });
  }
  await assertHeadline(page, headline, "after save");
  await waitArtworkReady(page);
  const preview = await capturePreviewPng(page);
  if (preview.width !== canvas.width || preview.height !== canvas.height) {
    throw new Error(`preview ${preview.width}×${preview.height} does not match expected ${canvas.width}×${canvas.height}`);
  }
  const downloadDir = path.join(FILES, `${prefix}-download`);
  fs.rmSync(downloadDir, { recursive: true, force: true });
  await prepareDownload(page, downloadDir);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Export");
    if (!button) throw new Error("Export control missing");
    button.click();
  });
  const downloaded = await waitForDownload(downloadDir);
  const inspected = inspectArtwork(downloaded.bytes, canvas);
  const comparison = comparePreviewAndDownload(preview.bytes, downloaded.bytes, canvas);
  fs.writeFileSync(path.join(FILES, `${prefix}-export.png`), downloaded.bytes);
  fs.writeFileSync(path.join(FILES, `${prefix}-preview.png`), preview.bytes);
  await page.waitForFunction(() => /Export saved|Download failed|Download again/i.test(document.body.innerText), {
    timeout: 15000
  });
  await shot(page, 1440, `${prefix}_exported`);
  await shot(page, 390, `${prefix}_exported`);
  const draftId = new URL(page.url()).searchParams.get("draftId");
  const meta = await readStudioMeta(page, draftId);
  return { preview, downloaded, inspected, comparison, meta: { ...meta, draftId: draftId || meta.draftId } };
}

async function reopenAndRedownload(page, meta, prefix, canvas) {
  if (!meta.draftId) throw new Error(`${prefix} missing draft id for reopen`);
  await page.goto(`${BASE}/companion/studio?draftId=${encodeURIComponent(meta.draftId)}`, { waitUntil: "networkidle0" });
  await waitStudio(page, "", { requireArtwork: false });
  await page.waitForFunction(() => Boolean(document.querySelector("[data-download-saved-export]")), { timeout: 15000 });
  const downloadDir = path.join(FILES, `${prefix}-reopen`);
  fs.rmSync(downloadDir, { recursive: true, force: true });
  await prepareDownload(page, downloadDir);
  const clicked = await page.evaluate(() => {
    const button = document.querySelector("[data-download-saved-export]");
    button?.click();
    return Boolean(button);
  });
  if (!clicked) {
    throw new Error(`${prefix} reopen did not find the visible Download saved export control; API fallback is not UI-download evidence`);
  }
  const downloaded = await waitForDownload(downloadDir);
  return inspectArtwork(downloaded.bytes, canvas);
}

async function proveDraftSwitch(page, exportedDraftId, headlineA) {
  await clickNamed(page, "Aa · Text|Content");
  const before = await exportBinding(page);
  if (before.boundDraft !== exportedDraftId || !before.hasDownload) {
    throw new Error(`draft A is not bound to its export (${JSON.stringify(before)})`);
  }
  await clickNamed(page, "New draft");
  await page.waitForFunction((keep) => {
    const value = document.querySelector("#studio-draft")?.value;
    return Boolean(value) && value !== keep;
  }, { timeout: 15000 }, exportedDraftId);
  const draftB = await page.$eval("#studio-draft", (el) => el instanceof HTMLSelectElement ? el.value : "");
  await fillControlled(page, "#headline", "Unexported study");
  await assertHeadline(page, "Unexported study", "fresh draft before save");
  await clickNamed(page, "Save layers");
  await page.waitForFunction(() => /Saved/i.test(document.body.innerText), { timeout: 15000 });
  await assertHeadline(page, "Unexported study", "fresh draft after save");
  const onB = await exportBinding(page);
  if (onB.boundDraft || onB.hasDownload || onB.downloadDraft === exportedDraftId) {
    throw new Error(`unexported draft B showed draft A export state: ${JSON.stringify(onB)}`);
  }
  if (/Export saved \d/i.test(onB.body) && onB.boundDraft === exportedDraftId) {
    throw new Error("draft B displayed draft A export status");
  }
  await shot(page, 1440, "draft_b_unexported");
  await chooseDraft(page, exportedDraftId);
  await waitArtworkReady(page);
  await assertHeadline(page, headlineA, "back to exported draft A");
  const backA = await exportBinding(page);
  if (backA.boundDraft !== exportedDraftId || !backA.hasDownload) {
    throw new Error(`returning to A lost its export binding: ${JSON.stringify(backA)}`);
  }
  await shot(page, 1440, "draft_a_reselected");
  await chooseDraft(page, draftB);
  await waitArtworkReady(page);
  await assertHeadline(page, "Unexported study", "B after A→B→A→B");
  const againB = await exportBinding(page);
  if (againB.boundDraft || againB.hasDownload) {
    throw new Error(`B picked up A export after A→B→A: ${JSON.stringify(againB)}`);
  }
  await chooseDraft(page, exportedDraftId);
  await waitArtworkReady(page);
  return { draftB, onB, backA, againB };
}

async function proveFailedDownloadRetry(page, meta) {
  await page.evaluate((url) => {
    const original = window.fetch.bind(window);
    let failed = false;
    window.fetch = async (input, init) => {
      const href = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
      if (!failed && href.includes(url.split("?")[0] ?? url)) {
        failed = true;
        return new Response(JSON.stringify({ ok: false, error: "internal", message: "forced download fail" }), {
          status: 503,
          headers: { "content-type": "application/json" }
        });
      }
      return original(input, init);
    };
  }, meta.assetUrl);
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1, isMobile: false });
  const downloadButton = await page.waitForSelector("[data-download-saved-export]", { timeout: 8000 });
  if (!downloadButton) throw new Error("saved-export download control missing before forced failure");
  await downloadButton.click();
  await page.waitForFunction(() => document.querySelector("[data-export-stage]")?.getAttribute("data-export-stage") === "download_failed", {
    timeout: 15000
  });
  const failed = await exportBinding(page);
  if (failed.stage !== "download_failed" || !failed.hasDownload) {
    throw new Error(`expected download_failed stage with retry control, got ${JSON.stringify(failed)}`);
  }
  await page.screenshot({ path: path.join(OUT, "delivery_download_failed_1440w.png"), fullPage: true });
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: false });
  await page.screenshot({ path: path.join(OUT, "delivery_download_failed_390w.png"), fullPage: true });
  await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1, isMobile: false });
  const afterFail = await readStudioMeta(page, meta.draftId);
  if (afterFail.exportCount !== 1) {
    throw new Error(`failed download created ${afterFail.exportCount} exports`);
  }
  const downloadDir = path.join(FILES, "lumen-retry");
  fs.rmSync(downloadDir, { recursive: true, force: true });
  await prepareDownload(page, downloadDir);
  const retryButton = await page.waitForSelector("[data-download-saved-export]", { timeout: 8000 });
  if (!retryButton) throw new Error("Download again / saved-export control missing after failed download");
  await retryButton.click();
  const retried = await waitForDownload(downloadDir);
  const afterRetry = await readStudioMeta(page, meta.draftId);
  if (afterRetry.exportCount !== 1 || afterRetry.assetId !== meta.assetId) {
    throw new Error("retry created a duplicate export");
  }
  return { hash: hashBytes(retried.bytes), exportCount: afterRetry.exportCount, stage: (await exportBinding(page)).stage };
}

async function provePriorRevisionLabel(page, exportedDraftId) {
  await chooseDraft(page, exportedDraftId);
  await clickNamed(page, "Aa · Text|Content");
  await fillControlled(page, "#headline", "Glass reserved later");
  await assertHeadline(page, "Glass reserved later", "same-draft edit after export");
  await clickNamed(page, "Save layers");
  await page.waitForFunction(
    () =>
      document.querySelector("[data-export-prior-revision]")?.getAttribute("data-export-prior-revision") === "true" &&
      /earlier revision|Earlier export/i.test(document.body.innerText),
    { timeout: 15000 }
  );
  const binding = await exportBinding(page);
  if (binding.prior !== "true" || binding.boundDraft !== exportedDraftId) {
    throw new Error(`same-draft edit should keep the earlier export labeled as a prior revision: ${JSON.stringify(binding)}`);
  }
  if (!/earlier revision|Earlier export/i.test(binding.body)) {
    throw new Error("UI did not label the saved export as an earlier revision after later edits");
  }
  await shot(page, 1440, "prior_revision");
  return binding;
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
  layoutId: "direction_board",
  layoutLabel: "Direction board",
  canvas: { width: 1600, height: 1200, canvas: [244, 240, 230] }
});
const draftSwitch = await proveDraftSwitch(ownerPage, lumenExport.meta.draftId || lumenDraft, "Glass reserved");
const failedDownload = await proveFailedDownloadRetry(ownerPage, lumenExport.meta);
const priorRevision = await provePriorRevisionLabel(ownerPage, lumenExport.meta.draftId || lumenDraft);

await ownerPage.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
const expired = await ownerPage.evaluate(async (url) => {
  const res = await fetch(url, { credentials: "same-origin" });
  return { status: res.status, body: await res.json().catch(async () => ({ text: await res.text() })) };
}, lumenExport.meta.assetUrl);
assertIsolationContract(expired.status, expired.body, "unauthenticated");

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
if (failedDownload.hash !== lumenExport.inspected.hash) {
  throw new Error("retried download was not the original saved artifact");
}
await assertHeadline(reopen, "Glass reserved later", "after reopen/sign-in");
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
  layoutId: "square_announcement",
  layoutLabel: "Square social",
  canvas: { width: 1080, height: 1080, canvas: [26, 22, 18] }
});
const isolation = await otherPage.evaluate(async (url) => {
  const file = await fetch(url, { credentials: "same-origin" });
  return { exportStatus: file.status, body: await file.json().catch(async () => ({ text: (await file.text()).slice(0, 80) })) };
}, lumenExport.meta.assetUrl);
assertIsolationContract(isolation.exportStatus, isolation.body, "forbidden");
const missing = await otherPage.evaluate(async () => {
  const workspace = await fetch("/api/companion/workspace").then((res) => res.json());
  const file = await fetch(`/api/companion/assets/asset_missing_export?businessId=${encodeURIComponent(workspace.business.id)}`, {
    credentials: "same-origin"
  });
  return { status: file.status, body: await file.json().catch(async () => ({ text: await file.text() })) };
});
assertIsolationContract(missing.status, missing.body, "not_found");

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
await waitStudio(revise, "Glass reserved later", { requireArtwork: false });
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
  identity: "simulated local — not hosted Auth.js",
  rasterTolerance: RASTER_TOLERANCE,
  lumenDraft,
  hearthDraft,
  unexportedDraft: draftSwitch.draftB,
  revisionTwoDraft,
  lumen: { ...lumenExport.inspected, ...lumenExport.meta, comparison: lumenExport.comparison },
  hearth: { ...hearthExport.inspected, ...hearthExport.meta, comparison: hearthExport.comparison },
  draftSwitch: {
    bBoundDraft: draftSwitch.onB.boundDraft,
    aRebound: draftSwitch.backA.boundDraft,
    bAfterRoundTrip: draftSwitch.againB.boundDraft
  },
  failedDownload,
  priorRevision: { prior: priorRevision.prior, boundDraft: priorRevision.boundDraft },
  expired,
  isolation,
  missing,
  reopenHash: lumenAgain.hash
};
fs.writeFileSync(path.join(FILES, "artwork-delivery.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (lumenDraft === hearthDraft) throw new Error("both identities opened the same draft");
if (revisionTwoDraft === lumenDraft) throw new Error("revision two overwrote the first draft");
if (draftSwitch.draftB === lumenDraft) throw new Error("fresh draft reused draft A");
if (lumenExport.comparison.delta > RASTER_TOLERANCE || hearthExport.comparison.delta > RASTER_TOLERANCE) {
  throw new Error("preview/export comparison exceeded tolerance");
}
await browser.close();
