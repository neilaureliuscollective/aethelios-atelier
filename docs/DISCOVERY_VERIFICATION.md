# Discovery studio verification

Base: `d97a3186decbd2c5f2e66648fcf69651760f15af` on `cursor/atelier-standalone-foundation-fc70`.
First discovery pass: `f94259080deaa59932b48196373ac2c338165002`.
This elevation continues on `cursor/atelier-discovery-studio-8909` without merging later foundation work.

## Commands (this worktree, port 3010)

```bash
cd /workspace/discovery-studio
pnpm test -- src/lib/discovery/discovery.test.ts
pnpm typecheck
pnpm lint
ATELIER_OPENAI_ENABLED= pnpm exec next build
pnpm exec next start --port 3010
DISCOVERY_BASE=http://127.0.0.1:3010 node scripts/discovery-browser.mjs
```

Do not treat HTTP fetch timings as rendering-performance results. The browser script measures interaction after load and actual preview layout (a 390px device inside a 1440px window). Elapsed interaction time is labeled informational and is not a Web Vital.

## Paths proven

- Enter business information → qualities → personalized studio → compare → edit → review → copyable selection summary
- Written intent survives snapshot, fingerprint, summary, mapping, save/restore, and the visible recap
- Editing intent after confirmation invalidates confirmation without mutating the old snapshot
- Back navigation preserves answers
- Later studio edits do not mutate a confirmed snapshot until **Use this direction**
- Mapping never writes an existing `Brief`; omitted decisions fail; skip leaves populated fields untouched
- Stale brief fingerprints are rejected; `projectType` cannot be appended into an invalid value
- Unknown catalog versions and malformed storage fail closed
- Storage-clear failure is not announced as success
- Long Unicode names and markup-looking strings render as text
- Reset palette/name preserves unrelated choices
- Keyboard: native radios (including arrow keys), disclosure summaries, dialog, stage-heading focus
- Each comparison panel has unique section IDs; navigation and demo dialogs stay with the originating direction
- A 390px phone preview inside a 1440px browser uses container-sized type, not viewport desktop type
- No account/project mutation from discovery
- Preview booking actions cannot complete a booking
- After first load, exploration works without an AI or network response
- Diagnostic “Aethelios is available” controls are absent from the visitor flow
- Full offline reload of `/discover` is **not** claimed (existing service worker / shell remain owned elsewhere)

## Screens

Capture at 390, 884, and 1440 including entrance, personalized concept, desktop comparison, phone preview within desktop, mobile controls, and final confirmed recap.

## Results in this worktree

- `pnpm test`: 48 passed / 0 failed (21 discovery + 27 existing foundation tests)
- `pnpm typecheck`: pass
- `pnpm lint`: pass
- `pnpm exec next build`: pass, `/discover` 21 kB
- Dev/start port: `3010`
- `scripts/discovery-browser.mjs`: 37/37 checks passed on `http://127.0.0.1:3010`
- Post-load first interaction: 42ms after click (informational; not a Web Vital)
- Phone-in-desktop layout: 1440px window, 390px device, Lumen heading 39.38px, no overflow
- Comparison isolation: Lumen Continue scrolled its device to 999px; Hearth stayed at 0
- Screens under `/opt/cursor/artifacts/`:
  - `discover_entrance-{390,884,1440}w.png`
  - `discover_personalized-{390,884,1440}w.png`
  - `discover_compare_desktop-1440w.png`
  - `discover_phone_in_desktop-1440w.png`
  - `discover_mobile_controls-390w.png`
  - `discover_recap-{390,884,1440}w.png`
  - `discover_preview_signal-1440w.png`
