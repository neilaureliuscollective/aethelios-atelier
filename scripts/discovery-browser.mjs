#!/usr/bin/env node
/**
 * Discovery studio browser verification. Port 3010 in the isolated worktree.
 * Measures post-load interaction and actual preview layout, not HTTP fetch as a render result.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.DISCOVERY_BASE ?? "http://127.0.0.1:3010";
const OUT = process.env.DISCOVERY_OUT ?? "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars"]
});

async function shot(page, width, name, height = width === 390 ? 844 : 1100, fullPage = true) {
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 280));
  const file = path.join(OUT, `${name}-${width}w.png`);
  await page.screenshot({ path: file, fullPage });
  console.log("wrote", file);
}

async function waitReady(page) {
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
  await page.waitForSelector("text/Explore your direction");
}

async function continueBtn(page, label) {
  const buttons = await page.$$("button");
  for (const button of buttons) {
    const text = await page.evaluate((el) => el.textContent?.trim(), button);
    if (text === label) {
      const visible = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
      }, button);
      if (!visible) continue;
      await button.click();
      return true;
    }
  }
  return false;
}

const page = await browser.newPage();
const requests = [];
page.on("request", (req) => {
  if (["xhr", "fetch"].includes(req.resourceType())) requests.push(req.url());
});

await waitReady(page);
check("discover renders without account", await page.$eval("h1", (el) => el.textContent.includes("could become")));

for (const width of [390, 884, 1440]) {
  await shot(page, width, "discover_entrance");
}

await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await waitReady(page);
await shot(page, 1440, "discover_reduced_motion");
await page.emulateMediaFeatures([]);

const t0 = Date.now();
check("explore", await continueBtn(page, "Explore your direction"));
await page.waitForSelector("input[type='text']");
const exploreMs = Date.now() - t0;
check(
  "explore opened intake without hanging",
  exploreMs < 5000,
  `informational ${exploreMs}ms after click; not a Web Vital or LCP claim`
);

const focusedAfterExplore = await page.evaluate(() => document.activeElement?.textContent ?? "");
check("stage heading focused after explore", /name of the business/i.test(focusedAfterExplore));

await page.click("input[type='text']");
await page.keyboard.type("Meridian Sitting Room");
check("continue from name", await continueBtn(page, "Continue"));
await page.waitForSelector("input[type='radio']");
const focusedAfterType = await page.evaluate(() => document.activeElement?.textContent ?? "");
check("stage heading focused after continue", /kind of business/i.test(focusedAfterType));

await page.click("input[value='appointment']");
check("continue from type", await continueBtn(page, "Continue"));
await page.click("input[value='easier_booking']");
await page.click("textarea");
await page.keyboard.type("People should book without calling the desk.");
check("continue from intent", await continueBtn(page, "Continue"));
await page.click("input[value='calm']");
check("continue from feeling", await continueBtn(page, "Choose qualities"));
await page.waitForSelector("button[aria-pressed]");
const quality = await page.$("button[aria-pressed]");
await quality?.click();
const quality2 = (await page.$$("button[aria-pressed]"))[1];
await quality2?.click();
await shot(page, 1440, "discover_qualities");
await shot(page, 390, "discover_qualities");
check("open studio", await continueBtn(page, "Open the studio"));
await page.waitForSelector("article");
const personalized = await page.evaluate(() => document.body.innerText);
check("personalized business name in preview", personalized.includes("Meridian Sitting Room"));
check("no diagnostic Aethelios available toggle", !personalized.includes("Aethelios is available"));

await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await shot(page, 1440, "discover_personalized", 1100, false);
await shot(page, 884, "discover_personalized", 1100, false);
await shot(page, 390, "discover_personalized", 844, false);
await shot(page, 390, "discover_mobile_controls", 844, false);

await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await page.click("input[name='direction-studio'][value='signal']");
await new Promise((r) => setTimeout(r, 200));
await shot(page, 1440, "discover_preview_signal", 1100, false);
await page.click("input[name='direction-studio'][value='lumen']");
await new Promise((r) => setTimeout(r, 200));

const arrow = await page.evaluate(() => {
  const lumen = document.querySelector("input[name='direction-studio'][value='lumen']");
  lumen?.focus();
  lumen?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  lumen?.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
  return document.querySelector("input[name='direction-studio'][value='hearth']")?.checked ?? false;
});
if (!arrow) {
  await page.focus("input[name='direction-studio'][value='lumen']");
  await page.keyboard.press("ArrowRight");
}
const hearthChecked = await page.$eval(
  "input[name='direction-studio'][value='hearth']",
  (el) => el.checked
);
check("native radio arrow key moves selection", hearthChecked);
await page.click("input[name='direction-studio'][value='lumen']");

await page.click("input[name='preview-studio'][value='mobile']");
await new Promise((r) => setTimeout(r, 350));
const phoneInDesktop = await page.evaluate(() => {
  const device = document.querySelector('[data-mode="mobile"] [data-preview-device]');
  const heading = device?.querySelector("h2");
  if (!device || !heading) return null;
  const deviceBox = device.getBoundingClientRect();
  const headingBox = heading.getBoundingClientRect();
  const style = getComputedStyle(heading);
  return {
    viewport: window.innerWidth,
    deviceWidth: Math.round(deviceBox.width),
    headingFont: parseFloat(style.fontSize),
    headingOverflow: heading.scrollWidth - heading.clientWidth,
    headingClipped: headingBox.right > deviceBox.right + 2
  };
});
check(
  "390px phone preview inside 1440px browser",
  Boolean(
    phoneInDesktop &&
      phoneInDesktop.viewport === 1440 &&
      phoneInDesktop.deviceWidth <= 400 &&
      phoneInDesktop.deviceWidth >= 300
  ),
  JSON.stringify(phoneInDesktop)
);
check(
  "phone heading is container-sized, not viewport desktop scale",
  Boolean(phoneInDesktop && phoneInDesktop.headingFont > 20 && phoneInDesktop.headingFont < 64),
  JSON.stringify(phoneInDesktop)
);
check(
  "phone heading is not clipped or overflowing its preview",
  Boolean(phoneInDesktop && phoneInDesktop.headingOverflow <= 2 && !phoneInDesktop.headingClipped),
  JSON.stringify(phoneInDesktop)
);
await shot(page, 1440, "discover_phone_in_desktop", 1100, false);
await page.click("input[name='preview-studio'][value='desktop']");

check("compare two", await continueBtn(page, "Compare two"));
await page.waitForFunction(() => document.body.innerText.includes("Choose with feeling"));
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await shot(page, 1440, "discover_compare_desktop", 1100, false);
await shot(page, 884, "discover_compare", 1100, false);
await shot(page, 390, "discover_compare", 844, false);

await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
const uniqueIds = await page.evaluate(() => {
  const ids = [...document.querySelectorAll("[id^='preview-']")].map((el) => el.id);
  const dupes = ids.filter((id, index) => ids.indexOf(id) !== index);
  return { ids, dupes };
});
check("unique preview section ids across simultaneous previews", uniqueIds.dupes.length === 0, uniqueIds.dupes.join(", "));

const navClicked = await page.evaluate(() => {
  const devices = [...document.querySelectorAll("[data-preview-device]")];
  if (devices.length < 2) return { ok: false, reason: `only ${devices.length} devices` };
  const left = devices[0];
  const right = devices[1];
  const continueNav = [...left.querySelectorAll("nav button")].find((button) =>
    /continue|time|reserve/i.test(button.textContent ?? "")
  );
  continueNav?.click();
  return {
    ok: Boolean(continueNav),
    leftId: left.getAttribute("data-preview-device"),
    rightId: right.getAttribute("data-preview-device"),
    label: continueNav?.textContent ?? ""
  };
});
await new Promise((r) => setTimeout(r, 500));
const navIsolation = await page.evaluate((meta) => {
  const left = document.querySelector(`[data-preview-device="${meta.leftId}"]`);
  const right = document.querySelector(`[data-preview-device="${meta.rightId}"]`);
  if (!left || !right) return { ok: false, reason: "missing devices" };
  const leftAction = document.getElementById(`${meta.leftId}-action`);
  const rightAction = document.getElementById(`${meta.rightId}-action`);
  const leftBox = left.getBoundingClientRect();
  const leftActionBox = leftAction?.getBoundingClientRect();
  const rightBox = right.getBoundingClientRect();
  const rightActionBox = rightAction?.getBoundingClientRect();
  const leftVisible =
    Boolean(leftActionBox) && leftActionBox.top < leftBox.bottom && leftActionBox.bottom > leftBox.top;
  const rightUnscrolled = right.scrollTop < 8;
  return {
    ok: left.scrollTop > 24 && rightUnscrolled && leftVisible,
    left: left.scrollTop,
    right: right.scrollTop,
    leftVisible,
    rightActionInView:
      Boolean(rightActionBox) && rightActionBox.top < rightBox.bottom && rightActionBox.bottom > rightBox.top,
    leftId: meta.leftId,
    rightId: meta.rightId
  };
}, navClicked);
check("comparison navigation stays inside originating preview", Boolean(navIsolation.ok), JSON.stringify({ navClicked, navIsolation }));

const demoIsolation = await page.evaluate(() => {
  const hearth = document.querySelector('[data-preview-root*="hearth"] button[class*="cta"], [data-direction="hearth"] button');
  const buttons = [...document.querySelectorAll("[data-direction='hearth'] button")];
  const cta = buttons.find((button) => /save a time/i.test(button.textContent ?? ""));
  cta?.click();
  return Boolean(cta);
});
check("opened hearth demo from hearth preview", demoIsolation);
await page.waitForFunction(() => document.querySelector("dialog[open]"));
const dialogCopy = await page.evaluate(() => {
  const dialog = document.querySelector("dialog[open]");
  return {
    direction: dialog?.getAttribute("data-demo-direction"),
    text: dialog?.innerText ?? ""
  };
});
check(
  "demo dialog identifies the clicked Hearth direction",
  dialogCopy.direction === "hearth" && /hearth/i.test(dialogCopy.text) && /meridian sitting room/i.test(dialogCopy.text),
  JSON.stringify({ direction: dialogCopy.direction, snippet: dialogCopy.text.slice(0, 180) })
);
await continueBtn(page, "Close");

const backStudio = await continueBtn(page, "Back to studio");
check("back to studio", backStudio);
await page.waitForSelector("textarea");
const nameValue = await page.$eval("input[type='text']", (el) => el.value);
check("back navigation preserves name", nameValue.includes("Meridian Sitting Room"));

await page.evaluate(() => {
  const area = [...document.querySelectorAll("textarea")].find((el) =>
    el.closest("label")?.textContent?.includes("What you like")
  );
  if (area) {
    const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
    proto?.set?.call(area, "The quiet opening.");
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
check("use this direction", await continueBtn(page, "Use this direction"));
await page.waitForFunction(() => /prepared on this device/i.test(document.body.innerText));
const reviewText = await page.evaluate(() => document.body.innerText);
check("does not claim sent", !/Sent to Neil/.test(reviewText));
check("does not claim added to account", !/Added to your account/i.test(reviewText));
check("does not use developer worker language", !/other worker/i.test(reviewText));
check("review includes written intent", reviewText.includes("People should book without calling the desk."));
check("review does not promise empty-brief preservation", !/would be overwritten by this mapping/i.test(reviewText));
await shot(page, 1440, "discover_recap");
await shot(page, 884, "discover_recap");
await shot(page, 390, "discover_recap");
await shot(page, 1440, "discover_review");
await shot(page, 884, "discover_review");
await shot(page, 390, "discover_review");

await continueBtn(page, "Back to studio");
await page.waitForSelector("input[type='text']");
await page.evaluate(() => {
  const input = document.querySelector("input[type='text']");
  if (!input) return;
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(input, "Later edit must not mutate snapshot");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await continueBtn(page, "Review");
await page.waitForFunction(() => /unpublished/i.test(document.body.innerText));
const reviewAfter = await page.evaluate(() => document.body.innerText);
check("confirmed snapshot still has original name", reviewAfter.includes("Meridian Sitting Room"));
check("unpublished notice after later edit", /unpublished/i.test(reviewAfter));
check("confirmed recap still has written intent", reviewAfter.includes("People should book without calling the desk."));

await continueBtn(page, "Save on this device");
await page.evaluate(() => {
  window.__originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
  window.localStorage.removeItem = () => {
    throw new Error("blocked");
  };
});
check("remove saved sketch", await continueBtn(page, "Remove saved sketch"));
await page.waitForFunction(() => /could not remove|still on this device/i.test(document.body.innerText));
const clearFailure = await page.evaluate(() => document.body.innerText);
check(
  "storage-clear failure is not announced as success",
  /still on this device|could not remove/i.test(clearFailure) && !/saved sketch removed from this device/i.test(clearFailure)
);
await page.evaluate(() => {
  if (window.__originalRemoveItem) window.localStorage.removeItem = window.__originalRemoveItem;
  window.localStorage.removeItem("aethelios.atelier.discovery.v1");
});

await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await continueBtn(page, "Start over on this screen").catch(() => false);
const explored = await continueBtn(page, "Explore your direction");
if (!explored) {
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
  await continueBtn(page, "Explore your direction");
}
await page.waitForSelector("input[type='text']");
await page.type("input[type='text']", "<img src=x onerror=alert(1)> 名".repeat(8));
const escaped = await page.$eval("input[type='text']", (el) => el.value);
check("hostile text accepted as value not executed", escaped.includes("<img") && escaped.length <= 80);

const projectMutations = requests.filter(
  (url) =>
    url.includes("/api/projects") ||
    url.includes("/submit") ||
    url.includes("/api/session/sign-in") ||
    url.includes("/api/session/sign-out")
);
check(
  "discovery made no project mutation or auth write calls before the proof sign-in",
  projectMutations.length === 0,
  projectMutations.join(", ")
);

await page.evaluate(async () => {
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner.local@atelier.invalid" })
  });
});
const before = await page.evaluate(async () => {
  const res = await fetch("/api/projects");
  return res.json();
});
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await continueBtn(page, "Explore your direction");
const after = await page.evaluate(async () => {
  const res = await fetch("/api/projects");
  return res.json();
});
check(
  "signed-in project list unchanged by visiting discovery",
  JSON.stringify(before.projects ?? before) === JSON.stringify(after.projects ?? after)
);

const failed = results.filter((item) => !item.ok);
console.log(JSON.stringify({ failed: failed.length, results }, null, 2));
await browser.close();
if (failed.length) process.exit(1);
