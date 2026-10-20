# Atelier launch-readiness report

Branch: `cursor/atelier-premium-launch-readiness-da63`  
This pass continues that branch. It does not reset to `main`. Integration of the secondary custom-project route and release-candidate acceptance are this phase; see `docs/launch/HOSTED_REHEARSAL.md` for the remaining authorized hosted rehearsal.

Inspected at the start of this integration (refreshed, not assumed):

- PR #18 `cursor/atelier-premium-launch-readiness-da63`: `f5fe49689d5f7f31c63a0b38cc102685d9be453f`
- PR #19 `cursor/atelier-custom-projects-9372`: `db4bf56ffd4b01366dff46b61f5926470ce5394d`
- Shared merge-base: `b7e47e0`. PR #19 was two commits ahead and five behind PR #18.

History-preserving merge commit: `411e4daf328d45a3856931f9836b573965eb4b4e`.  
Neither PR was closed. `main` was not merged. Force-push was not used.

This is **code-complete evidence for an integrated local candidate**, not configured launch acceptance and not a live launch.

## Source reconciliation

See `docs/launch/SOURCE_RECONCILIATION.md`.

The actual immersive patch was present, hash-verified (283,258 bytes, SHA-256 `6ad51b91012226ae59a5e4d71fd30d6551ee9b753963d634b000b2eec352db35`), three-way applied, and reconciled file by file. `REHEARSAL.md` was not used as a substitute source.

## What the artwork-delivery pass added

- Insert-once `guest_work_owners` so two accounts cannot split revisions of one unclaimed selection
- Studio export stages: render → save → saved → download / download-failed, with Download again
- Logo upload failures keep the existing artwork
- Real UI exports for Lumen and Hearth (1600×1200, distinct SHA-256, byte-identical reopen)

## What the visual-continuity pass added

- Direction → Refine → Collection, BrandKit, shared preview/export rendering, and saved-versus-working comparison from the approved immersive patch
- Immutable owner-bound Discovery revisions: identical retry, same-revision conflict, newer revision claimable without overwriting the first snapshot
- Confirmation adopts the complete visual identity (palette, typography/style via designSpec, visual direction, layout, logo refs) into an editable Studio draft
- CompanionShell shows a retryable error when workspace verification fails; private actions stay blocked
- PostgreSQL schema initialization and test resets are serialized with `pg_advisory_xact_lock` so two connections cannot race `pg_type_typname_nsp_index`

## Preserved from PR #18 / Phase B

Provisioning uniqueness, transactional guest claims, exact-draft navigation, CAS saves, inquiry-led pricing, official assets, Auth.js/simulated boundary, PWA `atelier-static-v9`, and Atelier’s emerald-glass / warm-gold / ivory chrome. Client artwork uses the confirmed identity, not that chrome and not the older brown fallback.

## Two visual journeys

See `docs/launch/VISUAL_CONTINUITY.md`.

| Identity | Palette | Direction | Headline | First draft preserved |
| --- | --- | --- | --- | --- |
| Lumen House | ivory_hall `#F4F0E6` | glass | Glass evening | Yes after revision 2 |
| Hearth Room | hearth_linen `#1A1612` | material | Linen gathering | Separate account |

Revision 2 of Lumen is `signal_ink` / `graphic` / **A clear mark**. Explicit adoption created a second draft. Reopening revision 1 still showed Glass evening.

Owner-canvas-bound export SHA-256: `ab6b8492d0d565cba5fdaf31a9b92993e0f6fb74b0a81a132255655690f70006` (9551 bytes). Second account: 404 on the first account’s draft and export bytes.

## Integration and context-comparison pass

PR #19’s secondary custom-project work was merged onto this branch while keeping every newer PR #18 readiness commit. `provision.test.ts` kept both sides: the owner-race test from PR #18 and the “Project workspace” name assertions from PR #19.

`briefDifferences` now reports purpose, route, example, and booking context using the same normalized defaults as `briefsEqual`. A purpose-only change opens recovery with a visible Project kind difference instead of “The wording matches.” Older briefs without context compare equal to empty defaults. Keeping or taking a revision replaces the whole brief, so other fields are not dropped.

Two journeys were proved on this same combined head with simulated identities (`owner.local@atelier.invalid`, `owner-two.local@atelier.invalid`, founder `neil.local@atelier.invalid`):

| Journey | Entry | Persisted context that reached founder and proposal |
| --- | --- | --- |
| A. Business website | `/project?interest=website&purpose=business&route=business` | `purpose=business`, `route=business`, website pages + brand materials in the seeded proposal |
| B. Professional workflow, no brand or booking | `/custom-projects` → follow-up workspace | `purpose=professional_workflow`, `exampleId=follow_up_workspace`, no marketing pages, booking engine excluded |

HTTP proof: `scripts/integrated-journeys.mjs` **61/61**. Browser proof: `scripts/integrated-journeys-browser.mjs` **26/26**. Evidence: `/opt/cursor/artifacts/integrated-journeys/`.

## Test results by adapter / auth / provider

| Layer | Result |
| --- | --- |
| Memory unit/integration (`pnpm test` without Postgres URL) | **340 passed**, 1 skipped (`postgres.worker.test.ts` helper when run alone) |
| SQLite local (running app, simulated auth) | Production `next start :3040` / `.data-integration-rc`. Integrated journeys 61/61 + browser 26/26. `custom-projects-browser.mjs` 20/20. `launch-journey-api.mjs` 16/16. Strict `artwork-delivery-capture.mjs` re-run on this head |
| Isolated disposable PostgreSQL 16 (`atelier_integration_rc_test` on 127.0.0.1) | `postgres.integration.test.ts` + `postgres.multiprocess.test.ts`: **19 passed**. First combined run flaked one multiprocess worker-start timeout; isolated re-run of that file was 6/6 |
| Simulated auth | `owner.local@atelier.invalid`, `owner-two.local@atelier.invalid`, `neil.local@atelier.invalid` |
| Real Auth.js / Google / Resend | Not run — credentials not configured |
| Provider / live OpenAI | Fail-closed. Not run. |

## Local commands actually run

- `pnpm typecheck` — pass
- `pnpm lint` — pass
- `pnpm test` — 340 passed, 1 skipped
- Isolated Postgres suite — 19 passed
- `pnpm build` — production build of this head
- Combined-head HTTP and browser journeys, custom-projects browser, launch-journey API, and strict artwork-delivery browser acceptance

## Recovery patch

`docs/launch/atelier-visual-continuity.patch` — recoverable diff of `a5f109a` against `a8aabc6` (382,993 bytes, SHA-256 `6357848f90527635509786b49620ec628af992b2a7aaf74c0757f7ead0af9e00`).

`docs/launch/atelier-export-binding.patch` — recoverable diff of `f78a421` against inspected head `a0138a9` (90,901 bytes, SHA-256 `a72edd01d5c915c6f66795079c9cc271b2ab28e5a3097bac9eabfa882e6a2aae`).

## Configured launch acceptance

See `docs/launch/ARTWORK_DELIVERY.md` for this pass, `docs/launch/HOSTED_REHEARSAL.md` for the four-status hosted checklist, and `docs/launch/HOSTED_ACTIVATION.md` for remaining gates.

GitHub Actions `check` remains **blocked** by account billing / spending limit. A never-started Actions job is not a passing test suite. Vercel preview is not launch acceptance.

Do not merge to `main` or deploy from this agent without a separate approval.
