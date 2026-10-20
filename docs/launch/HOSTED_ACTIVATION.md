# Hosted-activation checklist

This is the next stage after local code-complete verification. Nothing here was activated by this agent.

| Integration | Status | What “verified” requires |
| --- | --- | --- |
| One real hosted sign-in provider (Google or Resend via existing Auth.js) | **Blocked** | Provider credentials, `ATELIER_AUTH_ADAPTER=authjs`, `AUTH_SECRET`, founder allowlist. Simulated identities are not this row. |
| Correct callback origin | **Blocked** | Hosted `ATELIER_PUBLIC_ORIGIN` matching the deployed Auth.js callback URL. Local `/account` is not this row. |
| Durable dedicated Postgres | **Blocked / not run** | Isolated Atelier `DATABASE_URL`. Local sqlite and memory tests are not this row. Do not reuse the Aethelios production database. |
| Artifact / export storage | **Blocked** | Private blob reads authorized by session ownership. An unguessable URL is not authorization. |
| Two-account isolation on the hosted origin | **Not run** | Two real provider accounts: confirm, open the adopted draft, export, then prove the second account cannot read preview, metadata, or export bytes. |
| One approved provider-backed creative request | **Blocked** | Spend approval, `ATELIER_OPENAI_ENABLED=true`, `OPENAI_API_KEY`. Fixture / fail-closed local generation is not this row. |

## Explicitly not acceptance

- Simulated identities
- Local SQLite or memory adapters
- Fixtures
- A successful production build
- A READY Vercel deployment without the rows above

## Do not do from this PR

Create or configure credentials, expand permissions, activate paid AI, spend money, migrate live databases, change pricing, enable billing, push to `main`, merge, deploy, or publish.
