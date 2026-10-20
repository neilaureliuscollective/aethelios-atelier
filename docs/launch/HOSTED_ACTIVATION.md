# Hosted-activation checklist

This is the next stage after local code-complete verification. Nothing here was activated by this agent.

Local visual-brand continuity on this branch is complete: two distinct identities become editable Studio drafts, revision 2 is explicitly adoptable without overwriting revision 1, and preview/export share `renderComposition`. That does **not** satisfy any row below.

| Integration | Status | What “verified” requires |
| --- | --- | --- |
| One real hosted sign-in provider (Google or Resend via existing Auth.js) | **Blocked** | Provider credentials, `ATELIER_AUTH_ADAPTER=authjs`, `AUTH_SECRET`, founder allowlist. Simulated identities are not this row. |
| Correct callback origin | **Blocked** | Hosted `ATELIER_PUBLIC_ORIGIN` matching the deployed Auth.js callback URL. Local `/account` is not this row. |
| Durable dedicated Postgres | **Blocked / not run** | Isolated Atelier `DATABASE_URL`. Local sqlite, memory, and disposable `atelier_visual_continuity_test` are not this row. Do not reuse the Aethelios production database. |
| Artifact / export storage | **Blocked** | Private blob reads authorized by session ownership. An unguessable URL is not authorization. Local owner-canvas-bound hashes are not this row. |
| Two-account isolation on the hosted origin | **Not run** | Two real provider accounts: confirm, open the adopted draft, export, then prove the second account cannot read preview, metadata, or export bytes. |
| One approved provider-backed creative request | **Blocked** | Spend approval, `ATELIER_OPENAI_ENABLED=true`, `OPENAI_API_KEY`. Fixture / fail-closed local generation is not this row. |
| GitHub Actions `check` on this branch | **Blocked** | Run `39473099250` on `342ab8f` never started. Annotation: recent account payments failed or the spending limit must be increased. Local `pnpm typecheck` / `lint` / `test` / `build` are not this row. Do not change billing from this agent. |

## Explicitly not acceptance

- Simulated identities
- Local SQLite, memory, or disposable Postgres adapters
- Fixtures
- A successful production build
- A READY Vercel deployment without the rows above
- Matching headlines on generic default artwork

## Do not do from this PR

Create or configure credentials, expand permissions, activate paid AI, spend money, migrate live databases, change pricing, enable billing, push to `main`, merge, deploy, or publish.
