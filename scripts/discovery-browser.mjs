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
await shot(page, 1440, "discover_phone_lumen_in_desktop", 1100, false);

async function phoneLayout(direction) {
  await page.click(`input[name="direction-studio"][value="${direction}"]`);
  await page.click("input[name='preview-studio'][value='mobile']");
  await new Promise((r) => setTimeout(r, 320));
  return page.evaluate((directionId) => {
    const device = document.querySelector('[data-mode="mobile"] [data-preview-device]');
    const article = device?.querySelector(`[data-direction="${directionId}"]`);
    if (!device || !article) return { ok: false, reason: "missing preview" };
    const deviceBox = device.getBoundingClientRect();
    const articleBox = article.getBoundingClientRect();
    const heading = article.querySelector("h2");
    const cols = getComputedStyle(article).gridTemplateColumns.trim();
    const colCount = cols === "none" || cols === "auto" ? 1 : cols.split(/\s+(?![^()]*\))/).filter(Boolean).length;
    const overflowX = Math.round(article.scrollWidth - device.clientWidth);
    const stacked =
      directionId === "signal"
        ? (() => {
            const main = article.querySelector("div");
            const rail = article.querySelector("aside");
            if (!main || !rail) return false;
            return rail.getBoundingClientRect().top >= main.getBoundingClientRect().bottom - 12;
          })()
        : directionId === "hearth"
          ? (() => {
              const story = article.querySelector("section");
              const welcome = article.querySelector("aside");
              if (!story || !welcome) return false;
              return welcome.getBoundingClientRect().top >= story.getBoundingClientRect().bottom - 24;
            })()
          : getComputedStyle(article.querySelector("header")).flexDirection === "column";
    return {
      ok:
        window.innerWidth === 1440 &&
        deviceBox.width <= 400 &&
        articleBox.width <= deviceBox.width + 1 &&
        overflowX <= 2 &&
        parseFloat(getComputedStyle(heading).fontSize) < 64 &&
        (directionId === "signal" ? colCount === 1 && stacked : stacked),
      viewport: window.innerWidth,
      deviceWidth: Math.round(deviceBox.width),
      articleWidth: Math.round(articleBox.width),
      colCount,
      overflowX,
      headingFont: heading ? parseFloat(getComputedStyle(heading).fontSize) : 0,
      stacked
    };
  }, direction);
}

for (const direction of ["lumen", "hearth", "signal"]) {
  const layout = await phoneLayout(direction);
  check(`${direction} phone layout inside 1440px browser`, Boolean(layout.ok), JSON.stringify(layout));
  await shot(page, 1440, `discover_phone_${direction}_in_desktop`, 1100, false);
}
await page.click("input[name='direction-studio'][value='lumen']");
await page.click("input[name='preview-studio'][value='desktop']");

async function conceptViewport(direction, width) {
  await page.setViewport({ width, height: width === 390 ? 844 : 1100, deviceScaleFactor: 1 });
  await page.click(`input[name="direction-studio"][value="${direction}"]`);
  await page.click("input[name='preview-studio'][value='desktop']");
  await new Promise((r) => setTimeout(r, 280));
  return page.evaluate((directionId) => {
    const article = document.querySelector(`[data-direction="${directionId}"]`);
    if (!article) return { ok: false, reason: "missing concept" };
    const box = article.getBoundingClientRect();
    const cols = getComputedStyle(article).gridTemplateColumns.trim();
    const colCount = cols === "none" || cols === "auto" ? 1 : cols.split(/\s+(?![^()]*\))/).filter(Boolean).length;
    const nav = article.querySelector("nav");
    const navBox = nav?.getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      width: Math.round(box.width),
      overflowX: Math.round(
        Math.max(
          article.scrollWidth - article.clientWidth,
          document.documentElement.scrollWidth - document.documentElement.clientWidth
        )
      ),
      colCount,
      navVisible: Boolean(navBox && navBox.width > 40 && navBox.height >= 24),
      headingVisible: Boolean(article.querySelector("h2")?.getBoundingClientRect().height)
    };
  }, direction);
}

