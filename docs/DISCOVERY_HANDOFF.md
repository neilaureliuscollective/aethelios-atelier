# Discovery studio handoff

## Exact base

- Independently reviewed foundation at branch start: `d97a3186decbd2c5f2e66648fcf69651760f15af`
- Branch at that review: `cursor/atelier-standalone-foundation-fc70`
- This parallel branch: `cursor/atelier-discovery-studio-8909`
- Isolation: git worktree `/workspace/discovery-studio`, Next port **3010**, local `.next` and `.data` in this worktree only
- First discovery pass HEAD: `f94259080deaa59932b48196373ac2c338165002`
- This elevation continues from that HEAD. Foundation later commits (`0baf583`, `343aa7a`) were not merged or rebased.

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

`/discover` is a discovery studio: immersive entrance, progressive intake, quality selection, three distinct interactive concepts (Lumen, Hearth, Signal), studio editing, desktop and genuine phone-in-desktop previews (container queries), two independently usable comparison panels, shortlist, confirmable `DiscoverySelection` snapshot, customer-facing recap, and a copyable summary.

Status copy is **Direction prepared on this device**. It does not claim the direction was sent or added to an account.

Written intent (`intentNote`) is stored on the confirmed snapshot, included in fingerprints, shown in the recap, and mapped into the vision proposal. Editing it after confirmation marks the snapshot outdated without mutating it.

Confirmation is atomic: `confirmDirection(draft, directionId, previous)` patches the intended direction and snapshots that draft in one step. Comparison “Use Hearth” cannot confirm the previously active Lumen. Preview actions carry a typed `PreviewActionContext` (`instanceId`, `directionId`, exact `draft`, `source: exploration | confirmed`). Recap dialogs stay on the confirmed snapshot after later live edits.

Concept container queries use an ancestor wrapper (`container-name: concept`). Signal’s root grid can therefore collapse at 390px. Intake steps are integers 0–3 (`INTAKE_STEP_MIN` / `INTAKE_STEP_MAX`). Invalid stored steps recover to question 1 without discarding answers and without inventing a confirmation.

Aethelios is named throughout new visitor copy. Live model access is not used. Diagnostic “Aethelios is available” controls are not in the visitor flow. Concepts are labeled as curated directions personalized from answers.

Storage version is **2**. Version 1 envelopes still load. Missing notes stay empty; they are not invented. `clearDiscovery` only reports success after the key is gone.

## Remaining integration (small, explicit)

The foundation worker owns saving, recovery, authentication, and submission. Discovery must not write guest drafts, mutate projects, or call submit APIs. When that controller is repaired, consume the confirmed selection through it.

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
  fingerprintBrief,
  type DiscoverySelection,
  type ApplyDecision
} from "@/lib/discovery";
```

Required behavior:

1. Read a confirmed `DiscoverySelection` from discovery’s namespaced store (`aethelios.atelier.discovery.v1`) or an explicit in-memory handoff object. Never from the URL. Catalog version 1, template version 1, storage version 2. Bind later account/project import to that selection’s `selectionId` + `localRevision` and to the foundation brief’s revision.
2. Parse with `parseSelection`. Unknown catalog/template versions fail closed. An invalid intake step is not a confirmed selection.
3. Call `mapSelectionToBriefProposals(selection, currentBrief)`. Mapping version is **2** and includes `briefFingerprint`.
4. Revalidate against the **current** brief at apply time, not only the brief used to generate the mapping. `applyProposals` rejects `stale_mapping` when fingerprints differ.
5. For every proposal, require an explicit **append / replace / skip** decision. Omitted decisions fail closed. Empty fields are not auto-replaced.
6. `projectType` may only be replaced with a supported choice or skipped. Append is rejected (`invalid_project_type_append`).
7. Apply only through `applyProposals` after those decisions. Do not assign discovery objects onto `Brief` fields; values are strings with provenance `client_statement`.
8. Preserve unrelated fields (`timing`, `budget`, `bookingProvider`, `existingWebsite`, `goals` are never inferred).
9. Bind import to the current brief revision. Stale revisions must fail closed the same way submission already does.
10. Require **fresh consent** before any submit. Import is not submit.
11. Do not auto-import for a signed-in account.

Suggested UX copy: “Add this prepared direction to your brief?” with append/replace/skip per proposed field.

### 3. Selection display in client / founder workspaces

`src/components/discovery/SelectionSummary.tsx` is presentational and reusable. Later render it on:

- the client project workspace, after import
- the founder review of a project that includes an imported discovery snapshot

Do not mount it there until those screens are stable. Pass the confirmed `DiscoverySelection` plus its mapping. Do not imply founder review has started. Keep schema IDs out of the primary visitor experience.

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
  version: 2,
  kind: "discovery_brief_mapping",
  sourceSelectionId: string,
  sourceRevision: number,
  briefFingerprint: string,
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

`applyProposals(currentBrief, mapping, decisions)` returns `{ ok: true, brief }` or `{ ok: false, code, reason }`. Discovery UI never calls project APIs.
