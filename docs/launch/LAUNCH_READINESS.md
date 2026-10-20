# Atelier launch-readiness report

Branch: `cursor/atelier-premium-launch-readiness-da63`  
Inspected incoming head: `6f5dcedf906e26715c4d351227cb9614772dca7c`  
Application commit: `2c6a4c7`  
Resulting head: `2cc7a2c6a017a36cec495401bfc212ae1fe65e1e`  
Recovery patch: `docs/launch/atelier-studio-adoption.patch`  
This pass continues that branch. It does not reset to `main`.

This is **code-complete evidence for a local candidate**, not configured launch acceptance.

## Source reconciliation

See `docs/launch/SOURCE_RECONCILIATION.md`.

- `REHEARSAL.md` was supplied and copied to `docs/launch/REHEARSAL.md`.
- `atelier-integrated-source.patch` is still the exact missing source. The approved immersive Direction → Refine → Collection / BrandKit implementation was **not** reconstructed from the rehearsal write-up.

## What this pass added

- Confirmation now requires the signed-in owner and a server-side guest claim. Client/localStorage IDs must match the claimed snapshot.
- A failed or missing guest claim blocks Discovery adoption.
- Confirmation idempotently creates or resolves one editable Studio draft, persists the adoption, and navigates to that exact draft.
- Confirm and Studio begin in a genuine checking state.
- Guest-claim inserts use `ON CONFLICT` / `INSERT OR IGNORE`. Guest-brief adoption retries the whole transaction instead of querying after a failed unique insert.

## Preserved from PR #18

Provisioning uniqueness, guest claiming, safe return destinations, confirmation conflict rules, inquiry-led pricing, official assets, Auth.js/simulated boundary, PWA `atelier-static-v9`, ivory / emerald-glass / gold chrome, and the existing companion Studio compositions / CAS / export pipeline.

## Test results by adapter / auth / provider

| Layer | Result |
| --- | --- |
| Memory unit/integration (`pnpm test` without Postgres URL) | 241 passed |
| SQLite local (running app, simulated auth) | `launch-journey-api.mjs` 16/16; `companion-api.mjs` 32/32 |
| Isolated disposable PostgreSQL 16 (`atelier_launch_test` on 127.0.0.1) | New claim/adopt/rollback tests: 2 passed. Pre-existing generation-slot tests can race schema init (`pg_type_typname_nsp_index`); not treated as this pass’s acceptance. |
| Simulated auth | Used throughout local proof (`owner.local@atelier.invalid`, `owner-two.local@atelier.invalid`) |
| Real Auth.js / Google / Resend | Not run — credentials not configured |
| Provider / live OpenAI | Fail-closed. Not run. |

Skipped without `ATELIER_LOCAL_POSTGRES_URL` in the default `pnpm test` run: 17 tests across `postgres.integration.test.ts`, `postgres.multiprocess.test.ts`, and `postgres.worker.test.ts`.

## Local commands actually run

- `pnpm typecheck` — pass
- `pnpm lint` — pass
- `pnpm test` — 241 passed, 17 skipped
- `ATELIER_LOCAL_POSTGRES_URL=postgres://…127.0.0.1…/atelier_launch_test pnpm exec vitest run src/lib/cofounder/postgres.integration.test.ts -t "claims guest work|rolls back a failed PostgreSQL"` — 2 passed
- `pnpm build` — pass (Next.js 15.5.28)
- `pnpm start` on a fresh `.data-adopt-verify` sqlite directory
- `node scripts/launch-journey-api.mjs` — 16/16
- `node scripts/companion-api.mjs` — 32/32
- `node scripts/studio-adoption-capture.mjs` — confirm → matching draft → edit → save → reopen in a fresh page → second account 404

## Browser / file proof

- Confirmed Lumen direction and adopted draft `studio_c7359a56-adc8-4f05-925f-3ae2312cf891`
- Matching Studio rendered “Considered sourcing”; after save/reopen the same composition showed “Considered sourcing · reserved”
- Second account (`owner-two.local@atelier.invalid`) received 404 for that draft id and saw “not in this workspace”
- Companion API already proves export hash binding, later edits do not change a stored export, and the second owner cannot download the file

## Configured launch acceptance

See `docs/launch/HOSTED_ACTIVATION.md`. Hosted sign-in, callback origin, durable Postgres, artifact storage, two real accounts, and one approved provider request remain blocked or not run.

Do not merge to `main` or deploy from this agent without a separate approval.
