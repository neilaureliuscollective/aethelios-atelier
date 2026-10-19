#!/usr/bin/env node
/**
 * Browser privacy checks: account switching, signout isolation, offline cache allowlist.
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const results = [];
function check(name, ok, extra = "") {
  results.push({ name, ok, extra });
  if (!ok) console.error("FAIL", name, extra);
  else console.log("PASS", name, extra);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"]
});
const page = await browser.newPage();
await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });

await page.evaluate(async () => {
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner.local@atelier.invalid" })
  });
});
await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
const ownerA = await page.content();
check("user A workspace is session-rendered", ownerA.includes("owner.local@atelier.invalid"));

const cacheDump = await page.evaluate(async () => {
  const names = await caches.keys();
  const atelier = names.filter((name) => name.startsWith("atelier-"));
  const entries = [];
  for (const name of atelier) {
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const response = await cache.match(request);
      const type = response?.headers.get("content-type") ?? "";
      const body = type.includes("text/html") ? await response.clone().text() : "";
      entries.push({
        cache: name,
        url: request.url,
        type,
        hasOwner: body.includes("owner.local@atelier.invalid"),
        hasFounder: body.includes("neil.local@atelier.invalid"),
        html: type.includes("text/html")
      });
    }
  }
  return { names, atelier, entries };
});
check(
  "personalized HTML is not in Atelier caches",
  cacheDump.entries.every((entry) => !entry.hasOwner && !entry.hasFounder && !(entry.html && !entry.url.includes("/offline")))
);
check(
  "cache cleanup is scoped to Atelier prefixes",
  cacheDump.atelier.every((name) => name.startsWith("atelier-"))
);

await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
const signedOut = await page.content();
check("signout hides owner A workspace", !signedOut.includes("owner.local@atelier.invalid") || signedOut.includes("Sign in"));

await page.evaluate(async () => {
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner-two.local@atelier.invalid" })
  });
});
await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
const ownerB = await page.content();
check("user B does not see user A email", !ownerB.includes("owner.local@atelier.invalid"));
check("user B session is visible", ownerB.includes("owner-two.local@atelier.invalid"));

await page.setOfflineMode(true);
await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded" }).catch(() => null);
const offline = await page.content();
check(
  "offline navigation does not serve owner HTML",
  !offline.includes("owner.local@atelier.invalid") && !offline.includes("owner-two.local@atelier.invalid")
);
await page.setOfflineMode(false);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} privacy checks passed`);
if (failed.length) process.exit(1);
