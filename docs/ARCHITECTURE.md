# Aethelios Atelier — architecture

This application is a standalone product. It does not import Aethelios, Carreón, or a previous Atelier module.

## Stack decision

Next.js 15 (App Router) + React 19 + TypeScript is the maintainable typed stack for a website that *is* the application: routes, server-validated APIs, and a PWA shell in one codebase. Persistence uses `node:sqlite` (Node 22) locally, an in-memory adapter for tests, and a dedicated Postgres adapter (`postgres`) for Vercel / Neon. Auth is a labeled simulated-identity adapter on isolated local machines and is refused on hosted platforms until a real provider is connected. OpenAI is an optional server-only boundary and stays off unless `ATELIER_OPENAI_ENABLED=true` and `OPENAI_API_KEY` are both set.

## Adapters

| Concern | Local candidate | Hosted later |
| --- | --- | --- |
| Persistence | `sqlite_local` in `.data/atelier.sqlite` | Dedicated Atelier Postgres (`ATELIER_PERSISTENCE_ADAPTER=postgres` + `DATABASE_URL` / `POSTGRES_URL`) — never the Aethelios production DB. sqlite and memory are refused on Vercel. |
| Auth | Simulated identities | Real identity provider |
| In-app intelligence (Aethelios; internal `aurelius` identifiers) | Disabled unless explicitly enabled | Same boundary, with spend approval |
| Billing | Isolated module, not activated | Future Stripe work in `src/lib/billing/boundary.ts` only |

Unconfigured adapters fail closed and report the missing connection instead of success.

## Trust boundaries

- Guest drafts live in `localStorage` and are not submissions.
- Sign-in never adopts or submits a draft.
- Adoption requires an authenticated account and `confirmed: true`.
- Submissions are immutable snapshots with idempotency keys and receipts.
- Founder notes and internal proposals are served only on founder routes.
- Client views never include private notes.
- Review progress is shown only after `review_started`.
- Unpublished proposal and delivery-version drafts stay on founder routes.
- Client agreement names an exact published version; later edits create a new version.
- Payments are not collected; founder-set prices stay labeled `not_collected`.

## Schema

See `src/lib/persistence/schema.sql`, `src/lib/persistence/schema.postgres.sql`, `src/lib/persistence/sqlite.ts`, and `src/lib/persistence/postgres.ts`. Additive only. Do not apply to a shared production database. Proposal, decision, delivery-version, feedback, content-request, and milestone tables are versioned records for the client approval workflow.

## Companion / digital co-founder

Additive workspace for a client business: membership-checked profile, Talk, Studio, Work, and Today. Persistence lives in dedicated companion tables on the same Atelier adapters (`src/lib/persistence/companionStore.ts`). Client AI context is built only from authorized confirmed facts, preferences, and the owner’s projects — never founder notes or another client’s records.

See `docs/COFOUNDER.md`.

Hosted deployment steps: `docs/VERCEL.md`.
