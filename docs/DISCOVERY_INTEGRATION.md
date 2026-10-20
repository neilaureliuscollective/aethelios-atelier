# Discovery integration note

This note is for the owner-journey worker. Discovery did not add a second import system.

## Current handoff on main

- Confirming a direction calls `writeDiscoveryHandoff(selection)`.
- The key is `aethelios.atelier.discovery.handoff.v1` in session storage.
- `/project` already mounts `src/components/project/DiscoveryImport.tsx`.
- “Add to your brief” only navigates to `/project`. It does not auto-import, overwrite an account draft, submit a commission, or clear pending recovery.

Historical text that says GuidedBrief has no import hook is stale. Do not rebuild import.

## Per-field review already present

`DiscoveryImport` already asks for append / replace / skip on each proposed field, refuses append on `projectType`, and refuses apply when the brief, selection, account, or revision changed while the review was open.

If a later owner-journey pass needs different defaults (for example, never preselect replace), change only `DiscoveryImport` / `importController`. Discovery should keep writing the same confirmed `DiscoverySelection`.

## Surface change made here

`/discover` now uses the existing luminous site surface so the shared light header matches homepage and Services. That is a one-line route classification in `src/lib/atelierSurface.ts`. Unrelated routes are unchanged.

## Out of scope

Talk, co-founder Studio, Work, authentication, persistence adapters, schemas, and the export renderer were not modified.
