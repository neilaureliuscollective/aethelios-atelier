# Aethelios Atelier — architecture

This application is a standalone product. It does not import Aethelios, Carreón, or a previous Atelier module.

## Stack decision

Next.js 15 (App Router) + React 19 + TypeScript is the maintainable typed stack for a website that *is* the application: routes, server-validated APIs, and a PWA shell in one codebase. Persistence uses `node:sqlite` (Node 22) behind an adapter interface, with an in-memory adapter for tests. Auth is a labeled simulated-identity adapter. OpenAI is an optional server-only boundary and stays off unless `ATELIER_OPENAI_ENABLED=true` and `OPENAI_API_KEY` are both set.

## Adapters

| Concern | Local candidate | Hosted later |
| --- | --- | --- |
| Persistence | `sqlite_local` in `.data/atelier.sqlite` | Dedicated Atelier database — never the Aethelios production DB |
| Auth | Simulated identities | Real identity provider |
| Aurelius | Disabled unless explicitly enabled | Same boundary, with spend approval |
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

## Schema

See `src/lib/persistence/schema.sql` and `src/lib/persistence/sqlite.ts`. Additive only. Do not apply to a shared production database.
