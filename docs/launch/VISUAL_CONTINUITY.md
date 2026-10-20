# Visual-brand continuity evidence

This records the local candidate from application commit `a5f109a9ba7270c4c47a9fcbf1a096276aa6a4ac`. It is not hosted launch acceptance.

## Identities

Two genuinely different brand identities were confirmed, opened in Studio, saved, exported, and reopened.

| Identity | Palette | Visual direction | Headline | Canvas |
| --- | --- | --- | --- | --- |
| Lumen House | `ivory_hall` `#F4F0E6` | `glass` | Glass evening | Light architectural paper |
| Hearth Room | `hearth_linen` `#1A1612` | `material` | Linen gathering | Dark tactile linen |

Lumen House then revised Discovery to `signal_ink` / `graphic` with headline **A clear mark**. Explicit replacement adopted revision 2 and created a second draft. Reopening the first draft still showed **Glass evening** on ivory paper.

## Browser drafts (simulated auth, production `next start`, `.data-visual`)

| Draft | Id |
| --- | --- |
| Lumen revision 1 | `studio_cfe3c083-fac3-467d-80c5-1cbebf6f50a9` |
| Hearth revision 1 | `studio_b36042f2-38e5-4a8b-8725-d11dec8ee601` |
| Lumen revision 2 | `studio_ade51dc3-8d84-4fd0-8274-ae1f059502f5` |

## API journey drafts (same local server, earlier in the run)

| Draft | Id |
| --- | --- |
| Lumen revision 1 | `studio_c4add46a-c04f-49d4-97c1-21f281e8222a` |
| Hearth revision 1 | `studio_22daf1a8-03a5-4a51-9774-e4f71686bfd6` |
| Lumen revision 2 | `studio_8b4a9fd2-6d3e-425c-aa17-f197da7f1118` |

## Export binding

API journey export of the preserved Lumen draft:

- SHA-256 `ab6b8492d0d565cba5fdaf31a9b92993e0f6fb74b0a81a132255655690f70006`
- 9551 bytes, PNG signature
- Labelled owner-canvas-bound solid ivory (`#F4F0E6`), not a server-rasterized composition
- Owner session can read the bytes; the second simulated account cannot

Studio preview and export share `renderComposition`. The API journey uses a bound solid PNG to prove authorization and hash binding without treating a flattened export as an editable source.

## Isolation

The second simulated account received **404** for the first account’s draft id and could not read export bytes.

## Screenshots

Captured under `/opt/cursor/artifacts/screenshots/`:

- `visual_lumen_studio_1440w.png` / `_884w.png` / `_390w.png` — ivory Glass evening
- `visual_hearth_studio_1440w.png` / `_884w.png` / `_390w.png` — dark Linen gathering
- `visual_revision_two_confirm_1440w.png` — Signal revision 2 with explicit keep-first-draft adoption
- `visual_revision_two_studio_1440w.png` — A clear mark on signal ink
- `visual_revision_one_preserved_1440w.png` — first Lumen draft still Glass evening
- `visual_lumen_reopened_1440w.png` — same composition after a fresh sign-in
- `visual_lumen_foreign_blocked_1440w.png` — second account blocked

The browser capture ran on the same `.data-visual` store as the API journey, so the first confirm screenshots can show a leftover “newer revision waiting” banner. Studio canvases still render the selected identity.

## Scripts

- `scripts/visual-identity-journey.mjs` — 21/21 against production `next start` on port 3020
- `scripts/visual-identity-capture.mjs` — viewport captures above
