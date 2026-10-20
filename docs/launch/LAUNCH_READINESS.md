# Atelier launch-readiness report

Branch: `cursor/atelier-premium-launch-readiness-da63`  
Base: `429f939b555f5e4d11bc95e2cc56afb11f167c98` (`main`)

This is **code-complete evidence for a local candidate**, not configured launch acceptance.

## What improved

- Concurrent first visits now converge on one initial workspace via `user_initial_business` uniqueness plus `runInTransaction`.
- Guest Discovery/brief work is claimed once, idempotently, for the signed-in account. Private content stays out of callback URLs. Return paths are allowlisted.
- Discovery requires an explicit business-context review before the concept studio. Signed-in customers confirm the business and exact Discovery revision before Studio adopts it. Existing business names are not silently replaced.
- Public metadata, robots, sitemap, and a customer-facing `error.tsx` were added. The service worker now treats `/companion` as personalized (cache `atelier-static-v9`).
- Pricing remains inquiry-led. Official brand assets and the ivory / emerald-glass / gold system were not reskinned.

## What you can test immediately

Local candidate (`pnpm install && pnpm build && pnpm start`, simulated identities):

1. Open `/` → `/discover` → confirm business → use a direction → Continue to your workspace.
2. Sign in as `owner.local@atelier.invalid` (labeled simulator). Confirm the business. Open Studio.
3. Sign in as `owner-two.local@atelier.invalid` in another profile. Confirm the two workspaces stay isolated.
4. Reload, sign out/in, and retry the same guest claim — it must not duplicate.

## Code-complete evidence

| Item | Result |
| --- | --- |
| Typecheck | Pass |
| Lint | Pass (one unused-arg warning removed) |
| `pnpm test` | 235 passed, 15 skipped (Postgres not configured) |
| `pnpm build` | Pass (Next.js 15.5.28) |
| `scripts/api-flow.mjs` | 50/50 |
| `scripts/companion-api.mjs` | 32/32 on `:3000` |
| `scripts/launch-journey-api.mjs` | 10/10 |
| `scripts/discovery-browser.mjs` | 0 failed |
| Fonts | Figtree body / Cormorant Garamond headings via `next/font` Google (legitimate). Not Times. |
| HTTP fetch (not Lighthouse) | `/` 39ms / 62KB; `/project` `private, no-store` |

Identities used: **simulated** `owner.local@atelier.invalid` and `owner-two.local@atelier.invalid`. Persistence: **sqlite_local**. Live OpenAI: **off**. Auth.js providers: **not configured**.

## Configured launch acceptance

| Item | Status | Missing |
| --- | --- | --- |
| Chosen sign-in provider (Google / Resend) | Blocked | `AUTH_GOOGLE_*` / `AUTH_RESEND_*`, `ATELIER_AUTH_ADAPTER=authjs` |
| Email delivery and callbacks | Blocked | Resend from-address + hosted callback URLs |
| Sessions / logout on staging | Not run | Hosted Auth.js + `AUTH_SECRET` |
| Persistent hosted database | Blocked | Dedicated Atelier Postgres; do not reuse Aethelios production |
| Private export retrieval on staging | Not run | Hosted storage + auth |
| Approved live AI path | Blocked | Spend approval, `ATELIER_OPENAI_ENABLED=true`, `OPENAI_API_KEY` |
| Production domain / OG absolute URLs | Blocked | `ATELIER_PUBLIC_ORIGIN` on the real domain |
| Billing / published prices | Blocked | Intentionally inactive; do not invent amounts |
| Physical phones / hardware keyboards | Not run | CSS viewports 320–1440 verified locally |

## Remaining launch blockers

1. Real Auth.js credentials and founder email list.
2. Dedicated hosted Postgres and the non-destructive duplicate review in `RECONCILIATION.md`.
3. Authorized OpenAI spend if Talk/Studio generation must be live.
4. Production domain assignment.
5. The supplied `atelier-integrated-source.patch` / `REHEARSAL.md` / `99a7524` continuity commits were **not in this environment**. See `MISSING_SOURCE.md`.

## Smallest next activation steps

1. Approve a dedicated Atelier Postgres project and run the detection queries only.
2. Set Auth.js secrets on a staging Vercel project (`docs/AUTH.md`).
3. Walk Google and/or Resend sign-in, logout, and a private export on that staging URL.
4. Only then consider live AI and a production domain.

Do not merge to `main` or deploy from this agent without a separate approval.
