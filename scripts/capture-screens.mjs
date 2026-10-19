import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = "http://127.0.0.1:3000";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width === 390 ? 844 : 1100) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 350));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("wrote", file);
}

async function signIn(page, email) {
  await page.evaluate(async (emailArg) => {
    await fetch("/api/session/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: emailArg })
    });
  }, email);
  await page.reload({ waitUntil: "networkidle0" });
}

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);

for (const width of [320, 390, 884, 1440]) {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await shot(page, width, "home");
}

await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 1 });
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
await page.screenshot({ path: path.join(OUT, "home-landscape-844x390.png"), fullPage: true });
console.log("wrote", path.join(OUT, "home-landscape-844x390.png"));

for (const width of [390, 884, 1440]) {
  await page.goto(`${BASE}/project`, { waitUntil: "networkidle0" });
  await page.evaluate(() => {
    const area = document.querySelector("textarea");
    if (area) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      proto?.set?.call(area, "A premium website that reflects my business and connects clients to my existing booking platform.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    }
    const chips = [...document.querySelectorAll("button.chip")];
    chips.find((el) => el.textContent?.includes("Booking-connected"))?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await shot(page, width, "guided_brief");
}

await page.goto(`${BASE}/project`, { waitUntil: "networkidle0" });
await page.setViewport({ width: 390, height: 844 });
await page.evaluate(() => {
  [...document.querySelectorAll("button.chip")].find((el) => el.textContent?.includes("Summary"))?.click();
});
await shot(page, 390, "guided_brief_summary");

await page.goto(`${BASE}/offline`, { waitUntil: "networkidle0" });
await shot(page, 390, "offline_shell");
await shot(page, 1440, "offline_shell");

await page.goto(`${BASE}/services`, { waitUntil: "networkidle0" });
await shot(page, 1440, "services");
await shot(page, 390, "services");

await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(page, "owner.local@atelier.invalid");
const list = await page.evaluate(async () => {
  const res = await fetch("/api/projects");
  return res.json();
});
const projectId = list.projects?.find((p) => p.status !== "draft")?.id ?? list.projects?.[0]?.id;
if (projectId) {
  for (const width of [390, 884, 1440]) {
    await page.goto(`${BASE}/workspace/${projectId}`, { waitUntil: "networkidle0" });
    await shot(page, width, "client_workspace");
  }
  await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
  await shot(page, 1440, "guided_brief_owned");
  const session = await page.evaluate(async () => {
    const res = await fetch("/api/session");
    return res.json();
  });
  const view = await page.evaluate(async (id) => {
    const res = await fetch(`/api/projects/${id}`);
    return res.json();
  }, projectId);
  await page.evaluate((ownerId, id, serverBrief) => {
    const local = structuredClone(serverBrief);
    local.vision.value = "Recovered device wording that has not been acknowledged yet.";
    local.vision.provenance = "client_statement";
    sessionStorage.setItem(
      `atelier.account.${ownerId}.draft.${id}`,
      JSON.stringify({
        localBrief: local,
        acknowledgedBrief: serverBrief,
        acknowledgedVersion: 1,
        unconfirmed: true,
        updatedAt: new Date().toISOString()
      })
    );
  }, session.user.id, projectId, view.project.brief);
  await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
  for (const width of [390, 884, 1440]) {
    await shot(page, width, "recovered_draft_compare");
  }
  await page.evaluate(() => {
    const area = document.querySelector("textarea");
    if (!area) return;
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(area, "Typed while comparison is still unresolved.");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 300));
  for (const width of [390, 884, 1440]) {
    await shot(page, width, "comparison_typing");
  }
  await page.goto(`${BASE}/workspace/${projectId}`, { waitUntil: "networkidle0" });
  for (const width of [390, 884, 1440]) {
    await shot(page, width, "confirmed_receipt");
  }

  const rejectProject = await page.evaluate(async () => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    return res.json();
  });
  const rejectId = rejectProject.project?.id;
  if (rejectId) {
    await page.goto(`${BASE}/project/${rejectId}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("textarea");
    await page.evaluate(() => {
      const area = document.querySelector("textarea");
      const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
      proto?.set?.call(area, "Reviewed wording that will be rejected as stale.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await new Promise((r) => setTimeout(r, 900));
    await page.evaluate(() => {
      [...document.querySelectorAll(".step-nav button")].find((el) => (el.textContent ?? "").includes("Review"))?.click();
    });
    await page.waitForSelector("input[type=checkbox]", { timeout: 8000 });
    await page.click("input[type=checkbox]");
    await page.evaluate(async (id) => {
      const current = await (await fetch(`/api/projects/${id}`)).json();
      const brief = current.project.brief;
      brief.constraints.value = "Server advanced this revision before send.";
      brief.constraints.provenance = "client_statement";
      await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief, expectedVersion: current.project.version })
      });
    }, rejectId);
    await page.evaluate(() => {
      [...document.querySelectorAll("button")].find((el) => /Send to Neil|Send this newly reviewed/.test(el.textContent ?? ""))?.click();
    });
    await new Promise((r) => setTimeout(r, 1200));
    for (const width of [390, 884, 1440]) {
      await shot(page, width, "stale_submit_rejected");
    }
  }
}

await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await signIn(page, "neil.local@atelier.invalid");
const queue = await page.evaluate(async () => {
  const res = await fetch("/api/founder/queue");
  return res.json();
});
const founderId = queue.queue?.[0]?.id ?? projectId;
await page.goto(`${BASE}/founder`, { waitUntil: "networkidle0" });
await shot(page, 1440, "founder_queue");
await shot(page, 390, "founder_queue");
if (founderId) {
  await page.goto(`${BASE}/founder/${founderId}`, { waitUntil: "networkidle0" });
  await shot(page, 1440, "founder_review");
  await shot(page, 390, "founder_review");
}

await browser.close();
