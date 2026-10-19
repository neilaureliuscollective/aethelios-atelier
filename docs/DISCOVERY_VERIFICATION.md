# Discovery studio verification

Base: `d97a3186decbd2c5f2e66648fcf69651760f15af` on `cursor/atelier-standalone-foundation-fc70`.
First discovery pass: `f94259080deaa59932b48196373ac2c338165002`.
Last independently inspected published HEAD before this consistency pass: `756c220b7f2e813df2568144414610e8e4c0bbde`.
This pass continues on `cursor/atelier-discovery-studio-8909` without merging later foundation work.

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

Do not treat HTTP fetch timings as rendering-performance results. The browser script measures interaction after load and actual preview layout (a 390px device inside a 1440px window, plus 390 / 884 / 1440 viewports). Elapsed interaction time is labeled informational and is not a Web Vital. A successful production build is not launch acceptance.

Real-device keyboard testing was unrun (no physical phone). Headless Chrome covered native radio arrow keys, stage-heading focus, reduced motion, 44px targets, and sticky-control visibility.

## Defects reproduced and corrected

1. Comparison “Use Hearth” while Lumen was active could confirm Lumen. `confirm()` read the previous render’s draft after an async `activeDirectionId` patch. Replaced with `confirmDirection(draft, directionId, previous)`, one state transition, used by studio, comparison, review, and mobile actions.
2. Confirmed recap CTAs built the dialog from the live editable draft. After confirming Meridian Sitting Room and renaming the working draft to Willow Atelier, the recap dialog stayed on Meridian; the live exploration dialog showed Willow.
3. Signal’s `.root` set `container-name: concept` on the same element the grid query tried to restyle. Moved `container-type` / `container-name: concept` to an ancestor wrapper (`frame.module.css`). A 390px Signal phone inside 1440 now reports `colCount: 1`, `stacked: true`. Lumen and Hearth no longer declare themselves as containers.
4. Persisted `intakeStep` accepted 4, fractions, negatives, and non-integers, which could render a blank intake screen. `sanitizeIntakeStep` now requires a finite integer in `INTAKE_STEP_MIN`..`INTAKE_STEP_MAX` (0–3). Restore keeps valid answers, shows a recovery notice, and never invents a confirmation.

A typecheck failure from `onClick={onConfirm}` passing a mouse event as `directionId` was corrected to `onClick={() => onConfirm()}` before the browser run.

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
- Each comparison panel has unique section IDs; both panels remain independently navigable
- A 390px phone preview inside a 1440px browser uses container-sized type, not viewport desktop type
- Signal, Lumen, and Hearth each stack in a 390px phone frame inside 1440; Signal stays two columns in desktop at 1440
- Clicking Use Hearth while Lumen is the active radio confirms Hearth, including recap image, summary, and adapter proposal
- Confirmed recap dialog and live exploration dialog use their originating snapshots
- Invalid stored intake step 4 restores question 1 with the saved business name
- Expanded mobile controls leave **Use this direction** on-screen
- No account/project mutation from discovery
- Preview booking actions cannot complete a booking
- After first load, exploration works without an AI or network response
- Diagnostic “Aethelios is available” controls are absent from the visitor flow
- Full offline reload of `/discover` is **not** claimed (existing service worker / shell remain owned elsewhere)

## Screens

Capture at 390, 884, and 1440 including entrance, personalized concept, desktop comparison, phone preview within desktop for all three directions, mobile controls, confirmed recap, and changed-but-unconfirmed review.

## Results in this worktree

- `pnpm test`: 53 passed / 0 failed (26 discovery + 27 existing foundation tests)
- `pnpm typecheck`: pass
- `pnpm lint`: pass
- `pnpm exec next build`: pass, `/discover` 21.6 kB
- Dev/start port: `3010`
- `scripts/discovery-browser.mjs`: 66/66 checks passed on `http://127.0.0.1:3010` (failed: 0)
- Post-load first interaction: 51ms after click (informational; not a Web Vital)
- Phone-in-desktop layout at 1440px window, 390px device:
  - Lumen: `colCount:1 stacked:true headingFont:42.9 overflowX:0`
  - Hearth: `colCount:1 stacked:true headingFont:39 overflowX:0`
  - Signal: `colCount:1 stacked:true headingFont:54.6 overflowX:0`
- Signal desktop at 1440: `colCount:2 width:952` (not the squeezed phone grid)
- Comparison isolation: Lumen Continue scrolled its device to 1019px; Hearth stayed at 0. Hearth Time then scrolled the right device to 690px without moving Lumen.
- Non-active confirm: Lumen still checked; Use Hearth confirmed `hearth` / `Meridian Sitting Room`
- Recap dialog: `source=confirmed name=Meridian Sitting Room`; live dialog: `source=exploration name=Willow Atelier`
- All three directions recap/summary/revision: lumen 2, hearth 3, signal 4, name Willow Atelier after reconfirm
- Invalid intake restore: heading “What is the name of the business?”, name Restored Sitting Room
- Screens under `/opt/cursor/artifacts/`:
  - `discover_entrance-{390,884,1440}w.png`
  - `discover_personalized-{390,884,1440}w.png`
  - `discover_compare_desktop-1440w.png`
  - `discover_compare-{390,884}w.png`
  - `discover_compare_mobile_controls_open-390w.png`
  - `discover_phone_{lumen,hearth,signal}_in_desktop-1440w.png`
  - `discover_preview_signal-1440w.png`
  - `discover_mobile_controls-390w.png`
  - `discover_recap-{390,884,1440}w.png`
  - `discover_review-{390,884,1440}w.png`
  - `discover_unpublished_recap-1440w.png`
  - `discover_reduced_motion-1440w.png`
  - `discover_qualities-{390,1440}w.png`
