# Homepage hero direction

## Assumed acceptance criteria

Replace the flat opening with original photorealistic artwork; retain the existing headline, enquiry route, and project conversation; use the site's palette and fonts; provide responsive composition, readable text, and reduced-motion support; keep each image below 2 MB; pass the applicable project checks and a browser regression.

## Evidence and interpretation

- verified_fact: `src/app/page.tsx` renders `ConciergeStage`, not the legacy `CinematicHero`.
- verified_fact: `README.md`, `src/app/about/page.tsx`, and `src/app/approach/page.tsx` describe a founder-led digital infrastructure studio with human review. `src/app/globals.css` defines obsidian, emerald, champagne gold, and ivory, with Cormorant Garamond and Figtree typography.
- hypothesis: precision architecture, layered glass, and an ascending passage communicate deliberate craft and future-facing infrastructure. This is an art direction, not a claim about the studio's premises or delivered projects.
- visual_impression: the generated landscape scene provides convincing material depth and warm directional light, with a quiet left side for the headline.
- needs_testing: effects on enquiries, engagement, and real-user loading performance require measurements after founder-approved release. No conversion or performance improvement is claimed.

Research used the supplied repository as the primary source. External research was outside the network scope. No separate venture or product identity was used.

## Assets and implementation

`public/atmosphere/atelier-hero.webp` and `atelier-hero-mobile.webp` are original AI-generated conceptual architecture, created with the supplied Aethelios image studio at maximum quality. They depict no real office, client project, logo, or product. The landscape prompt requested shadow on the left and emerald/brass architecture to the right; the portrait prompt placed the architecture above a dark field for copy. Both exclude people, text, and logos.

The homepage uses an eager, high-priority responsive picture with descriptive alt text. The browser selects one composition. Fixed hero layout space avoids depending on image decode for text layout; the obsidian background also preserves copy if the image fails. The existing project conversation follows immediately below the visual opening; the primary CTA retains its input-focus behavior.

Motion is a single CSS transform that settles within 4.8 seconds. Reduced-motion preference disables it, including when the preference changes. No animation library, video, canvas, runtime image-generation call, or new application dependency is added.

Run `CHROME_PATH=/path/to/chromium node scripts/home-hero-browser.mjs` against a local server to check image loading and responsive selection, horizontal overflow, reduced motion, CTA focus, starter behavior, and the enquiry link. Optional `ATELIER_PREVIEW_DIR` writes temporary screenshots to an existing directory.

## Validation in this run

- verified_fact: `corepack pnpm typecheck && corepack pnpm lint` exited 0.
- verified_fact: `corepack pnpm test` exited 0: 425 passed, 20 skipped by the existing suite (Postgres integration/worker coverage).
- verified_fact: `corepack pnpm build` exited 0 on the isolated rerun. Existing warnings concern `align-items: end` in the unchanged `concierge.module.css` and missing `metadataBase`. The initial attempt failed after a development server shared its build directory; that server was stopped before rerunning.
- verified_fact: `CHROME_PATH=/tmp/chromium ATELIER_PREVIEW_DIR=/tmp/atelier-hero-previews node scripts/home-hero-browser.mjs` exited 0 against the production server at 390, 768, and 1440 CSS pixels. An initial test-harness API error was corrected before this successful run.
- verified_fact: PIL inspection returned landscape 2560×1440 / 296,614 bytes and portrait 1440×2560 / 334,140 bytes. Both are below the brief's 2 MB limit.
- visual_impression: both source images and the three browser screenshots were inspected; the architecture is visible and the existing heading and actions remain legible.

Temporary browser tooling and previews live outside the repository. No application dependency or lockfile change was needed. Founder approval of the artwork and the conversation's new position below the opening remains a release decision.