for (const width of [390, 884, 1440]) {
  for (const direction of ["lumen", "hearth", "signal"]) {
    const layout = await conceptViewport(direction, width);
    const stackedWhenNarrow = width === 390 && direction === "signal" ? layout.colCount === 1 : true;
    const desktopSignalWide = width === 1440 && direction === "signal" ? layout.colCount >= 2 : true;
    check(
      `${direction} usable layout at ${width}px viewport`,
      Boolean(
        layout.viewport === width &&
          layout.overflowX <= 2 &&
          layout.width > 280 &&
          layout.navVisible &&
          layout.headingVisible &&
          stackedWhenNarrow &&
          desktopSignalWide
      ),
      JSON.stringify(layout)
    );
  }
}

await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
await page.click("input[name='direction-studio'][value='signal']");
await page.click("input[name='preview-studio'][value='desktop']");
await new Promise((r) => setTimeout(r, 250));
const signalDesktop = await page.evaluate(() => {
  const article = document.querySelector('[data-direction="signal"]');
  const cols = article ? getComputedStyle(article).gridTemplateColumns.trim() : "";
  const colCount = cols === "none" || cols === "auto" ? 1 : cols.split(/\s+(?![^()]*\))/).filter(Boolean).length;
  return { colCount, width: article ? Math.round(article.getBoundingClientRect().width) : 0 };
});
check(
  "Signal desktop layout stays multi-column inside a 1440px browser",
  signalDesktop.colCount >= 2 && signalDesktop.width > 700,
  JSON.stringify(signalDesktop)
);
await page.click("input[name='direction-studio'][value='lumen']");

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

const compareLayout = await page.evaluate(() => {
  const panels = [...document.querySelectorAll("[data-compare-direction]")];
  return panels.map((panel) => {
    const box = panel.getBoundingClientRect();
    const article = panel.querySelector("[data-direction]");
    const cols = article ? getComputedStyle(article).gridTemplateColumns.trim() : "";
    const colCount = !cols || cols === "none" || cols === "auto" ? 1 : cols.split(/\s+(?![^()]*\))/).filter(Boolean).length;
    return {
      id: panel.getAttribute("data-compare-direction"),
      width: Math.round(box.width),
      height: Math.round(box.height),
      overflowX: article ? Math.round(article.scrollWidth - panel.clientWidth) : 99,
      colCount,
      active: panel.getAttribute("data-active")
    };
  });
});
check(
  "comparison panels have independent usable widths at 1440",
  compareLayout.length === 2 &&
    compareLayout.every((panel) => panel.width > 280 && panel.height > 240 && panel.overflowX <= 2) &&
    Math.abs((compareLayout[0]?.width ?? 0) - (compareLayout[1]?.width ?? 0)) < 80,
  JSON.stringify(compareLayout)
);
check(
  "selected comparison panel is marked active",
  compareLayout.some((panel) => panel.id === "lumen" && panel.active === "true") &&
    compareLayout.some((panel) => panel.id === "hearth" && panel.active === "false"),
  JSON.stringify(compareLayout.map((panel) => ({ id: panel.id, active: panel.active })))
);

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

const rightNavClicked = await page.evaluate((meta) => {
  const right = document.querySelector(`[data-preview-device="${meta.rightId}"]`);
  if (!right) return { ok: false, reason: "missing right device" };
  const leftScroll = document.querySelector(`[data-preview-device="${meta.leftId}"]`)?.scrollTop ?? 0;
  const actionNav = [...right.querySelectorAll("nav button")].find((button) =>
    /time|continue|reserve/i.test(button.textContent ?? "")
  );
  actionNav?.click();
  return { ok: Boolean(actionNav), leftScrollBefore: leftScroll, label: actionNav?.textContent ?? "" };
}, navClicked);
await new Promise((r) => setTimeout(r, 500));
const bothNav = await page.evaluate((payload) => {
  const left = document.querySelector(`[data-preview-device="${payload.meta.leftId}"]`);
  const right = document.querySelector(`[data-preview-device="${payload.meta.rightId}"]`);
  if (!left || !right) return { ok: false, reason: "missing devices" };
  return {
    ok: right.scrollTop > 24 && Math.abs(left.scrollTop - payload.rightNav.leftScrollBefore) < 8,
    left: left.scrollTop,
    right: right.scrollTop,
    leftUnchanged: Math.abs(left.scrollTop - payload.rightNav.leftScrollBefore) < 8
  };
}, { meta: navClicked, rightNav: rightNavClicked });
check(
  "both comparison panels remain independently navigable",
  Boolean(rightNavClicked.ok && bothNav.ok),
  JSON.stringify({ rightNavClicked, bothNav })
);

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

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const more = await page.$("summary::-p-text(Edit name, palette, and notes)").catch(() => null);
if (more) await more.click();
else {
  const summaries = await page.$$("summary");
  for (const summary of summaries) {
    const text = await page.evaluate((el) => el.textContent, summary);
    if (text?.includes("Edit name")) {
      await summary.click();
      break;
    }
  }
}
await shot(page, 390, "discover_compare_mobile_controls_open", 844, false);
const primaryVisible = await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.trim() === "Use this direction");
  if (!button) return { ok: false };
  const box = button.getBoundingClientRect();
  return {
    ok: box.height >= 44 && box.top >= 0 && box.bottom <= window.innerHeight + 1,
    top: box.top,
    bottom: box.bottom,
    height: box.height
  };
});
check("expanded mobile controls do not hide Use this direction", Boolean(primaryVisible.ok), JSON.stringify(primaryVisible));

