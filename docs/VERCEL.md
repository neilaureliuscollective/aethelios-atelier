# Fresh Vercel project

Vercel **New Project** deploys the GitHub **production branch**, which is `main`. If `main` only has a README, Vercel cannot detect Next.js, does not fill Framework / Install / Build, and the `.vercel.app` URL returns `404 NOT_FOUND`. That is the failure from the empty first imports.

This repository’s `main` branch is a Next.js 15 app at the repo root (`package.json` + `next` + `src/app` + `pnpm-lock.yaml`). Import **this** GitHub repo. Do not create a blank Vercel project, and do not attach Atelier to an existing Aethelios or Reserve project.

## Import (Stutes Legacy team)

1. [Vercel → Add New → Project](https://vercel.com/new)
2. Import `neilaureliuscollective/aethelios-atelier` (GitHub must be connected to the Stutes Legacy team).
3. Confirm the wizard collected these sections (auto-detected from `main`):
   - Framework Preset: **Next.js**
   - Root Directory: `./` (leave empty)
   - Node.js Version: **22.x** (`package.json` `engines.node`)
   - Install Command: pnpm (from `pnpm-lock.yaml`)
   - Build Command: `next build`
   - Output Directory: leave default
4. Environment variables are **optional for the first public-page deploy**. You can add Postgres later.
5. Deploy.

[Deploy with Vercel](https://vercel.com/new/clone?repository-url=https://github.com/neilaureliuscollective/aethelios-atelier&project-name=aethelios-atelier&repository-name=aethelios-atelier&framework=nextjs)

After deploy, `/` and `/approach` should render. `GET /api/health` should return `ok: true` with `platform: "vercel"`. Sign-in stays unavailable until Auth.js is activated with Google and/or Resend — see [AUTH.md](AUTH.md).

## If you still see 404 NOT_FOUND

- The connected Git branch is not `main`, or `main` was imported before this Next.js app landed on it. Redeploy the latest `main`.
- Root Directory was set to a subfolder. Reset it to empty.
- Framework Preset is Other / no Next.js version detected. Set it to Next.js and redeploy with cache cleared.
- You created a blank Vercel project instead of importing this GitHub repository. Delete that empty project and import the repo.

## Dedicated database (after the public site is up)

Vercel has no durable local disk. `sqlite_local` and `memory` are refused when `VERCEL=1`.

1. In the new project open **Storage** and create **Neon** or **Vercel Postgres**.
2. Copy the pooled connection string into `POSTGRES_URL` or `DATABASE_URL`.
3. Set `ATELIER_PERSISTENCE_ADAPTER=postgres`.
4. This must be an Atelier-only database. Never apply `src/lib/persistence/schema.postgres.sql` to the Aethelios production database.
5. Schema is applied additively on first successful connection.

## Environment variables

Public pages run without these. Set them when you want hosted persistence:

| Name | Value |
| --- | --- |
| `ATELIER_PERSISTENCE_ADAPTER` | `postgres` |
| `DATABASE_URL` or `POSTGRES_URL` | Pooled connection string from the dedicated database |
| `ATELIER_SESSION_SECRET` | 32+ random bytes, hex (also accepted as `AUTH_SECRET`) |
| `ATELIER_AUTH_ADAPTER` | `unconfigured` until Auth.js is activated; then `authjs` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth client (optional if Resend is set) |
| `AUTH_RESEND_KEY` / `AUTH_RESEND_FROM` | Resend magic links (optional if Google is set) |
| `ATELIER_FOUNDER_EMAILS` | Verified email(s) that receive founder authorization |
| `ATELIER_OPENAI_ENABLED` | `false` until spend is authorized |
| `ATELIER_BILLING_ENABLED` | `false` |
| `ATELIER_PUBLIC_ORIGIN` | Canonical `https://` origin once the domain is assigned |

Do **not** set on Vercel:

- `ATELIER_ALLOW_SIMULATED_AUTH`
- `ATELIER_ISOLATED_LOCAL`
- `ATELIER_AUTH_EMAIL_CAPTURE`
- `ATELIER_PERSISTENCE_ADAPTER=sqlite_local`
- Stripe keys
- Placeholder Google/Resend values

Auth.js activation steps and callback URLs: [AUTH.md](AUTH.md).

## Local still uses sqlite

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Local `.env.local` must not be uploaded to Vercel.
