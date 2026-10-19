# Verification (local candidate)

Distinguishes **domain tests**, **HTTP tests against sqlite_local**, **browser privacy**, and **screenshots**. Simulated identities are labeled. No hosted auth/database was used. OpenAI was not called.

## Automated

```
pnpm typecheck          # pass
pnpm lint               # pass
pnpm test               # 27/27 pass
pnpm build              # pass
node scripts/api-flow.mjs
# 25/25 pass against production `next start` + sqlite_local
node scripts/privacy-browser.mjs
node scripts/measure-perf.mjs
node scripts/capture-screens.mjs
```

HTTP checks (real local persistence, not browser fixtures):

- Owner creates and saves a commission
- Second user is denied the client view
- Owner is denied the founder queue
- Stale save returns 409 without overwriting newer typing
- Submit without a reviewed version is rejected
- Stale reviewed version cannot be submitted
- Consent submission returns a durable receipt
- Idempotent retry does not duplicate the snapshot
- Later draft edits preserve the submitted snapshot
- Same idempotency key on a different project conflicts
- Second project loads by explicit id
- Duplicate guest adoption is idempotent
- Submitted is not treated as founder review
- Aurelius unavailable replies are labeled not-live-AI
- Founder start-review is the event that unlocks review progress
- Private notes stay off the client payload
- Second user is denied founder project access
- Clarification is client-visible; snapshot remains unchanged

Unit/domain regressions also cover coalesced save versioning, hosted simulator refusal, and cache allowlisting.

## Browser

Exercised guest brief, explicit project routes, workspace isolation, founder review, offline shell, and account switching against the production build.

## Not claimed

- Live OpenAI replies (disabled; `ATELIER_OPENAI_ENABLED` is false)
- Hosted auth or database
- Stripe / payments
- Notifications
- Production deployment
- Software-keyboard testing on a physical phone (not available in this environment)
