# Artwork delivery, recovery, and ownership

Artwork-delivery application commit: `5d48e88f391017291d62630a662b34298b36354d`.  
Exact-draft export-binding pass continues that work. This is local evidence, not hosted launch acceptance. Simulated identities are not Auth.js verification.

## Exact-draft export binding

`savedExport` is rebound on every draft, workspace, and owner change. Selecting an unexported draft clears the previous draft’s download control and status. A request started for draft A cannot write status or bytes onto draft B. When the same draft is edited after export, the UI labels the stored file as an earlier revision instead of implying the current edits were exported. Download-again retries the existing artifact.

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

A failed logo upload keeps the existing logo, composition, and direction. Empty `file.type` is no longer sent as `image/png`. The file input is cleared so the same file can be retried. Same-origin workspace images load without CORS tainting. Foreign hosts require CORS; a tainted canvas surfaces a meaningful export error.

## Strict local UI acceptance (this pass)

Production `next start` on port 3030, sqlite `.data-export-bind`, simulated auth. Preview/export raster tolerance is **2**. Real Export control, real browser downloads, no API fallback counted as UI-download evidence.

| Identity | Layout | Draft | Revision | SHA-256 | Bytes | Samples | Preview Δ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Lumen House / ivory / Glass reserved | direction_board 1600×1200 | `studio_b68f14a4-876c-4e5f-97bf-c827d4128dca` | `crev_5b5514c1-baa3-441a-8cb1-ce50f3dc1367` | `2b96cf119c36319555fa80047179828c544bfa3faa27264600452626e8eef22c` | 664221 | 10904 | 0 |
| Hearth Room / linen / Linen reserved | square_announcement 1080×1080 | `studio_c157fc1c-45df-44be-9929-b3ea64a865ec` | `crev_d5804854-5c3a-4bf9-8714-4e7e3b20431b` | `017c4ab36775849a991b820d73bfd83cf37801de4d36a9966297a5aa03730176` | 1304184 | 25818 | 0 |

A→B→A: unexported draft `studio_26fdf3a9-2124-4427-b654-5696ec98a700` never bound Lumen’s export. Failed download left one artifact; Download again returned the same SHA-256. Signed-out GET: **401** `{ok:false,error:"unauthenticated"}`. Second account: **403** `{ok:false,error:"forbidden"}`. Missing asset: **404** `{ok:false,error:"not_found"}`. Reopen UI download matched. Revision two draft `studio_1f78f004-252f-4307-a638-9086468523ad` did not replace the first export.

Found during later same-draft edit: headline `Glass reserved later` overflowed the direction-board preview (`Preview unavailable`). The earlier export stayed labeled and downloadable. That is an authoring constraint, not a new visual build.

Artifacts: `/opt/cursor/artifacts/exports/export_bind_lumen_direction_board.png`, `export_bind_hearth_square_social.png`, `export_bind_artwork-delivery.json`.
