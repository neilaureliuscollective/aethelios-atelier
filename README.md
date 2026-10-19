# Aethelios Atelier

Founder-led digital infrastructure studio. This repository is a **standalone** application: a public entrance, an AI-guided (optional) brief, a living commission, and a private founder review workspace.

Neil Stutes remains responsible for accepting work, scope, price, timing, and delivery. Aurelius is a guide. This is not autonomous website generation, not an Aethelios subscription, and not a replacement for human expertise.

## Local candidate

```bash
cp .env.example .env.local
# defaults in .env.local already select sqlite_local + simulated auth
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Simulated identities (labeled, not production auth):

- `owner.local@atelier.invalid` — client
- `owner-two.local@atelier.invalid` — second client (authorization tests)
- `neil.local@atelier.invalid` — founder

Sign-in does **not** adopt a guest draft or submit a brief. Adoption is an explicit review at `/account/adopt`.

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Configuration

See `.env.example`. Fail-closed rules:

- Persistence requires `ATELIER_PERSISTENCE_ADAPTER=sqlite_local` or `memory`.
- Auth requires `ATELIER_AUTH_ADAPTER=simulated` until a real provider exists.
- Aurelius stays unavailable unless `ATELIER_OPENAI_ENABLED=true` **and** `OPENAI_API_KEY` are set. Live model calls are not made by default and were not used in this implementation.
- Billing is not activated. Do not set Stripe keys.

Data is stored in `.data/` (gitignored). This is not a hosted database.

## Brand assets

Approved logo and icon live in `public/brand/original/`. Optimized derivatives are used in the interface. Concept images in `docs/visual-direction/` are art-direction references only and are not used as full-screen UI backgrounds.

## Launch blockers (external)

- Real authentication (the current adapter is simulated and labeled)
- Dedicated hosted database (do not reuse Aethelios production)
- Authorized OpenAI spend (`ATELIER_OPENAI_ENABLED` + key)
- Final service pricing
- Domain, TLS, and deployment
- Notifications (not implemented; the UI says so)
- Billing / Stripe (explicitly inactive)

## Architecture

See `docs/ARCHITECTURE.md`.
