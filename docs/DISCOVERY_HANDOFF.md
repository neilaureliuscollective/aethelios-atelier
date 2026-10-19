# Discovery studio handoff

## Exact base

- Independently reviewed foundation: `d97a3186decbd2c5f2e66648fcf69651760f15af`
- Branch at that review: `cursor/atelier-standalone-foundation-fc70`
- This parallel branch: `cursor/atelier-discovery-studio-8909` at `7bbe8c0a0a2fb912251e567f3278ce4bc3d8acb2`
- Isolation: git worktree `/workspace/discovery-studio`, Next port **3010**, local `.next` and `.data` in this worktree only

Main was README-only at the review. This work is not based on empty `main`.

## Owned paths

- `src/app/discover/page.tsx`
- `src/components/discovery/**`
- `src/lib/discovery/**`
- `public/discovery/**`
- `scripts/discovery-browser.mjs`
- `docs/DISCOVERY_HANDOFF.md`
- `docs/DISCOVERY_VERIFICATION.md`

No shared components, APIs, auth, persistence, guest draft, service worker, manifests, configuration, or dependencies were edited.

## What works now

`/discover` is a full discovery studio: immersive entrance, progressive intake, quality selection, three distinct interactive concepts, studio editing, desktop/mobile preview, two-direction comparison, shortlist, confirmable `DiscoverySelection` snapshot, brief-mapping preview, and a copyable summary.

Status copy is **Direction prepared on this device**. It does not claim the direction was sent or added to an account.

Aethelios is named throughout new visitor copy. Live model access is not used. Concepts are labeled as curated directions personalized from answers.

## Remaining integration (small, explicit)

The other worker owns saving, recovery, authentication, and submission. Discovery must not write guest drafts, mutate projects, or call submit APIs. When that controller is repaired, consume the confirmed selection through it.

### 1. Homepage / header entry

Exact later edits (do not apply while the other worker is on those files):

- `src/components/shell/SiteHeader.tsx` — add `{ href: "/discover", label: "Discover" }` to `links`, and consider compact treatment for `/discover` like `/project`.
- `src/app/page.tsx` — add a gold or ghost action: `Explore your direction` → `/discover`, without replacing the existing brief CTA.
- Optional: `src/components/shell/SiteFooter.tsx` — add Discover next to existing links.

### 2. Brief import through the repaired controller

There is no safe discovery-import hook on `GuidedBrief` today.

Contract to consume:

```ts
import {
  mapSelectionToBriefProposals,
  applyProposals,
  parseSelection,
  type DiscoverySelection
} from "@/lib/discovery";
```

Required behavior:

1. Read a confirmed `DiscoverySelection` from discovery’s namespaced store (`aethelios.atelier.discovery.v1`) or an explicit in-memory handoff object. Never from the URL.
2. Parse with `parseSelection`. Unknown catalog/template versions fail closed.
3. Call `mapSelectionToBriefProposals(selection, currentBrief)`.
4. For each proposal, if `conflict` is true, the repaired revision-aware controller must offer **append / replace / skip**. Empty fields may replace after consent.
5. Apply only through `applyProposals` after those decisions. Do not assign discovery objects onto `Brief` fields; values are strings with provenance `client_statement`.
6. Preserve unrelated fields (`timing`, `budget`, `bookingProvider`, `existingWebsite`, `goals` are never inferred).
7. Bind import to the current brief revision. Stale revisions must fail closed the same way submission already does.
8. Require **fresh consent** before any submit. Import is not submit.
9. Do not auto-import for a signed-in account.

Suggested UX copy: “Add this prepared direction to your brief?” with append/replace/skip per conflicting field.

### 3. Selection display in client / founder workspaces

`src/components/discovery/SelectionSummary.tsx` is presentational and reusable. Later render it on:

- the client project workspace, after import
- the founder review of a project that includes an imported discovery snapshot

Do not mount it there until those screens are stable. Pass the confirmed `DiscoverySelection` plus its mapping. Do not imply founder review has started.

### 4. Protected copy that still says Aurelius

Do **not** rename these while the other worker is editing them. Listed for a later pass. New discovery copy uses **Aethelios** only.

- `src/app/layout.tsx` metadata description
- `src/app/page.tsx` hero lede
- `src/app/approach/page.tsx`
- `src/app/services/page.tsx`
- `src/components/project/GuidedBrief.tsx`
- `src/components/project/LivingBrief.tsx`
- `src/components/shell/SiteFooter.tsx`
- `src/lib/brief.ts` `provenanceLabel`
- `src/lib/catalog.ts` undecided offer + `AURELIUS_FACTS`
- `src/lib/aurelius/**` (module name is backend; visitor-facing strings only)
- `README.md`, `docs/ARCHITECTURE.md`, `docs/VERIFICATION.md`

## Handoff object

```ts
{
  version: 1,
  kind: "discovery_brief_mapping",
  sourceSelectionId: string,
  sourceRevision: number,
  proposals: Array<{
    field: BriefFieldKey,
    proposedValue: string,
    reason: string,
    existingValue: string,
    conflict: boolean,
    apply: "propose"
  }>,
  untouchedFields: BriefFieldKey[],
  summary: string,
  unknowns: string[],
  warnings: string[]
}
```

`applyProposals(brief, mapping, decisions)` exists for tests and the future controller. Discovery UI never calls project APIs.
