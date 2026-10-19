# Verification (local candidate)

Distinguishes **domain tests**, **HTTP tests against sqlite_local**, and **browser screenshots**. Simulated identities are labeled. No hosted auth/database was used. OpenAI was not called.

## Automated

```
pnpm typecheck   # pass
pnpm lint        # pass
pnpm test        # 10/10 pass
pnpm build       # pass
node scripts/api-flow.mjs  # 19/19 pass against the running app
```

HTTP checks (real local persistence, not browser fixtures):

- Owner creates and saves a commission
- Second user is denied the client view
- Owner is denied the founder queue
- Stale save returns 409 without overwriting newer typing
- Consent submission returns a durable receipt
- Idempotent retry does not duplicate the snapshot
- Submitted is not treated as founder review
- Aurelius unavailable replies are labeled not-live-AI
- Founder start-review is the event that unlocks review progress
- Private notes stay off the client payload
- Second user is denied founder project access
- Clarification is client-visible; snapshot remains unchanged

## Browser

Exercised guest brief → sign-in (no silent submit) → explicit adoption → consent/receipt → workspace isolation for a second owner → founder queue/review UI.

Screenshots at 390 / 884 / 1440: public entrance, guided brief, client workspace, founder queue/review.

## Not claimed

- Live OpenAI replies (disabled; `ATELIER_OPENAI_ENABLED` is false)
- Hosted auth or database
- Stripe / payments
- Notifications
- Production deployment
