# Discovery studio verification

Base: `d97a3186decbd2c5f2e66648fcf69651760f15af` on `cursor/atelier-standalone-foundation-fc70`.

## Commands (this worktree, port 3010)

```bash
cd /workspace/discovery-studio
pnpm test -- src/lib/discovery/discovery.test.ts
pnpm typecheck
pnpm lint
ATELIER_OPENAI_ENABLED= pnpm exec next build
pnpm exec next dev --port 3010
DISCOVERY_BASE=http://127.0.0.1:3010 node scripts/discovery-browser.mjs
```

Do not treat HTTP fetch timings as rendering-performance results. The browser script measures interaction after load (input, compare, confirm).

## Paths proven

- Enter business information → qualities → personalized studio → compare → edit → review → copyable selection summary
- Back navigation preserves answers
- Later studio edits do not mutate a confirmed snapshot until **Use this direction**
- Mapping never writes an existing `Brief`; conflicts require append/replace/skip
- Unknown catalog versions and malformed storage fail closed
- Unavailable / quota storage is labeled
- Long Unicode names and markup-looking strings render as text
- Reset palette/name preserves unrelated choices
- Keyboard: native radios, disclosure summaries, dialog, step nav
- No account/project mutation from discovery
- Preview booking actions cannot complete a booking
- After first load, exploration works without an AI or network response
- Full offline reload of `/discover` is **not** claimed (existing service worker / shell remain owned elsewhere)

## Screens

Capture at 390, 884, and 1440 including comparison, personalized preview, final review, and reduced-motion entrance.

## Results in this worktree

- `pnpm test`: 38 passed (11 discovery + existing foundation tests)
- `pnpm typecheck`: pass
- `pnpm lint`: pass
- `pnpm exec next build`: pass, `/discover` 19.1 kB
- Dev/start port: `3010`
- `scripts/discovery-browser.mjs`: 19/19 checks passed on `http://127.0.0.1:3010`
- Post-load first interaction: 41ms after the page had already loaded (not an HTTP fetch timing claimed as render performance)
- Screens written under `/opt/cursor/artifacts/discover_*.png` and `walkthrough_discover_*.png`
