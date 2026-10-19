# Fresh Vercel project

Import this repository as a **new** Vercel project. Do not attach Atelier to an existing Aethelios, Reserve, or other production project, and do not reuse those databases.

Public pages deploy without authentication. Sign-in, workspace, and founder review stay unavailable until a real identity provider is connected. Simulated identities are refused on Vercel even if local flags are copied into the dashboard.

## Create the project

1. Push this branch (or `main` after merge) to GitHub.
2. In Vercel: **Add New… → Project → Import** `neilaureliuscollective/aethelios-atelier`.
3. Confirm:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Node.js Version: **22.x**
   - Install Command: `pnpm install --frozen-lockfile` (from `vercel.json`)
   - Build Command: `pnpm build`
4. Do not enable a custom output directory.

## Dedicated database

Vercel has no durable local disk. `sqlite_local` and `memory` are refused when `VERCEL=1`.

1. In the new project open **Storage** and create **Neon** or **Vercel Postgres**, or create a separate Neon project.
2. Copy the pooled connection string into `POSTGRES_URL` or `DATABASE_URL`.
3. This must be an Atelier-only database. Never apply `src/lib/persistence/schema.postgres.sql` to the Aethelios production database.
4. Schema is applied additively on first successful connection (`CREATE TABLE IF NOT EXISTS`). No separate migrate step is required for a fresh database.

## Environment variables

Set these for Production and Preview:

| Name | Production value |
| --- | --- |
| `ATELIER_PERSISTENCE_ADAPTER` | `postgres` |
| `DATABASE_URL` or `POSTGRES_URL` | Pooled connection string from the dedicated database |
| `ATELIER_SESSION_SECRET` | 32+ random bytes, hex. Generate locally; do not commit it. |
| `ATELIER_AUTH_ADAPTER` | `unconfigured` |
| `ATELIER_OPENAI_ENABLED` | `false` until spend is authorized |
| `ATELIER_BILLING_ENABLED` | `false` |
| `ATELIER_PUBLIC_ORIGIN` | Canonical `https://` origin once the domain is assigned |

Optional later:

- `OPENAI_API_KEY` and `ATELIER_OPENAI_ENABLED=true` only after explicit authorization
- `ATELIER_FOUNDER_EMAILS` after real auth exists

Do **not** set on Vercel:

- `ATELIER_ALLOW_SIMULATED_AUTH`
- `ATELIER_ISOLATED_LOCAL`
- `ATELIER_PERSISTENCE_ADAPTER=sqlite_local`
- Stripe keys

`VERCEL=1` is set by the platform. The app uses it to refuse simulated auth and ephemeral persistence.

## First deploy checklist

1. Deploy Preview from this branch.
2. `GET /api/health` should report `ok: true`, `platform: "vercel"`, persistence adapter `postgres`, and `auth.ready: false`.
3. `/` and `/approach` render.
4. Sign-in remains unavailable. That is expected.
5. Assign the production domain after Preview looks correct. TLS is handled by Vercel.
6. Keep OpenAI and billing off until separately approved.

## Local still uses sqlite

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Local `.env.local` must not be uploaded to Vercel.
