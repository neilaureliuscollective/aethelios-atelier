# Source reconciliation manifest

Exact working branch: `cursor/atelier-premium-launch-readiness-da63`  
Inspected incoming head: `6f5dcedf906e26715c4d351227cb9614772dca7c`  
Application commit: `2c6a4c7`  
Resulting head: `2cc7a2c6a017a36cec495401bfc212ae1fe65e1e`  
This pass continues that branch. It does not reset to `main` and does not replace the application.

## Supplied attachments

| Item | Status | What was done |
| --- | --- | --- |
| `REHEARSAL.md` | Present at `/home/ubuntu/.cursor/projects/workspace/uploads/REHEARSAL.md_e898.txt` | Copied to `docs/launch/REHEARSAL.md`. Used as historical evidence of the Direction → Refine → Collection rehearsal against application source `99a7524d60b13f2c6a6579a5cea2913e08c71d27`. `e7c7c27` remains later rehearsal evidence only. Neither SHA exists in this repository. |
| `atelier-integrated-source.patch` | **Still missing** | Searched the workspace, `/tmp`, agent uploads, and public GitHub. The file is not a repository, has no base SHA, and cannot be applied. No weaker immersive Studio was invented to replace it. |

## Retained from PR #18 / this branch

- First-customer provisioning (`user_initial_business` + transactional `ensureForUser`)
- Guest claiming (`guest_work_claims`) and safe return destinations
- Explicit business / direction confirmation
- Inquiry-led pricing
- Official brand assets and the ivory / emerald-glass / gold system
- Auth.js / simulated-identity boundary, PWA cache `atelier-static-v9`, personalized `/companion` exclusion
- Existing companion Studio compositions, CAS saves, retained images, and shared preview/export rendering
- Layout tokens `square_announcement` / `portrait_social` / `story_portrait` / `website_banner` (Square social and Website banner already exist in this Studio)

## Retained from the rehearsal notes (evidence only)

The rehearsal describes Direction → Refine → Collection, BrandKit, Direction board, Continue in Studio, saved-versus-working comparison, and official Reserve-logo handling. Those application files are in the missing patch, not in this checkout. This pass does **not** reconstruct them from the write-up.

## Added in this pass (unblocked work)

- Confirmation now requires a signed-in owner and a server-side guest claim before a Discovery direction can be adopted
- The claimed payload is the source of truth; client/localStorage IDs must match it
- A failed guest claim blocks adoption
- Confirmation idempotently creates or resolves one editable Studio draft and returns its id
- Studio / confirm screens start in a genuine checking state
- Guest-claim inserts use `ON CONFLICT` / `INSERT OR IGNORE` so PostgreSQL never continues a failed unique-insert transaction
- Guest-brief adoption retries the whole transaction instead of catching unique and re-querying inside the aborted transaction

## Still blocked

1. Applying `atelier-integrated-source.patch` — exact missing source
2. Restoring BrandKit / Direction board / Collection from that patch
3. Hosted Auth.js, dedicated Postgres, artifact storage, and provider-backed generation