await page.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
const lumenStillActive = await page.$eval(
  "input[name='direction-studio'][value='lumen']",
  (el) => el.checked
);
check("lumen remains the active studio direction before confirming hearth", lumenStillActive);
check("use hearth from comparison", await continueBtn(page, "Use Hearth"));
await page.waitForFunction(() => document.querySelector('[data-confirmed-direction="hearth"]'));
const hearthConfirm = await page.evaluate(() => ({
  confirmed: document.querySelector("[data-confirmed-direction]")?.getAttribute("data-confirmed-direction"),
  name: document.querySelector("[data-confirmed-name]")?.getAttribute("data-confirmed-name"),
  text: document.body.innerText
}));
check(
  "non-active comparison direction confirms Hearth",
  hearthConfirm.confirmed === "hearth" && hearthConfirm.name === "Meridian Sitting Room" && /hearth/i.test(hearthConfirm.text),
  JSON.stringify({ confirmed: hearthConfirm.confirmed, name: hearthConfirm.name })
);
check("does not claim sent", !/Sent to Neil/.test(hearthConfirm.text));
check("does not claim added to account", !/Added to your account/i.test(hearthConfirm.text));
check("does not use developer worker language", !/other worker/i.test(hearthConfirm.text));
check("review includes written intent", hearthConfirm.text.includes("People should book without calling the desk."));
check("review does not promise empty-brief preservation", !/would be overwritten by this mapping/i.test(hearthConfirm.text));
await shot(page, 1440, "discover_recap");
await shot(page, 884, "discover_recap");
await shot(page, 390, "discover_recap");
await shot(page, 1440, "discover_review");
await shot(page, 884, "discover_review");
await shot(page, 390, "discover_review");

