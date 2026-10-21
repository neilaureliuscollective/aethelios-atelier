#!/usr/bin/env node
/**
 * Browser regressions for the mobile disclosure navigation.
 * Measures computed colors (not the accessibility tree alone) so
 * dark-text-on-dark-panel cannot pass.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { contrastRatio, parseColor } from "./lib/css-contrast.mjs";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const OUT = process.env.ATELIER_OUT ?? "docs/review/mobile-nav";
const results = [];

function check(name, ok, extra = "") {
  results.push({ name, ok, extra: extra ? String(extra).slice(0, 360) : "" });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

async function openMenu(page) {
  await page.click(".menu-toggle");
  await page.waitForSelector("#site-mobile-nav.mobile-nav.open", { timeout: 4000 });
}

async function measureNav(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".app-root");
    const nav = document.querySelector("#site-mobile-nav");
    const toggle = document.querySelector(".menu-toggle");
    const desktop = document.querySelector(".nav-desktop");
    const links = [...(nav?.querySelectorAll("a") ?? [])];
    const first = links[0];
    const navStyle = nav ? getComputedStyle(nav) : null;
    const firstStyle = first ? getComputedStyle(first) : null;
    const cta = nav?.querySelector(".mobile-nav-cta");
    const ctaStyle = cta ? getComputedStyle(cta) : null;
    const navBox = nav?.getBoundingClientRect();
    const firstBox = first?.getBoundingClientRect();
    return {
      surface: root?.getAttribute("data-surface") ?? null,
      pathname: location.pathname,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      toggle: {
        expanded: toggle?.getAttribute("aria-expanded"),
        controls: toggle?.getAttribute("aria-controls"),
        display: getComputedStyle(toggle ?? document.body).display,
        minWidth: toggle ? getComputedStyle(toggle).minWidth : null,
        width: toggle?.getBoundingClientRect().width ?? 0,
        height: toggle?.getBoundingClientRect().height ?? 0
      },
      desktopDisplay: desktop ? getComputedStyle(desktop).display : null,
      nav: {
        open: nav?.classList.contains("open") ?? false,
        hidden: nav?.hasAttribute("hidden") ?? null,
        display: navStyle?.display,
        backgroundColor: navStyle?.backgroundColor,
        color: navStyle?.color,
        overflowX: navStyle?.overflowX,
        overflowY: navStyle?.overflowY,
        width: navBox?.width ?? 0,
        height: navBox?.height ?? 0,
        top: navBox?.top ?? 0,
        bottom: navBox?.bottom ?? 0,
        text: nav?.innerText?.replace(/\s+/g, " ").trim() ?? ""
      },
      firstLink: first
        ? {
            text: first.textContent?.trim() ?? "",
            href: first.getAttribute("href"),
            color: firstStyle?.color,
            backgroundColor: firstStyle?.backgroundColor,
            width: firstBox?.width ?? 0,
            height: firstBox?.height ?? 0
          }
        : null,
      cta: cta
        ? { text: cta.textContent?.trim() ?? "", href: cta.getAttribute("href"), color: ctaStyle?.color }
        : null,
      linkLabels: links.map((link) => link.textContent?.trim()),
      linkHrefs: links.map((link) => link.getAttribute("href")),
      tabbableInNav: links.filter((link) => link.tabIndex >= 0 && !nav?.hasAttribute("hidden")).length
    };
  });
}

function contrastAgainstPanel(foreground, background) {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return null;
  return contrastRatio(fg, bg);
}

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: process.env.ATELIER_BROWSER_PATH ?? "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});

const page = await browser.newPage();
page.setDefaultTimeout(20000);

const viewports = [
  { width: 320, height: 568, mobile: true },
  { width: 375, height: 667, mobile: true },
  { width: 390, height: 844, mobile: true },
  { width: 430, height: 932, mobile: true },
  { width: 720, height: 800, mobile: true },
  { width: 721, height: 800, mobile: false },
  { width: 768, height: 1024, mobile: false },
  { width: 1024, height: 768, mobile: false }
];

const routes = [
  { path: "/discover", surface: "luminous" },
  { path: "/account", surface: "workroom" },
  { path: "/", surface: "luminous" }
];

for (const route of routes) {
  for (const viewport of viewports) {
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
    await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle0" });
    const chrome = await page.evaluate(() => {
      const toggle = document.querySelector(".menu-toggle");
      const desktop = document.querySelector(".nav-desktop");
      return {
        surface: document.querySelector(".app-root")?.getAttribute("data-surface"),
        toggleDisplay: toggle ? getComputedStyle(toggle).display : "missing",
        desktopDisplay: desktop ? getComputedStyle(desktop).display : "missing"
      };
    });
    check(
      `${route.path} @${viewport.width} uses ${route.surface}`,
      chrome.surface === route.surface,
      chrome.surface
    );
    if (viewport.mobile) {
      check(
        `${route.path} @${viewport.width} shows the disclosure toggle`,
        chrome.toggleDisplay === "flex" && chrome.desktopDisplay === "none",
        JSON.stringify(chrome)
      );
      await openMenu(page);
      const measured = await measureNav(page);
      const ratio = contrastAgainstPanel(measured.firstLink?.color, measured.nav.backgroundColor);
      check(
        `${route.path} @${viewport.width} link contrast >= 4.5:1`,
        ratio != null && ratio >= 4.5,
        `ratio=${ratio} fg=${measured.firstLink?.color} bg=${measured.nav.backgroundColor}`
      );
      check(
        `${route.path} @${viewport.width} shows readable link labels`,
        /Discover|Today|Sign in/.test(measured.nav.text) && (measured.firstLink?.height ?? 0) >= 44,
        measured.nav.text
      );
      check(
        `${route.path} @${viewport.width} keeps destinations`,
        measured.linkHrefs.includes("/account") &&
          (measured.linkHrefs.includes("/project") ||
            measured.linkHrefs.includes("/project/new") ||
            measured.linkHrefs.includes("/")),
        measured.linkHrefs.join(" ")
      );
      check(
        `${route.path} @${viewport.width} does not create horizontal overflow`,
        measured.scrollWidth <= measured.clientWidth + 1,
        `${measured.scrollWidth} / ${measured.clientWidth}`
      );
      check(
        `${route.path} @${viewport.width} panel stays on-screen`,
        measured.nav.height > 0 && measured.nav.bottom <= viewport.height + 1,
        JSON.stringify({ height: measured.nav.height, bottom: measured.nav.bottom })
      );
      if (route.path === "/discover" && viewport.width === 390) {
        const shot = path.join(OUT, "after-discover-390x844.png");
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
        await page.screenshot({ path: shot, fullPage: false });
        writeFileSync(path.join(OUT, "after-discover-390x844.json"), JSON.stringify({ ...measured, contrast: ratio }, null, 2));
        await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });
      }
    } else {
      check(
        `${route.path} @${viewport.width} keeps desktop navigation`,
        chrome.toggleDisplay === "none" && chrome.desktopDisplay === "flex",
        JSON.stringify(chrome)
      );
    }
  }
}

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await openMenu(page);
const beforeEscape = await page.evaluate(() => document.querySelector("#site-mobile-nav")?.classList.contains("open"));
await page.keyboard.press("Escape");
await page.waitForFunction(() => document.querySelector(".menu-toggle")?.getAttribute("aria-expanded") === "false");
const afterEscape = await page.evaluate(() => {
  const nav = document.querySelector("#site-mobile-nav");
  const toggle = document.querySelector(".menu-toggle");
  const first = nav?.querySelector("a");
  return {
    open: nav?.classList.contains("open") ?? false,
    hidden: nav?.hasAttribute("hidden") ?? false,
    expanded: toggle?.getAttribute("aria-expanded"),
    focus: document.activeElement === toggle,
    firstTabIndex: first?.tabIndex ?? null,
    firstDisplay: first ? getComputedStyle(first).display : null
  };
});
check("Escape closes the disclosure", beforeEscape === true && afterEscape.open === false && afterEscape.hidden === true, JSON.stringify(afterEscape));
check("Escape restores focus to Menu", afterEscape.focus && afterEscape.expanded === "false", JSON.stringify(afterEscape));

await openMenu(page);
await page.click("#site-mobile-nav a[href='/services']");
await page.waitForFunction(() => location.pathname === "/services");
const afterNavigate = await page.evaluate(() => ({
  path: location.pathname,
  open: document.querySelector("#site-mobile-nav")?.classList.contains("open") ?? false,
  hidden: document.querySelector("#site-mobile-nav")?.hasAttribute("hidden") ?? false
}));
check("navigating a link closes the panel and keeps the destination", afterNavigate.path === "/services" && afterNavigate.hidden === true, JSON.stringify(afterNavigate));

await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await openMenu(page);
await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
await page.waitForFunction(() => document.querySelector(".menu-toggle")?.getAttribute("aria-expanded") === "false");
const afterWiden = await page.evaluate(() => ({
  expanded: document.querySelector(".menu-toggle")?.getAttribute("aria-expanded"),
  hidden: document.querySelector("#site-mobile-nav")?.hasAttribute("hidden"),
  desktop: getComputedStyle(document.querySelector(".nav-desktop")).display
}));
check("crossing 720px closes the mobile panel", afterWiden.expanded === "false" && afterWiden.hidden === true && afterWiden.desktop === "flex", JSON.stringify(afterWiden));

await page.setViewport({ width: 667, height: 375, deviceScaleFactor: 1 });
await page.goto(`${BASE}/discover`, { waitUntil: "networkidle0" });
await openMenu(page);
const landscape = await measureNav(page);
const landscapeRatio = contrastAgainstPanel(landscape.firstLink?.color, landscape.nav.backgroundColor);
check(
  "landscape keeps contrast and vertical reachability",
  landscapeRatio != null &&
    landscapeRatio >= 4.5 &&
    landscape.nav.overflowY === "auto" &&
    landscape.scrollWidth <= landscape.clientWidth + 1,
  `ratio=${landscapeRatio} overflowY=${landscape.nav.overflowY}`
);

await page.evaluate(() => {
  document.documentElement.style.fontSize = "24px";
});
await page.reload({ waitUntil: "networkidle0" });
await openMenu(page);
const enlarged = await measureNav(page);
const enlargedRatio = contrastAgainstPanel(enlarged.firstLink?.color, enlarged.nav.backgroundColor);
check(
  "enlarged text keeps links readable and contrast-safe",
  enlargedRatio != null && enlargedRatio >= 4.5 && (enlarged.firstLink?.height ?? 0) >= 44 && enlarged.nav.text.includes("Discover"),
  `ratio=${enlargedRatio} height=${enlarged.firstLink?.height}`
);

await page.evaluate(() => {
  document.documentElement.style.fontSize = "";
});
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
const accountForm = await page.evaluate(() => Boolean(document.querySelector("form, a[href*='account'], button")));
check("sign-in surface still renders after nav checks", accountForm, "account page missing form/controls");

await page.goto(`${BASE}/project`, { waitUntil: "networkidle0" });
const project = await page.evaluate(() => document.body.innerText);
check("project intake still reachable", /project|brief|commission|begin/i.test(project), project.slice(0, 160));

await page.goto(`${BASE}/account`, { waitUntil: "networkidle0" });
await page.evaluate(async () => {
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner.local@atelier.invalid" })
  });
});
await page.goto(`${BASE}/companion`, { waitUntil: "networkidle0" });
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const companionSurface = await page.evaluate(() => document.querySelector(".app-root")?.getAttribute("data-surface"));
if (companionSurface === "atelier") {
  await openMenu(page);
  const companion = await measureNav(page);
  const companionRatio = contrastAgainstPanel(companion.firstLink?.color, companion.nav.backgroundColor);
  check(
    "atelier workspace mobile nav keeps ivory-on-obsidian contrast",
    companionRatio != null && companionRatio >= 4.5 && /Today|Talk|Studio/.test(companion.nav.text),
    `ratio=${companionRatio} text=${companion.nav.text}`
  );
  await page.setViewport({ width: 1024, height: 768, deviceScaleFactor: 1 });
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".nav-desktop")).display === "flex");
  const workspaceDesktop = await page.evaluate(() => ({
    display: getComputedStyle(document.querySelector(".workspace-nav")).display,
    color: getComputedStyle(document.querySelector(".workspace-nav a") ?? document.body).color,
    labels: [...document.querySelectorAll(".workspace-nav a")].map((link) => link.textContent?.trim())
  }));
  check(
    "atelier workspace desktop nav stays visible and labeled",
    workspaceDesktop.display === "flex" && workspaceDesktop.labels.includes("Today"),
    JSON.stringify(workspaceDesktop)
  );
} else {
  check("atelier workspace is available for signed-in companion nav", false, companionSurface);
}

await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});

await browser.close();

const failed = results.filter((result) => !result.ok);
console.log(`${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  process.exit(1);
}
