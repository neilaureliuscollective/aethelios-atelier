# Source reconciliation manifest

Exact working branch: `cursor/atelier-premium-launch-readiness-da63`  
Inspected incoming head: `a8aabc60d0b91c17bbe1d117443ea4e67a2584f6`  
Application commit: `a5f109a9ba7270c4c47a9fcbf1a096276aa6a4ac`  
This pass continues that branch. It does not reset to `main` and does not replace the application.

## Immersive source attachment

| Item | Status |
| --- | --- |
| Path | `/home/ubuntu/.cursor/projects/workspace/uploads/atelier-immersive-source_a958.txt` |
| Size | 283,258 bytes |
| SHA-256 | `6ad51b91012226ae59a5e4d71fd30d6551ee9b753963d634b000b2eec352db35` |
| Kind | Complete original Git patch with a `.txt` extension |

The attachment matched the expected size and hash before Studio work began. `REHEARSAL.md` was not treated as the missing source.

## Applicability

- Forward `git apply` of the patch onto `a8aabc6` failed on already-evolved files (`AccountClient`, `CompanionShell`, `StudioClient`, `DiscoveryStudio`, companion persistence).
- Reverse apply does not apply (expected: the patch is not the inverse of this branch).
- `git apply --3way` applied the recovered immersive Studio. Four UI files conflicted and were reconciled by hand.

## File-by-file reconcile

### Applied from the immersive patch (kept)

BrandKit, `renderComposition`, `studioAssets`, Direction → Refine → Collection, `CompositionStudy`, `BrandDirectionImport`, `MotionPreferences`, `studioStage.module.css`, `direction_board`, paper fallback palette, continuation helpers, review scripts, and identity persistence columns.

### Preserved from Phase B (not overwritten)

Owner-bound guest claims, transactional adoption, exact-draft navigation, idempotent identical adoption, checking states, provisioning uniqueness, revision-aware CAS saves, pricing, official assets, and security boundaries.

### Hand-merged UI

| File | Resolution |
| --- | --- |
| `AccountClient.tsx` | Keep guest intent **and** `signInDestination`. |
| `CompanionShell.tsx` | Keep confirm/checking gates, `accountLink`, and a retryable workspace-error gate. Failed verification is never treated as ready. |
| `StudioClient.tsx` | Keep `checking\|ready\|error` **and** immersive Direction/Refine/Collection, compare-saved, and exact-draft open (`draftId` or confirmation `studioDraftId`). |
| `DiscoveryStudio.tsx` | Confirmed continue still goes through `/companion/confirm`, not a silent Studio skip. |

## Visual-brand continuity added in this pass

- Guest claims are immutable and owner-bound per `(guest_work_id, source_revision)`.
- Same selection/revision + identical payload is an idempotent retry.
- Same revision + different content conflicts.
- A newer revision is claimable and explicitly adoptable. The older snapshot and first Studio draft stay.
- `parseClaimedDiscovery` carries palette, visual direction, layout, and a parseable selection.
- `createFromConfirmedSnapshot` builds BrandKit + designSpec artwork (`direction_board`) instead of default square layers.
- Confirmation opens that exact draft. Preview/export continue to share `renderComposition`.

## Artwork-delivery recovery patch

`docs/launch/atelier-artwork-delivery.patch` is the recoverable diff of this pass against `b7e47e0`.

## Visual-continuity recovery patch

`docs/launch/atelier-visual-continuity.patch` is the recoverable diff of `a5f109a` against `a8aabc6` (382,993 bytes, SHA-256 `6357848f90527635509786b49620ec628af992b2a7aaf74c0757f7ead0af9e00`).

## Still separate hosted gates

Hosted Auth.js, durable hosted storage, and live provider acceptance remain outside this candidate. See `HOSTED_ACTIVATION.md`.
