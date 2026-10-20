# Hosted rehearsal checklist

Secret-free. This does not create credentials, alter hosted settings, migrate live data, start paid AI/voice, or deploy.

Configuration presence is not proof that a connection works. Simulated identities (`owner.local@atelier.invalid`, `owner-two.local@atelier.invalid`) are not Auth.js verification.

Statuses used below:

- **Implemented in code** — the existing Auth.js, PostgreSQL, and private artifact-storage paths already do this.
- **Configured, but not verified** — a local or example value exists; no real hosted journey has used it.
- **Verified through a real hosted journey** — a production-like origin, real provider accounts, and durable hosted storage were exercised.
- **Missing or blocked** — required hosted value or authorization is absent, or an external gate refused to run.

Local `.env.local` on this machine: `ATELIER_AUTH_ADAPTER=simulated`, `ATELIER_PERSISTENCE_ADAPTER=sqlite_local`, `ATELIER_ISOLATED_LOCAL=true`, `ATELIER_ALLOW_SIMULATED_AUTH=true`, `ATELIER_OPENAI_ENABLED=false`, `ATELIER_BILLING_ENABLED=false`. Public origin hostname is loopback `127.0.0.1`. No Google, Resend, `AUTH_SECRET`, or hosted `DATABASE_URL` / `POSTGRES_URL` value is present. Session-secret and OpenAI-key slots exist empty. Founder-email and adapter flags are local-only.

| Concern | Implemented in code | Configured, but not verified | Verified through a real hosted journey | Missing or blocked |
| --- | --- | --- | --- | --- |
| Callback origin / provider | Auth.js Google and Resend adapters, pathname-safe callback, `ATELIER_PUBLIC_ORIGIN` for `metadataBase` / Auth.js | Local origin is loopback HTTP. Example file documents hosted `https://` origin and `/api/auth/callback/google` | No | Hosted `ATELIER_PUBLIC_ORIGIN` matching the deployed callback URL. Google and/or Resend credentials. `ATELIER_AUTH_ADAPTER=authjs`. `AUTH_SECRET` 32+. |
| Durable database | PostgreSQL adapter, additive schema, `guest_work_owners`, composition revisions, advisory-lock init | Local disposable Postgres used for isolated tests only | No | Dedicated Atelier `DATABASE_URL` / `POSTGRES_URL`. Do not reuse the Aethelios production database. |
| Private artifact storage | Owner-bound blob reads via session membership; unguessable URL is not authorization | Local sqlite blobs in `.data` / `.data-delivery` | No | Hosted private blob store on the dedicated database / volume. Authenticated GET of the stored PNG. |
| Authenticated private downloads | `GET /api/companion/assets/:id` requires session + workspace membership | Local simulated session downloads | No | Same download after a real provider sign-in on the hosted origin. |
| Two-account isolation | Foreign workspace → `403 {ok:false,error:"forbidden"}`; missing asset on own workspace → `404 {ok:false,error:"not_found"}`; signed-out → `401 {ok:false,error:"unauthenticated"}` | Local simulated two-account proof | No | Two real provider accounts on the hosted origin. A 500 is not isolation evidence. |
| Logout / return | Sign-out invalidates the session; reopen + sign-in recovers the same draft export | Local simulated sign-out / sign-in | No | Hosted provider logout and return to the same origin. |
| Provider capabilities | Fail-closed OpenAI / voice; no second auth or storage platform | `ATELIER_OPENAI_ENABLED=false`; billing off | No | Spend approval before any paid AI or voice call. Not required to finish this local phase. |
| GitHub Actions `check` | Workflow exists | — | No | Billing / spending limit. A never-started or two-second failed job is not a passing suite. |
| Vercel preview | Hosting adapter exists | Preview deploys are not this row | No | A successful deployment is not functional acceptance. |

## Precise remaining authorized hosted rehearsal

An authorized operator — not this agent — must, on a dedicated Atelier environment:

1. Set `ATELIER_AUTH_ADAPTER=authjs` with a 32+ `AUTH_SECRET`, `ATELIER_PUBLIC_ORIGIN` equal to the live callback origin, and at least one existing provider pair (Google and/or Resend). Do not invent a second IdP.
2. Point `ATELIER_PERSISTENCE_ADAPTER=postgres` at a dedicated Atelier database. Additive schema only. Do not migrate or reuse Aethelios production data.
3. Sign in with two real provider accounts. Confirm a direction, open the adopted draft, export, download through the visible UI, sign out, return, and re-download the same bytes.
4. Prove the second account receives `403 forbidden` on the first account’s export URL, a signed-out request receives `401 unauthenticated`, and a missing asset receives `404 not_found`.
5. Leave paid OpenAI / voice off unless a separate spend approval exists.

Do not ask for a new architecture. The current Auth.js, PostgreSQL, and private artifact-storage implementation already supports this rehearsal.

## Explicitly not this rehearsal

Simulated identities, local SQLite or memory, disposable `atelier_*_test` databases, a production build, a READY Vercel deployment, and matching headlines on generic artwork.
