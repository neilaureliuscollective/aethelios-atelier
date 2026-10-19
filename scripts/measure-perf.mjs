#!/usr/bin/env node
/** HTTP fetch time and body bytes only. Not LCP, INP, CLS, or rendered responsiveness. */
const BASE = process.env.ATELIER_BASE ?? "http://127.0.0.1:3000";
const paths = ["/", "/services", "/project", "/offline"];

async function measure(path) {
  const started = performance.now();
  const res = await fetch(`${BASE}${path}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ms = Math.round(performance.now() - started);
  return {
    path,
    status: res.status,
    ms,
    bytes: buf.byteLength,
    cacheControl: res.headers.get("cache-control"),
    contentType: res.headers.get("content-type")
  };
}

const rows = [];
for (const path of paths) {
  rows.push(await measure(path));
}
console.log(JSON.stringify({ at: new Date().toISOString(), base: BASE, rows }, null, 2));
