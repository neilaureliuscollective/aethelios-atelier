# Premium experience integration

Isolated local branch: `cursor/atelier-premium-experience-integration-f614`

## Exact SHAs

- Production baseline (starting): `3ba7ff9ad8ecdaad6437fa751a3f6aecb067fcec` on `main`
- Incorporated Discovery: `b54b7ad13c524c2e14acf0c67e0393301a7cadc4` on `cursor/atelier-discovery-studio-8909`
- Shared ancestor: `d97a3186decbd2c5f2e66648fcf69651760f15af`
- Discovery port commit: `e4301a40527949849c946b889a2b24b442142336`
- Experience implementation commit: recorded in git log on this branch after this document was committed with the remaining work

Discovery added only new paths. Main’s later Postgres, async API, recovery, and hosted configuration were not replaced with older copies.

## What was integrated

Discovery-owned paths from `b54b7ad` were ported onto current `main` in a separate worktree (`/tmp/atelier-premium-experience-integration`, local production on port 3020). Then this pass:

1. Installed next/font variables on `html` so `:root` aliases resolve (body/nav/forms/controls = Figtree; display = Cormorant Garamond on editorial headings).
2. Rebalanced materials: obsidian/charcoal environment, emerald as depth/emphasis, gold hierarchy (warm body / champagne highlight / darker edge).
3. Rebuilt Lumen/Hearth/Signal as working concept sites with local scene plates, real local nav, and a trusted DesignSpec renderer. Default new-session Lumen palette is `nocturne`; catalog/template stay v1 so confirmed `ivory_hall` snapshots still parse.
4. Connected homepage/header/footer into `/discover`, made HeroComposition chips real `AppLink`s, and added revision-aware Discovery → brief import (append/replace/skip) without touching submit/receipt fencing.
5. Added Reveal motion (transform/opacity, reduced-motion still experience, no-JS stays visible).
6. Added versioned `atelier_concept_spec` adapter. OpenAI stays disabled; fixtures prove validation. Curated previews are labeled as not live model output.

## Overlap

No other running worker owned shared visual files at the start of this pass. Foundation recovery/submit in `GuidedBrief` was not rewritten. Receipt verification, post-readback sign-out fencing, and rejected-vs-uncertain submit classification remain as they were on main.

## Control / route audit

| Surface | Control | Outcome |
| --- | --- | --- |
| Header | Discover / Services / Approach / About | Navigate |
| Header | Sign in | `/account` (guest: explains unconfigured auth) |
| Header | Begin your project | `/project` (guest) or `/project/new` |
| Header | Menu (phone) | Opens same routes |
| Footer | Discover / Services / Approach / Begin a brief | Navigate |
| Home | Explore your direction | `/discover` |
| Home | Begin your project | `/project` |
| Home | Offer cards | `/discover?interest=website`, `/discover?interest=booking_connected_website`, `/services#digital-infrastructure` |
| Home | Hero chips | Same real routes (no decorative pointer pills) |
| Home | How a commission proceeds | `/approach` |
| Services | Explore website / booking-connected | Discovery with interest |
| Services | Digital infrastructure | `/project` with honest unavailable packaged-product copy |
| Services | Footer CTAs | `/discover`, `/project`, `/approach` |
| Approach | Process cards | In-page anchors |
| Approach | Explore / Begin | `/discover`, `/project` |
| Discovery entrance | Explore directions | Studio |
| Discovery entrance | Write a brief directly | `/project` |
| Discovery studio | Direction / device / compare / confirm / review | Real selection, comparison, atomic confirm, recap |
| Discovery recap | Add to your brief | `/project` with sessionStorage handoff |
| Brief | Review Discovery selection | append / replace / skip against current revision/fingerprint |
| Brief submit | Send / retry / receipt | Unchanged recovery owner: no false “sent to Neil” without server evidence |

Decorative atmosphere and logo geometry are `aria-hidden` / non-interactive.

## Font verification (local production, `document.fonts.ready`)

Script: `scripts/font-verify.mjs` against `http://127.0.0.1:3020`.

- Body, nav, buttons: Figtree (sans-serif), not Times New Roman
- Editorial `h1`: Cormorant Garamond
- Failed `--font-body-loaded`: still designed sans fallback, not Times

## Tests run on the isolated worktree

- `pnpm typecheck` pass
- `pnpm lint` pass
- `pnpm test` 98/98
- `pnpm build` pass
- Discovery browser 66/66
- API flow 28/28
- Privacy 22/22
- Browser regressions 64/64

Conditions: `NODE_ENV=production`, `ATELIER_PUBLIC_ORIGIN=http://127.0.0.1:3020`, `ATELIER_OPENAI_ENABLED` unset, port 3020, sqlite local + simulated identity adapter.

## Unconfigured / unproven

- Live OpenAI (`ATELIER_OPENAI_ENABLED` stays false; no paid calls)
- Hosted auth and production database
- Stripe / billing
- Physical-device keyboards and hardware phones (phone layout verified at 390px and phone-in-desktop frames)
- Notifications
- Merge/deploy of this isolated branch
