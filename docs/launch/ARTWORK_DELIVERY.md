# Artwork delivery, recovery, and ownership

Application commit: `5d48e88f391017291d62630a662b34298b36354d`. This is local evidence, not hosted launch acceptance. Simulated identities are not Auth.js verification.

## Preserved from earlier PR #18 passes

Owner-bound guest claims, immutable Discovery revisions, BrandKit / `renderComposition`, visual snapshot adoption, retryable workspace verification, CAS saves, official-asset guards, Atelier emerald-glass chrome, and inquiry-led pricing. Homepage / services / intake positioning was not rewritten.

## Selection-level ownership

`guest_work_owners` is insert-once (`guest_work_id` primary key). The first `INSERT … ON CONFLICT DO NOTHING` assigns the owner even when no revision row exists yet. Revision payloads stay immutable. Same owner + same revision + same payload is idempotent. Foreign ownership and conflicting payloads fail explicitly.

Two independent PostgreSQL connections racing different revisions of an unclaimed selection: one owner wins. The loser cannot read, claim, or adopt any revision of that selection. Unrelated selections still progress.

## Saved export vs download

Studio now reports rendering, saving, saved, downloading, and download-failed separately. A successful save keeps the export ID, composition revision, and asset URL. Download Again retries that file. The UI does not claim the device stored a copy merely because a download was triggered.

After refresh or a new browser session, the latest `composition_export` for the open draft is recovered from the server asset list. localStorage is not the source of truth.

The previous solid-ivory PNG remains a low-level persistence/binding check (`owner_canvas_bound`). It is not finished-artwork acceptance.

What is verified: the client-rendered PNG is bound to a composition revision, stored, authorized, and re-delivered. What is not verified: the server independently re-rasterized every pixel. That would be a separate rendering-infrastructure project.

## Upload recovery

A failed logo upload keeps the existing logo, composition, and direction. The file input is cleared so the same file can be retried. Same-origin workspace images load without CORS tainting. Foreign hosts require CORS; a tainted canvas surfaces a meaningful export error.

## Two real UI exports

Production `next start` on port 3030, sqlite `.data-delivery`, simulated auth.

| Identity | Draft | Revision | SHA-256 | Bytes | Samples |
| --- | --- | --- | --- | --- | --- |
| Lumen House / ivory / Glass evening | `studio_aa3352ae-c55d-466a-9b93-a28df91f4dce` | `crev_3eecac66-29f9-4757-baab-9a8033983a98` | `e47ae6ab71393b5dda4e9ba53c764c3ac9e51a6ff2de2f4bc40b79691649308c` | 709926 | 11734 |
| Hearth Room / linen / Linen gathering | `studio_702cb606-bc32-4faf-a4a6-a3c5411e67a3` | `crev_72e47e26-be7d-4bbd-8c6b-6643545094d6` | `bcbd8852b908d9637da28d0c4806cd415b4b9c109637f94752e48477d9922ede` | 1270052 | 22687 |

Both files are 1600×1200 direction boards with visible photography, typography, and palette swatches — not solid PNGs. Output hash equals the downloaded SHA-256. Sign-out / sign-in / Download saved export returned the same Lumen bytes. Revision two draft `studio_a2db9c93-d387-4556-938d-a19cd276792b` did not replace the first draft or its export. Second account received **403** on the first account’s export URL.

Artifacts: `/opt/cursor/artifacts/exports/lumen-export.png`, `hearth-export.png`, `artwork-delivery.json`.
