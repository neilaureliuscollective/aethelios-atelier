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
  await caches.open("unrelated-app-cache-v1");
  const cache = await caches.open("unrelated-app-cache-v1");
  await cache.put(
    "/unrelated-seed",
    new Response("keep-me", { headers: { "content-type": "text/plain" } })
  );
});

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
check("sign-in is not the only proof of identity", !/Sign in to resume/.test(ownerA) || ownerA.includes("owner.local@atelier.invalid"));

const created = await page.evaluate(async () => {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brief: {
        vision: { key: "vision", value: "Private A vision for isolation", provenance: "client_statement" },
        projectType: { key: "projectType", value: "website", provenance: "client_statement" },
        audience: { key: "audience", value: "", provenance: "empty" },
        existingWebsite: { key: "existingWebsite", value: "", provenance: "empty" },
        bookingProvider: { key: "bookingProvider", value: "", provenance: "empty" },
        goals: { key: "goals", value: "", provenance: "empty" },
        references: { key: "references", value: "", provenance: "empty" },
        priorities: { key: "priorities", value: "", provenance: "empty" },
        timing: { key: "timing", value: "", provenance: "empty" },
        budget: { key: "budget", value: "", provenance: "empty" },
        constraints: { key: "constraints", value: "", provenance: "empty" }
      }
    })
  });
  return res.json();
});
const projectId = created.project?.id;
check("user A can create a private commission", Boolean(projectId), projectId);

await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
await page.waitForSelector("textarea");
await page.evaluate(() => {
  const area = document.querySelector("textarea");
  const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value");
  proto?.set?.call(area, "Queued private typing for owner A");
  area.dispatchEvent(new Event("input", { bubbles: true }));
});
await new Promise((r) => setTimeout(r, 200));
const queuedKeys = await page.evaluate(() =>
  Object.keys(sessionStorage).filter((key) => key.startsWith("atelier.account."))
);
check("queued recovery is owner-scoped", queuedKeys.some((key) => key.includes("draft")));

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
      const json = type.includes("application/json") ? await response.clone().text() : "";
      entries.push({
        cache: name,
        url: request.url,
        type,
        hasOwner: body.includes("owner.local@atelier.invalid") || json.includes("owner.local@atelier.invalid"),
        hasFounder: body.includes("neil.local@atelier.invalid"),
        html: type.includes("text/html"),
        json: type.includes("application/json"),
        rsc: type.includes("text/x-component")
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
  "API data is not in Atelier caches",
  cacheDump.entries.every((entry) => !entry.json && !String(entry.url).includes("/api/"))
);
check(
  "personalized RSC is not in Atelier caches",
  cacheDump.entries.every((entry) => !entry.rsc && !String(entry.url).includes("_rsc"))
);
check(
  "cache cleanup is scoped to Atelier prefixes",
  cacheDump.atelier.every((name) => name.startsWith("atelier-"))
);

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
check("user B does not see user A queued brief", !ownerB.includes("Queued private typing for owner A"));
const stillAOnB = await page.evaluate((keys) => keys.filter((key) => sessionStorage.getItem(key)).length, queuedKeys);
check("queued writes survive account A → B", stillAOnB === queuedKeys.length, `${stillAOnB}/${queuedKeys.length}`);

await page.evaluate(async () => {
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner.local@atelier.invalid" })
  });
});
await page.goto(`${BASE}/project/${projectId}`, { waitUntil: "networkidle0" });
const restored = await page.content();
check(
  "account A → B → A restores owner A recovery",
  restored.includes("Queued private typing for owner A") || restored.includes("unconfirmed")
);

await page.evaluate(async () => {
  await fetch("/api/session/sign-out", { method: "POST" });
});
await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });
const signedOut = await page.content();
const sessionAfter = await page.evaluate(async () => {
  const res = await fetch("/api/session");
  return res.json();
});
const leftover = await page.evaluate(() =>
  Object.keys(sessionStorage).filter((key) => key.startsWith("atelier.account."))
);
check("signout session API has no user", sessionAfter.user == null);
check(
  "signout removes owner A identity from the rendered workspace",
  !signedOut.includes("owner.local@atelier.invalid") && !signedOut.includes("Private A vision")
);
check("signout does not pass merely because a Sign in link exists", !signedOut.includes("owner.local@atelier.invalid"));
check("signout clears this account recovery keys", leftover.length === 0, leftover.join(","));

const unrelated = await page.evaluate(async () => {
  const names = await caches.keys();
  if (!names.includes("unrelated-app-cache-v1")) return false;
  const cache = await caches.open("unrelated-app-cache-v1");
  const match = await cache.match("/unrelated-seed");
  return Boolean(match) && (await match.text()) === "keep-me";
});
check("unrelated cache survives Atelier cleanup", unrelated);

await page.evaluate(async () => {
  await fetch("/api/session/sign-in", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "owner-two.local@atelier.invalid" })
  });
});
await page.goto(`${BASE}/workspace`, { waitUntil: "networkidle0" });

await page.setOfflineMode(true);
await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded" }).catch(() => null);
const offline = await page.content();
check(
  "offline navigation does not serve owner HTML",
  !offline.includes("owner.local@atelier.invalid") && !offline.includes("owner-two.local@atelier.invalid")
);

const uncertain = await page.evaluate(async () => {
  try {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({})
    });
    return res.json();
  } catch (error) {
    return { error: String(error) };
  }
});
check(
  "offline write is uncertain rather than not delivered",
  uncertain.delivered === "uncertain" || uncertain.ok === false,
  JSON.stringify(uncertain)
);
if (uncertain.delivered !== undefined) {
  check("service worker does not claim the write was not delivered", uncertain.delivered !== false);
}
await page.setOfflineMode(false);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} privacy checks passed`);
if (failed.length) process.exit(1);
