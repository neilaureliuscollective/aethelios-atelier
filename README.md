# Aethelios Atelier

Founder-led digital infrastructure studio. This repository is a **standalone** application: a public entrance, an AI-guided (optional) brief, a living commission, and a private founder review workspace.

Neil Stutes remains responsible for accepting work, scope, price, timing, and delivery. Aethelios is the in-app intelligence; Aurelius is Neil’s separate personal assistant and is not this guide. This is not autonomous website generation, not an Aethelios subscription, and not a replacement for human expertise.

## Local candidate

```bash
cp .env.example .env.local
# defaults in .env.local already select sqlite_local + simulated auth
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Companion feature isolation (independent port and build output):

```bash
pnpm dev:cofounder
```

Open [http://localhost:3010/companion](http://localhost:3010/companion).

Simulated identities (labeled, not production auth):

- `owner.local@atelier.invalid` — client
- `owner-two.local@atelier.invalid` — second client (authorization tests)
- `neil.local@atelier.invalid` — founder

Sign-in does **not** adopt a guest draft or submit a brief. Adoption is an explicit review at `/account/adopt`.

## Fresh Vercel project

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/neilaureliuscollective/aethelios-atelier&project-name=aethelios-atelier&repository-name=aethelios-atelier&framework=nextjs)

Import **this** GitHub repository into a new Vercel project on the Stutes Legacy team. Production branch is `main`. Vercel should auto-detect:

- Framework: Next.js
- Root Directory: repository root
- Node.js: 22.x
- Package manager: pnpm

Do not create a blank Vercel project. An empty `main` (README only) deploys as `404 NOT_FOUND` because Next.js is never detected. Public pages do not need env vars on the first deploy.

Full steps: [docs/VERCEL.md](docs/VERCEL.md).

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node scripts/api-flow.mjs
node scripts/privacy-browser.mjs
node scripts/browser-regressions.mjs
node scripts/companion-api.mjs
node scripts/companion-browser.mjs
node scripts/lifestyle-journey.mjs
node scripts/usage-concurrency.mjs
node scripts/custom-projects-browser.mjs
node scripts/launch-journey-api.mjs
node scripts/early-access-journey.mjs
```

## Configuration

See `.env.example`. Fail-closed rules:

- Local persistence: `ATELIER_PERSISTENCE_ADAPTER=sqlite_local` or `memory`.
- Hosted persistence: `postgres` plus `DATABASE_URL` / `POSTGRES_URL`. sqlite and memory are refused on Vercel.
- Auth requires `ATELIER_AUTH_ADAPTER=simulated` on an isolated local machine until a real provider exists. Hosted platforms always refuse simulated auth. Auth.js (Google / Resend) is integrated and stays fail-closed until credentials exist (`docs/AUTH.md`).
- Aethelios stays unavailable unless `ATELIER_OPENAI_ENABLED=true` **and** `OPENAI_API_KEY` are set. Live model calls are not made by default and were not used in this implementation. Internal identifiers may still use the older `aurelius` name; visitor-facing copy maps that to Aethelios.
- Billing is not activated. Do not set Stripe keys.

Local data is stored in `.data/` (gitignored). That file is not a hosted database.

## Brand assets

Approved logo and icon live in `public/brand/original/`. Optimized derivatives are used in the interface. Concept images in `docs/visual-direction/` are art-direction references only and are not used as full-screen UI backgrounds.

## Launch blockers (external)

- Hosted Auth.js activation with real Google credentials (`docs/AUTH.md`). The adapter is integrated; public Vercel stays unsigned until those secrets exist. Simulated identities remain labeled and local-only.
- Dedicated hosted database credentials in the Vercel project (adapter exists; do not reuse Aethelios production)
- Authorized OpenAI spend (`ATELIER_OPENAI_ENABLED` + key)
- Final service pricing
- Production domain assignment after the first Vercel import
- Notifications (not implemented; the UI says so)
- Billing / Stripe (explicitly inactive)

## Architecture

See `docs/ARCHITECTURE.md`.
