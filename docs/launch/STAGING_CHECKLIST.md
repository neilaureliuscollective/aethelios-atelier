# Staging and rollback checklist

Do not migrate a hosted database, create credentials, activate billing, merge to `main`, or deploy without Neil’s separate approval.

## Safe local configuration

Copy `.env.example` to `.env.local`. Keep:

- `ATELIER_PERSISTENCE_ADAPTER=sqlite_local`
- `ATELIER_AUTH_ADAPTER=simulated`
- `ATELIER_ALLOW_SIMULATED_AUTH=true`
- `ATELIER_ISOLATED_LOCAL=true`
- `ATELIER_OPENAI_ENABLED=false`
- `ATELIER_BILLING_ENABLED=false`
- `ATELIER_PRICING_LOCAL_REVIEW=true` only on an isolated machine

Generate `ATELIER_SESSION_SECRET` before any non-development session work.

## Additive schema

New tables and indexes (already created by the sqlite/postgres adapters on boot):

- `user_initial_business`
- `guest_work_claims`
- `business_confirmations`
- unique index `projects_guest_draft_idx` on `adopted_from_guest_id`

For a hosted database that already has duplicate guest-draft or owner-business rows, run the detection queries in `docs/launch/RECONCILIATION.md` **before** applying the unique index. Do not delete customer rows.

## Staging activation (blocked until Neil approves)

1. Dedicated Atelier Postgres (`ATELIER_PERSISTENCE_ADAPTER=postgres` + `DATABASE_URL`). Never the Aethelios production database.
2. `ATELIER_AUTH_ADAPTER=authjs` with `AUTH_SECRET`, Google and/or Resend, `ATELIER_PUBLIC_ORIGIN`, `ATELIER_FOUNDER_EMAILS`.
3. Optional live AI: `ATELIER_OPENAI_ENABLED=true` and `OPENAI_API_KEY` after spend approval.
4. Production domain, then rebuild so `metadataBase` / Open Graph / sitemap use the real origin.

## Rollback

- Application: redeploy the previous git SHA. The new tables are unused if the old build does not read them.
- Uniqueness gate only: drop `user_initial_business` / `guest_work_claims` / `business_confirmations` and `projects_guest_draft_idx` after confirming no new writes depend on them.
- Do not drop `businesses`, `projects`, Studio revisions, or export blobs.

## What this environment must not do

- Create Google / Resend / OpenAI / Stripe credentials
- Enable paid generation
- Push or merge to `main`
- Point persistence at a shared production database
