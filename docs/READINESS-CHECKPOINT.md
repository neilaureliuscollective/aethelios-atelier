# Launch readiness checkpoint

This is a partial patch, not a launch approval. No hosted services were contacted.

## Assumed acceptance criteria and plan

Entry parameters may select offer, purpose, and project type, but must not insert visitor statements. Explicit import decisions must be respected. Context changes must preserve saved corrections. Vision must not be mislabeled as a business name. Keep architecture, commercial terms, and approved assets unchanged.

Plan: inspect shared intake and server boundaries; remove automatic starter promotion; fix skipped imports; exercise both supplied entry queries and saved wording; run project checks and capture local screens if the app starts; export for platform review.

## Source inspection map (verified_fact: cited repository files)

- Identity/architecture: `package.json`, `README.md`, `docs/ARCHITECTURE.md`: standalone Atelier, Next/React, pnpm lockfile. Platform branch is `aethelios/elevating-readiness-223a20`.
- Routes: `src/app/project/page.tsx` renders `GuidedBrief`; `/project/[id]`, `/inquire`, `/account/adopt`, `/workspace/[id]`, `/founder/[id]` and associated API trees exist. No route changes in this patch.
- Brief: `src/lib/types.ts`, `brief.ts`, `commissionContext.ts`, `offers/intake.ts`; shared field values/provenance plus offer context. `GuidedBrief` and `LivingBrief` render this state. `guest/draft.ts` keeps device drafts in localStorage and warns about shared browsers. `client/draftSession.ts` and save/submit modules manage revision recovery.
- AI: `aurelius/boundary.ts`, `instructions.ts`, `tools.ts`; optional server OpenAI configuration, owner-checked messages API, suggestions requiring resolution. Concierge and companion are additional separate code paths requiring later coverage.
- Voice exists: `concierge/transcribe.ts` uses OpenAI; no transcription or name-preservation test was performed.
- Documents/submission: `components/proposal/ProposalDocument.tsx` serves the proposal flow. `domain/projects.ts` handles owned projects and snapshot submissions. The requested visitor-editable brief document/download lifecycle is not completed by this patch.
- Inquiry email: `inquiry/destination.ts` uses server recipient configuration; `service.ts` uses an in-process idempotency map; `send.ts` calls Resend. Durable inquiry deduplication and delivery tracking remain unfinished. No provider call was made.
- Auth/storage: `auth/session.ts`, `auth/authjs.ts`, `persistence/adapter.ts`, SQLite/memory/Postgres adapters and schemas; owner assertions in `domain/projects.ts`. Existing access tests were located, not executed.
- Design/deployment: `app/globals.css`, local fonts and brand assets; `next.config.ts`, `vercel.json`. No style, asset, deployment, or database changes.

## Implementation and limits

Automatic entry starter insertion is removed. Offer suggestions remain available in the existing explicit import review. Study entry now leaves answer fields empty. Skip does not import even an empty field. Dismissing offer context preserves wording, including accepted text identical to a template. Commerce and barber vision labels now describe a project vision.

No schema migration is introduced. Existing drafts cannot reliably distinguish old automatic starters from visitor-confirmed identical wording. This patch preserves them; a future migration/reconfirmation flow must resolve that ambiguity. A dedicated businessName field shared across all paths is still required; the existing inquiry business field is separate from vision but not unified with it.

## Validation and blockers

- `node scripts/brief-entry-regressions.mjs`: passed. Executes real shared TypeScript modules using Node's stripping hooks, with assertions for both supplied entry queries, explicit accept/skip, Unicode corrections, context changes, and saved wording. This does not substitute for TypeScript checking or the complete test suite.
- `pnpm install --frozen-lockfile`: blocked by Corepack download DNS failure (`EAI_AGAIN registry.npmjs.org`). Retrying had the same result.
- `pnpm dev` and `pnpm check`: failed before application/check execution due to the same error. No screenshots could be captured. Before/progress/after desktop and phone views remain required.
- Vitest expectations were updated for the intentional change from automatic prefill to empty statements; Vitest was not executable here.

## Remaining launch acceptance (needs_testing / unfinished)

Restore package access, install the locked dependencies, run typecheck/lint/tests/build and browser journeys. Verify existing tests for ownership, stale responses, adoption and concurrent saves. Complete a unified name/vision/context schema and legacy confirmation strategy; editable versioned brief generation/download/review; durable email idempotency, exact reviewed snapshots, separate optional-copy consent/status/retries, and safe provider error handling. Verify chat interruption/cancellation, voice editing, injection defenses, and long Unicode content. Measure contrast, keyboard/focus, reduced motion, zoom and narrow-screen overflow before any accessibility claim. Real inbox receipt requires Neil's separate approval. Platform handles draft PR delivery; no push, merge, or deployment was attempted.
