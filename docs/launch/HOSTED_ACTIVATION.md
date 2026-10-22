# Hosted-activation checklist

This is the next stage after local code-complete verification. Nothing here was activated by this agent.

The four-status rehearsal table (implemented / configured-not-verified / verified-hosted / missing-or-blocked) lives in `docs/launch/HOSTED_REHEARSAL.md`. Local exact-draft export binding and strict UI acceptance on this branch do **not** satisfy any row below. The server binds owner-rendered bytes to a revision; it does not independently re-rasterize every pixel.

| Integration | Status | What “verified” requires |
| --- | --- | --- |
| One real hosted sign-in provider (Google or Resend via existing Auth.js) | **Blocked** | Provider credentials, `ATELIER_AUTH_ADAPTER=authjs`, `AUTH_SECRET`, founder allowlist. Simulated identities are not this row. |
| Correct callback origin | **Blocked** | Hosted `ATELIER_PUBLIC_ORIGIN` matching the deployed Auth.js callback URL. Local `/account` is not this row. |
| Durable dedicated Postgres | **Blocked / not run** | Isolated Atelier `DATABASE_URL`. Local sqlite, memory, and disposable `atelier_visual_continuity_test` are not this row. Do not reuse the Aethelios production database. |
| Artifact / export storage | **Blocked** | Private blob reads authorized by session ownership. An unguessable URL is not authorization. Local owner-canvas-bound hashes are not this row. |
| Two-account isolation on the hosted origin | **Not run** | Two real provider accounts: confirm, open the adopted draft, export, then prove the second account cannot read preview, metadata, or export bytes. |
| One approved provider-backed creative request | **Blocked** | Spend approval, `ATELIER_OPENAI_ENABLED=true`, `OPENAI_API_KEY`. Fixture / fail-closed local generation is not this row. |
| GitHub Actions `check` on this branch | **Verified** on PR #25 | Run `39777597733` completed SUCCESS at 2026-10-22 07:22 America/Chicago. Older billing-blocked runs are not this row. |
| Public Vercel origin (no SSO wall) | **Blocked** | Preview and `https://aethelios-atelier-stutes-legacy.vercel.app` return `Protected by Vercel Authentication`. Browser on `/inquire` shows only the Vercel login page. A stranger cannot start a project. Disable Deployment Protection on production, or attach a public custom domain. |
| Custom public domain | **Blocked** | `atelier.aethelios.com`, `aetheliosatelier.com`, and `www.aetheliosatelier.com` do not resolve. |
| Guest inquiry delivery | **Blocked until public origin + inbox + Resend** | First the origin must be reachable without Vercel login. Then set `ATELIER_INQUIRY_TO` to a real mailbox. Direct sending needs `AUTH_RESEND_KEY` and `AUTH_RESEND_FROM`. Local capture and mailto are not hosted delivery. A signed-out phone user must be able to send; Neil must receive the message. |

## Explicitly not acceptance

- Simulated identities
- Local SQLite, memory, or disposable Postgres adapters
- Fixtures
- A successful production build
- A READY Vercel deployment without the rows above
- Matching headlines on generic default artwork

## Do not do from this PR

Create or configure credentials, expand permissions, activate paid AI, spend money, migrate live databases, change pricing, enable billing, push to `main`, merge, deploy, or publish.
