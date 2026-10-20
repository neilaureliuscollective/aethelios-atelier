# Aethelios companion (digital co-founder V1)

Standalone feature area for Aethelios Atelier. This is not the main Aethelios Human Ascendance app, not Aethelios Reserve, and not Aurelius.

Base for this V1 branch: `79ec8a51f808677834b6209970cad04178760b9a` (`origin/main` at branch creation).

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

- Talk: existing Chat Completions tools, plus Responses API when the installed OpenAI SDK exposes `client.responses.create`.
- Studio images: official Images API (`images.generate`, default model `gpt-image-1` / `OPENAI_IMAGE_MODEL`).
- Voice: explicit browser start/stop WebRTC. Server posts the SDP offer to OpenAI (`/v1/realtime/calls`, then `/v1/live/sessions`). Disabled honestly when `ATELIER_OPENAI_ENABLED` + `OPENAI_API_KEY` are not both set.
- Hosted file search, web search, and Code Interpreter are **not** enabled in V1 (authorization, cost, and account availability). Owner uploads stay in the Atelier database and can be deleted with the document.

`OPENAI_API_KEY` remains server-only. No `NEXT_PUBLIC` secrets.

## Entitlements

Server-checked plan budgets in `src/lib/cofounder/entitlements.ts`. Starting commercial terms exist as founder data only and are not rendered as checkout. Billing stays inactive.