await continueBtn(page, "Back to studio");
await page.waitForSelector("input[type='text']");
await page.evaluate(() => {
  const input = [...document.querySelectorAll("input[type='text']")].find((el) =>
    el.closest("label")?.textContent?.includes("Business name")
  );
  if (!input) return;
  const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  proto?.set?.call(input, "Willow Atelier");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await continueBtn(page, "Review");
await page.waitForFunction(() => /unpublished/i.test(document.body.innerText));
const reviewAfter = await page.evaluate(() => document.body.innerText);
check("confirmed snapshot still has original name", reviewAfter.includes("Meridian Sitting Room"));
check("unpublished notice after later edit", /unpublished/i.test(reviewAfter));
check("confirmed recap still has written intent", reviewAfter.includes("People should book without calling the desk."));
const confirmedName = await page.$eval("[data-confirmed-name]", (el) => el.getAttribute("data-confirmed-name"));
check("working name is not mixed into confirmed recap identity", confirmedName === "Meridian Sitting Room");
await shot(page, 1440, "discover_unpublished_recap", 1100, false);

const recapCta = await page.evaluate(() => {
  const root = document.querySelector('[data-preview-source="confirmed"] [data-direction="hearth"]');
  const cta = [...(root?.querySelectorAll("button") ?? [])].find((button) => /save a time/i.test(button.textContent ?? ""));
  cta?.click();
  return Boolean(cta);
});
check("opened confirmed recap demonstration", recapCta);
await page.waitForFunction(() => document.querySelector("dialog[open]"));
const confirmedDialog = await page.evaluate(() => {
  const dialog = document.querySelector("dialog[open]");
  return {
    source: dialog?.getAttribute("data-demo-source"),
    name: dialog?.getAttribute("data-demo-name"),
    direction: dialog?.getAttribute("data-demo-direction"),
    text: dialog?.innerText ?? ""
  };
});
check(
  "confirmed recap dialog stays on original snapshot",
  confirmedDialog.source === "confirmed" &&
    confirmedDialog.direction === "hearth" &&
    confirmedDialog.name === "Meridian Sitting Room" &&
    /meridian sitting room/i.test(confirmedDialog.text) &&
    !/willow atelier/i.test(confirmedDialog.text),
  JSON.stringify(confirmedDialog)
);
await continueBtn(page, "Close");

await continueBtn(page, "Back to studio");
await page.waitForSelector("[data-preview-source='exploration']");
const liveCta = await page.evaluate(() => {
  const root = document.querySelector('[data-preview-source="exploration"]');
  const cta = [...(root?.querySelectorAll("button") ?? [])].find((button) =>
    /save a time|request a sitting|reserve/i.test(button.textContent ?? "")
  );
  cta?.click();
  return Boolean(cta);
});
check("opened live exploration demonstration", liveCta);
await page.waitForFunction(() => document.querySelector("dialog[open]"));
const liveDialog = await page.evaluate(() => {
  const dialog = document.querySelector("dialog[open]");
  return {
    source: dialog?.getAttribute("data-demo-source"),
    name: dialog?.getAttribute("data-demo-name"),
    direction: dialog?.getAttribute("data-demo-direction")
  };
});
check(
  "live exploration dialog uses the unpublished working name",
  liveDialog.source === "exploration" && liveDialog.name === "Willow Atelier",
  JSON.stringify(liveDialog)
);
await continueBtn(page, "Close");

for (const direction of ["lumen", "hearth", "signal"]) {
  await page.click(`input[name="direction-studio"][value="${direction}"]`);
  check(`confirm ${direction}`, await continueBtn(page, "Use this direction"));
  await page.waitForFunction(
    (id) => document.querySelector(`[data-confirmed-direction="${id}"]`),
    {},
    direction
  );
  const recap = await page.evaluate((id) => ({
    confirmed: document.querySelector("[data-confirmed-direction]")?.getAttribute("data-confirmed-direction"),
    name: document.querySelector("[data-confirmed-name]")?.getAttribute("data-confirmed-name"),
    revision: document.querySelector("[data-confirmed-revision]")?.getAttribute("data-confirmed-revision"),
    summaryHasDirection: document.body.innerText.toLowerCase().includes(id)
  }), direction);
  check(
    `${direction} recap, summary, and confirmed id match`,
    recap.confirmed === direction && recap.name === "Willow Atelier" && recap.summaryHasDirection,
    JSON.stringify(recap)
  );
  await continueBtn(page, "Back to studio");
  await page.waitForSelector("input[name='direction-studio']");
}

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

await page.evaluate(() => {
  const envelope = {
    version: 2,
    kind: "discovery_session",
    savedAt: new Date().toISOString(),
    draft: {
      catalogVersion: 1,
      templateVersion: 1,
      businessName: "Restored Sitting Room",
      businessType: "appointment",
      intent: "easier_booking",
      intentNote: "Keep this note.",
      audience: "",
      customerFeeling: "calm",
      qualities: ["refined"],
      headline: "",
      paletteId: "ivory_hall",
      visualDirectionId: "glass",
      activeDirectionId: "lumen",
      serviceInterest: "unspecified",
      likesNote: "",
      changeNote: "",
      exclusions: "",
      favorites: [],
      compareIds: ["lumen", "hearth"]
    },
    confirmed: null,
    phase: "intake",
    intakeStep: 4
  };
  window.localStorage.setItem("aethelios.atelier.discovery.v1", JSON.stringify(envelope));
});
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await page.waitForFunction(() => /name of the business/i.test(document.body.innerText));
const restored = await page.evaluate(() => ({
  heading: document.querySelector("[data-discovery-heading]")?.textContent ?? "",
  name: document.querySelector("input[type='text']")?.value ?? "",
  body: document.body.innerText
}));
check(
  "invalid intake step restores to a usable question without losing answers",
  /name of the business/i.test(restored.heading) &&
    restored.name === "Restored Sitting Room" &&
    /question number was not valid/i.test(restored.body) &&
    restored.body.trim().length > 40,
  JSON.stringify({ heading: restored.heading, name: restored.name })
);

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
