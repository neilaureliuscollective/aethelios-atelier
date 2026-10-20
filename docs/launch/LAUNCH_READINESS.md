# Atelier launch-readiness report

Branch: `cursor/atelier-premium-launch-readiness-da63`  
Inspected incoming head: `a8aabc60d0b91c17bbe1d117443ea4e67a2584f6`  
Application commit: `a5f109a9ba7270c4c47a9fcbf1a096276aa6a4ac`  
Documented head at last push: `342ab8f660db4f906faa93930116dcaad7d8e332`  
This pass continues that branch. It does not reset to `main`.

This is **code-complete evidence for a local candidate**, not configured launch acceptance.

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

## Test results by adapter / auth / provider

| Layer | Result |
| --- | --- |
| Memory unit/integration (`pnpm test` without Postgres URL) | 280 passed, 19 Postgres tests skipped |
| SQLite local (running app, simulated auth) | `launch-journey-api.mjs` 16/16 and `visual-identity-journey.mjs` 21/21 against a fresh `.data-visual` directory |
| Isolated disposable PostgreSQL 16 (`atelier_visual_continuity_test` on 127.0.0.1) | `postgres.integration.test.ts` + `postgres.multiprocess.test.ts`: 18 passed, including concurrent empty-schema init, guest revisions, and claim/adopt/rollback |
| Simulated auth | `owner.local@atelier.invalid`, `owner-two.local@atelier.invalid` |
| Real Auth.js / Google / Resend | Not run — credentials not configured |
| Provider / live OpenAI | Fail-closed. Not run. |

## Local commands actually run

- `pnpm typecheck` — pass
- `pnpm lint` — pass
- `pnpm test` — 280 passed, 19 skipped
- Isolated Postgres suite — 18 passed
- `pnpm build` — production build of this head
- Visual identity API and browser journeys (see artifacts)

## Recovery patch

`docs/launch/atelier-visual-continuity.patch` — recoverable diff of `a5f109a` against `a8aabc6` (382,993 bytes, SHA-256 `6357848f90527635509786b49620ec628af992b2a7aaf74c0757f7ead0af9e00`).

## Configured launch acceptance

See `docs/launch/ARTWORK_DELIVERY.md` for this pass and `docs/launch/HOSTED_ACTIVATION.md` for remaining gates.

GitHub Actions `check` remains **blocked** by account billing / spending limit. A never-started Actions job is not a passing test suite. Vercel preview is not launch acceptance.

Do not merge to `main` or deploy from this agent without a separate approval.
