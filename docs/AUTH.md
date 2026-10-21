# Real authentication (Auth.js)

Atelier uses [Auth.js](https://authjs.dev) (`next-auth` v5), the library [Next.js documents for production authentication](https://nextjs.org/docs/app/guides/authentication). Permissions are enforced in route handlers and `ProjectService`, not by hiding buttons.

This is the identity interface the rest of the app already uses:

- `readSession()` / `requireSession()` / `publicUser()` / `clearSession()`
- `GET /api/session`
- `POST /api/session/sign-out`
- Owner and founder checks where projects, proposals, and review history are read or changed

Auth.js proves the email. Atelier stores the user and session in the existing database (`users`, `sessions`) plus additive `auth_accounts` and `auth_verification_tokens` tables. Discovery, workspace, and founder screens are unchanged.

## Provider selection

Hosted production sign-in is **Google** and/or **email magic links via Resend**.

| Provider | When to use | Required secrets |
| --- | --- | --- |
| Google | Clients who prefer one-click sign-in | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` |
| Resend email | Anyone with an inbox; works without Google | `AUTH_RESEND_KEY`, `AUTH_RESEND_FROM` |

At least one of those pairs must be set or Auth.js stays **unready**. Empty values do not count. There is no credentials/password provider and no fake production sign-in.

Local email capture (`ATELIER_AUTH_EMAIL_CAPTURE=true`) is the same magic-link protocol with the link stored in process memory instead of sent. Hosted platforms always refuse capture, even if the flag is copied.

Simulated identities remain available on isolated local machines only (`ATELIER_AUTH_ADAPTER=simulated`). They are refused on Vercel.

## Hosted activation (Vercel)

Do this after the dedicated Atelier Postgres database is connected. Do not reuse Aethelios production credentials.

1. Create a Google OAuth client (APIs & Services → Credentials) with authorized redirect URI:
   - `https://<your-atelier-domain>/api/auth/callback/google`
   - Also add the `*.vercel.app` callback if you will test on the Vercel preview URL.
2. Optional but recommended: create a [Resend](https://resend.com) API key and a from-address that Resend can send.
3. In the Vercel project, set:

| Name | Value |
| --- | --- |
| `ATELIER_AUTH_ADAPTER` | `authjs` |
| `AUTH_SECRET` | 32+ random bytes (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `ATELIER_SESSION_SECRET` | Same value as `AUTH_SECRET`, or omit if `AUTH_SECRET` is set |
| `ATELIER_PUBLIC_ORIGIN` | Canonical `https://` origin |
| `AUTH_TRUST_HOST` | `true` |
| `ATELIER_FOUNDER_EMAILS` | Comma-separated verified emails that receive the founder role (Neil’s Google or inbox address). Do not guess this value. |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_RESEND_KEY` | Resend API key (if using email) |
| `AUTH_RESEND_FROM` | Verified from address, e.g. `Atelier <signin@your-domain>` |

4. Redeploy. `GET /api/health` should report `auth.adapter: "authjs"` and `auth.ready: true`.
5. Sign in once with the founder email listed in `ATELIER_FOUNDER_EMAILS`. Google must present a verified email. Founder authorization is recomputed on the server from that list plus provider verification evidence.

## Verification and account linking

- Google sign-in is refused unless the provider profile includes `email_verified: true`. A present email is not enough.
- Role, email, and verification are never taken from the client. Founder is assigned only when the verified email is on `ATELIER_FOUNDER_EMAILS`.
- Atelier does not invent an `email_verified_at` timestamp. The adapter stores the date Auth.js received from the provider, or keeps an existing one.
- Same-email linking is allowed only when both the incoming provider evidence and the existing account are already verified. An unverified stub cannot be claimed, and an unverified Google profile cannot attach to a real account.
- Creating an Atelier account is free. It does not start a subscription, create a payment, or grant founder access.

Do **not** set on Vercel:

- `ATELIER_ALLOW_SIMULATED_AUTH`
- `ATELIER_ISOLATED_LOCAL`
- `ATELIER_AUTH_EMAIL_CAPTURE`
- Placeholder Google or Resend values

Until those hosted secrets exist, public pages still render and account routes report the missing configuration instead of claiming sign-in works.

## Local Auth.js (optional)

Keep `.env.local` on `simulated` for everyday Discovery/workspace work. To exercise the real adapter locally:

```bash
ATELIER_AUTH_ADAPTER=authjs
ATELIER_AUTH_EMAIL_CAPTURE=true
ATELIER_ISOLATED_LOCAL=true
ATELIER_PUBLIC_ORIGIN=http://127.0.0.1:3000
AUTH_SECRET=<32+ characters>
ATELIER_FOUNDER_EMAILS=founder.auth@atelier.invalid
```

Then `pnpm build && pnpm test:auth`.

## Guest drafts

Sign-in never adopts or submits a device draft. After an account exists, `/account/adopt` copies the brief only when `confirmed: true`.

## Google pilot check (Neil)

Automated tests cover Auth.js email capture and simulated identities. They cannot click a real Google account. After this branch is deployed to a preview (not production), run this once with a second Google account that is **not** on `ATELIER_FOUNDER_EMAILS`:

1. Open the preview URL on your phone. Confirm the public site, `/install`, and Sign in.
2. Sign in with that second Google account. You should land on Continue. The account is free; you should not see Founder.
3. Start a project, write a distinctive sentence, save until the status says the server saved it, sign out, sign in again, and confirm the sentence is still there.
4. Review and send once. Confirm the receipt says submitted, not accepted or paid.
5. Sign in with your founder Google account. Open Founder. Confirm that request, the exact sentence, the selected interests, and the timestamp.
6. Sign back in as the second account and confirm you cannot open `/founder` or another client’s workspace by changing the URL.
