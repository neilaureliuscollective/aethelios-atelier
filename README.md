# Aethelios Atelier

Founder-led digital infrastructure studio. This repository is a **standalone** public site: visitors see the work and the services, talk their business through with Aethelios by typing, and send Neil the direction it writes. There are no visitor accounts and no voice sessions in the public launch.

Account, client-workspace, founder-console, Discover, and guided-brief routes are retired by `src/middleware.ts` (pages redirect to the Aethelios conversation at `/#aethelios`; their APIs return 404). Their code remains in the repository but is not reachable on the site. See `src/lib/publicSite.ts`.

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
node scripts/mobile-nav-browser.mjs
```

Guest inquiries do not require an account. Open `/inquire` or finish a brief and send it from the review step.

## Configuration

See `.env.example`. Fail-closed rules:

- Local persistence: `ATELIER_PERSISTENCE_ADAPTER=sqlite_local` or `memory`.
- Hosted persistence: `postgres` plus `DATABASE_URL` / `POSTGRES_URL`. sqlite and memory are refused on Vercel.
- Auth requires `ATELIER_AUTH_ADAPTER=simulated` on an isolated local machine until a real provider exists. Hosted platforms always refuse simulated auth. Auth.js (Google / Resend) is integrated and stays fail-closed until credentials exist (`docs/AUTH.md`).
- Aethelios stays unavailable unless `ATELIER_OPENAI_ENABLED=true` **and** `OPENAI_API_KEY` are set. Live model calls are not made by default and were not used in this implementation. Internal identifiers may still use the older `aurelius` name; visitor-facing copy maps that to Aethelios.
- Billing is not activated. Do not set Stripe keys.
- Guest inquiries: set `ATELIER_INQUIRY_TO` to a real inbox. Hosted delivery uses Resend (`AUTH_RESEND_KEY` + `AUTH_RESEND_FROM`). Isolated local machines may set `ATELIER_INQUIRY_CAPTURE=true` to store rehearsal inquiries in `.data/inquiries.jsonl` without sending mail. Capture is refused on Vercel.

Local data is stored in `.data/` (gitignored). That file is not a hosted database.

## Brand assets

Approved logo and icon live in `public/brand/original/`. Optimized derivatives are used in the interface. Concept images in `docs/visual-direction/` are art-direction references only and are not used as full-screen UI backgrounds.

## Launch blockers (external)

The public launch needs no database and no sign-in provider.

- Production domain, attached in Vercel, with Deployment Protection off for production
- `ATELIER_PUBLIC_ORIGIN` set to the `https://` domain
- Inquiry delivery: `ATELIER_INQUIRY_TO`, `AUTH_RESEND_KEY`, `AUTH_RESEND_FROM`, with the domain verified in Resend
- Authorized OpenAI spend (`ATELIER_OPENAI_ENABLED=true` + `OPENAI_API_KEY`) with a hard monthly cap on the OpenAI account
- Aethelios as a real model-led conversation (replies are still scripted; next phase)
- Published investment guidance (the Investment page explains custom pricing without figures until Neil sets them)
- Billing / Stripe (explicitly inactive)

## Architecture

See `docs/ARCHITECTURE.md`.
