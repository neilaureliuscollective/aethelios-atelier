# Aethelios companion (digital co-founder V1)

Standalone feature area for Aethelios Atelier. This is not the main Aethelios Human Ascendance app, not Aethelios Reserve, and not Aurelius.

Base for this V1 branch: `79ec8a51f808677834b6209970cad04178760b9a` (`origin/main` at branch creation). Isolated worktree: `/home/ubuntu/atelier-cofounder` on `cursor/atelier-digital-cofounder-v1-38aa`.

## Ownership

- This branch owns companion / Studio domain modules under `src/lib/cofounder`, `src/components/cofounder`, and `/companion` routes.
- Discovery presentation, cinematic public visuals, homepage composition, and shared visual tokens remain with the visual worker. Do not overwrite `src/app/page.tsx`, `src/app/globals.css`, or `src/components/discovery/**`.
- Shared integration is one header/workspace link plus existing session/persistence adapters.

## Auth contract

`main` still uses the labeled simulated-identity adapter (`src/lib/auth/session.ts`). The Auth.js branch `cursor/real-auth-accounts-63da` is **not merged**. Companion membership is bound to `user.id` from the current session so a later Auth.js merge does not require a second identity system.

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

## Document intake

Owners can upload a text-based PDF or existing text format on `/companion/business`, read it with page or part references, choose services / products / audience / brand voice / brand notes, review the proposed change beside the current field, and confirm once. Confirmed values are saved on the business profile with document provenance (`owner_confirmed_from_document`, document id, page, excerpt).

This version does not crawl websites, add an integration marketplace, or open a new chatbot. OpenAI file inputs are not used here. `sourceDocumentIds` records which files contributed confirmed facts; it is **not** an “excluded from AI” control. Talk still does not fully enforce source selection.

`OPENAI_API_KEY` remains server-only. No `NEXT_PUBLIC` secrets.

## Entitlements

Server-checked plan budgets in `src/lib/cofounder/entitlements.ts`. Starting commercial terms exist as founder data only and are not rendered as checkout. Billing stays inactive.
