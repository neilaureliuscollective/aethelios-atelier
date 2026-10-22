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
| GitHub Actions `check` | Workflow exists | — | PR #25 `check` run `39777597733` on `cursor/no-account-inquiry-6a72` completed SUCCESS at 2026-10-22 07:22 America/Chicago | Earlier account-billing blocks on older SHAs are not this row. |
| Vercel preview | Hosting adapter exists | Preview deploys are not this row | No | A READY Vercel check is not public access. See Mode A rehearsal below. |
| Business website journey | Homepage / Discover / project intake, save, submit, founder proposal, exact-revision acceptance | Local simulated identities and SQLite | No | Repeat the same journey with two real provider accounts on the hosted origin. |
| Custom workflow journey | Secondary `/custom-projects` route, tailored intake without brand or booking, context-scoped proposal | Local simulated identities and SQLite | No | Repeat with a real provider account. Context must still reach the founder snapshot and proposal seed. |

## Mode A hosted conversion rehearsal — 2026-10-22 (America/Chicago)

Mode A is a public conversion site plus no-account inquiry. Companion auth, Postgres, and paid AI are not required for this row.

Checked at 07:32–07:41 America/Chicago against:

- Preview: `https://aethelios-atelier-git-cursor-no-account-in-f71e42-stutes-legacy.vercel.app`
- Team default: `https://aethelios-atelier-stutes-legacy.vercel.app`
- Custom hosts attempted: `atelier.aethelios.com`, `aetheliosatelier.com`, `www.aetheliosatelier.com`

| Concern | Result | Evidence |
| --- | --- | --- |
| CI `check` | Verified | GitHub Actions run `39777597733` SUCCESS. |
| Vercel build | READY, not public | Vercel status SUCCESS. `GET /`, `/inquire`, `/pricing`, `/founder`, and `POST /api/inquiries` return `302`/`401` `Protected by Vercel Authentication`. |
| Public conversion pages | Missing or blocked | Browser on `/inquire` and `/` shows only the Vercel login wall (email / Google / GitHub / ChatGPT / SAML / passkey). A stranger cannot see the Atelier form. |
| Inquiry delivery | Missing or blocked | Inquiry contract not reachable on hosted origins. Local capture is refused on Vercel by design. Inbox + Resend still unnamed. |
| Custom domain | Missing or blocked | Hostnames do not resolve (`curl` code `000`). |

This is not an Atelier code defect. Deployment Protection is enabled on the Vercel project, so preview and the team `*.vercel.app` hostname are SSO-gated. Until that gate is opened for the public origin, no prospect can start a project.

### Remaining founder actions for Mode A

An authorized operator — not this agent — must:

1. Review and merge [PR #25](https://github.com/neilaureliuscollective/aethelios-atelier/pull/25) (CI is green; this agent cannot merge).
2. Disable Vercel Deployment Protection on the public production hostname, or assign a custom domain that is not SSO-gated. Keep preview protection if you want; production must be reachable without a Vercel login.
3. Set `ATELIER_INQUIRY_TO` to a real mailbox you check. Do not invent one here.
4. For direct send (preferred): set `AUTH_RESEND_KEY` and `AUTH_RESEND_FROM`. Do not copy `ATELIER_INQUIRY_CAPTURE` to Vercel.
5. Assign the public domain (none of the attempted hostnames resolve today).
6. From a phone that is not signed into Vercel, complete `/inquire` and confirm the message arrives.

Until steps 2–6 happen, hosted inquiry is not live. Local rehearsal on this branch already proves the form and fail-closed hosted capture refusal.

## Precise remaining authorized companion rehearsal (not Mode A)

An authorized operator — not this agent — must, on a dedicated Atelier environment:

1. Set `ATELIER_AUTH_ADAPTER=authjs` with a 32+ `AUTH_SECRET`, `ATELIER_PUBLIC_ORIGIN` equal to the live callback origin, and at least one existing provider pair (Google and/or Resend). Do not invent a second IdP.
2. Point `ATELIER_PERSISTENCE_ADAPTER=postgres` at a dedicated Atelier database. Additive schema only. Do not migrate or reuse Aethelios production data.
3. Sign in with two real provider accounts. Confirm a direction, open the adopted draft, export, download through the visible UI, sign out, return, and re-download the same bytes.
4. Prove the second account receives `403 forbidden` on the first account’s export URL, a signed-out request receives `401 unauthenticated`, and a missing asset receives `404 not_found`.
5. Leave paid OpenAI / voice off unless a separate spend approval exists.

Displayed public plan prices and a green local build do not complete this rehearsal and are not launch verification.

Do not ask for a new architecture. The current Auth.js, PostgreSQL, and private artifact-storage implementation already supports this rehearsal.

## Explicitly not this rehearsal

Simulated identities, local SQLite or memory, disposable `atelier_*_test` databases, a production build, a READY Vercel deployment, and matching headlines on generic artwork.
