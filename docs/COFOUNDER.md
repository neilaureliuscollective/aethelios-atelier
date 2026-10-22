# Aethelios companion (digital co-founder V1)

Standalone feature area for Aethelios Atelier. This is not the main Aethelios Human Ascendance app, not Aethelios Reserve, and not Aurelius.

Owner-journey integration branch: `cursor/atelier-owner-journey-a72b`. Baseline `origin/main` `460994b` plus PR #9 `b6145b7` and Auth.js from PR #6. Isolated worktree: `/tmp/atelier-owner-journey`.

## Ownership

- This branch owns companion / Studio domain modules under `src/lib/cofounder`, `src/components/cofounder`, and `/companion` routes.
- Discovery presentation, cinematic public visuals, homepage composition, and shared visual tokens remain with the visual worker. Do not overwrite `src/app/page.tsx`, `src/app/globals.css`, or `src/components/discovery/**`.
- Shared integration is one header/workspace link plus existing session/persistence adapters.

## Auth contract

Companion membership is bound to `user.id` from the current session. Auth.js (Google / Resend) is integrated behind the same session cookie and identity model. Simulated identities remain the local default. Live voice stays gated: a successful SDP handshake is not a billed minute and does not commission voice.

## Isolated run

```bash
pnpm dev:cofounder
```

Serves port **3010** with `ATELIER_DIST_DIR=.next-cofounder` and `ATELIER_DATA_DIR=.data-cofounder`.

## Provider path

- Talk: Responses API streaming + function calling when `client.responses.create` exists; otherwise Chat Completions with a multi-turn tool loop. SSE is available from `POST /api/companion/talk` (`stream: true`).
- Studio images: official Images API `images.generate` and `images.edit` (default model `gpt-image-1` / `OPENAI_IMAGE_MODEL`). Remote image URLs are not fetched.
- Voice: explicit browser start/stop WebRTC. Server posts the SDP offer to OpenAI (`/v1/realtime/calls`, then `/v1/live/sessions`). Disabled honestly when `ATELIER_OPENAI_ENABLED` + `OPENAI_API_KEY` are not both set.
- Hosted file search, web search, and Code Interpreter are **not** enabled in V1 (authorization, cost, and account availability). Owner uploads stay in the Atelier database; text excerpts are read locally and can be deleted with the document.

## Document facts

Owners upload text or text-based PDFs on `/companion/business`, read them with page or part references, and confirm, edit, reject, or leave a candidate unresolved. Every document candidate stores document id, page, and excerpt. Talk and other model tools can read only files the owner selected as sources. Empty selection means no document text. Deleted files are removed from selection, pending candidates are rejected, and already-confirmed values stay with `sourceStatus: "stale"`. Document contents are untrusted input, not instructions. Conflicting confirmed values require an explicit replace or keep. Unconfirmed candidates are never trusted context.

`OPENAI_API_KEY` remains server-only. No `NEXT_PUBLIC` secrets.

## Entitlements

Server-checked plan budgets in `src/lib/cofounder/entitlements.ts`. Starting commercial terms exist as founder data only and are not rendered as checkout. Billing stays inactive.
