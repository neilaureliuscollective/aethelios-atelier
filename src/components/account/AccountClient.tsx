"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { useSession } from "@/components/shell/SessionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { clearOwnerScopedData } from "@/lib/client/ownerScope";
import { firstLoginDestination } from "@/lib/account/firstLogin";
import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import { authSurfaceState, signInProviderSentence } from "@/lib/auth/signInCopy";
import { readGuestDraft } from "@/lib/guest/draft";
import { readGuestIntent } from "@/lib/guest/intent";
import type { User } from "@/lib/types";

type Config = {
  auth: {
    ready: boolean;
    adapter: string;
    labeled: boolean;
    missing?: string;
    identities: Array<{ email: string; role: string; label: string }>;
    providers: Array<{ id: "google" | "email"; label: string; capture?: boolean }>;
  };
};

function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  const intent = readGuestIntent();
  return safeCallbackUrl(next || intent?.destination || "/account/continue");
}

function authErrorNote(search: string) {
  const error = new URLSearchParams(search).get("error");
  if (error === "OAuthAccountNotLinked") {
    return "That Google account could not be attached to the existing Atelier account. Sign in with the method you used first, or use the same verified email.";
  }
  if (error === "AccessDenied") {
    return "Sign-in was refused. Google must present a verified email before this account can be used.";
  }
  return "";
}

export function AccountClient() {
  const { user, refresh } = useSession();
  const [config, setConfig] = useState<Config | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [guestDraft, setGuestDraft] = useState(false);
  const [verifyRequested, setVerifyRequested] = useState(false);

  useEffect(() => {
    void api<Config>("/api/config").then(setConfig).catch((err) => setError(actionErrorMessage(err, "Sign-in options could not load. Reload to retry.")));
    setGuestDraft(Boolean(readGuestDraft()));
    const params = new URLSearchParams(window.location.search);
    setVerifyRequested(params.has("verify"));
    const denied = authErrorNote(window.location.search);
    if (denied) setError(denied);
  }, []);

  async function signInSimulated(identityEmail: string) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await api<{ user: User; note: string }>("/api/session/sign-in", {
        method: "POST",
        body: JSON.stringify({ email: identityEmail })
      });
      setNote(result.note);
      await refresh();
      window.location.href = firstLoginDestination(nextPath(), guestDraft);
    } catch (err) {
      setError(actionErrorMessage(err, "Sign-in did not complete."));
    } finally {
      setPending(false);
    }
  }

  async function startProvider(provider: "google" | "email") {
    if (pending) return;
    if (provider === "email" && !email.trim()) {
      setError("Enter the email you want to sign in with.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await api<{ url?: string; note?: string; capture?: boolean; sent?: boolean }>(
        "/api/session/start",
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            email: email.trim() || undefined,
            callbackUrl: firstLoginDestination(nextPath(), guestDraft)
          })
        }
      );
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setNote(result.note ?? "Check your email for a sign-in link.");
      if (result.capture) {
        const captured = await api<{ url: string }>(
          `/api/session/email/captured?email=${encodeURIComponent(email.trim())}`
        );
        window.location.href = captured.url;
      }
    } catch (err) {
      setError(actionErrorMessage(err, "Sign-in did not start."));
      setPending(false);
    }
  }

  async function signOut() {
    if (pending) return;
    setPending(true);
    if (user) {
      ownerFence.markSignOut(user.id);
      clearOwnerScopedData(user.id);
    }
    try {
      await api("/api/session/sign-out", { method: "POST" });
      await refresh();
      window.location.href = "/account";
    } catch (err) {
      setError(actionErrorMessage(err, "Sign-out did not confirm. Local recovery for this account was still cleared."));
      setPending(false);
    }
  }

  const simulated = config?.auth.adapter === "simulated";
  const authjs = config?.auth.adapter === "authjs";
  const surface = authSurfaceState({ config, error });
  const enabledProviders = config?.auth.providers ?? [];

  return (
    <section className="container section">
      <p className="kicker">Account</p>
      <h1>{simulated ? "Identity for this local candidate." : "Your Atelier account."}</h1>
      <p className="lede">
        {user
          ? "This account is signed in. Signing in did not adopt a guest draft, submit a brief, or start a subscription."
          : surface === "loading"
            ? "Checking which sign-in options are available."
            : surface === "unavailable"
              ? "Sign-in could not be confirmed yet. Providers appear only when they are actually connected."
              : simulated
                ? "This is a labeled local test identity. It is not production sign-in. Signing in does not adopt a guest draft, submit a brief, or start a subscription."
                : signInProviderSentence(enabledProviders)}
      </p>
      {surface === "loading" ? (
        <p className="notice">Loading sign-in options…</p>
      ) : surface === "unavailable" ? (
        <p className="notice notice-warn">
          {config?.auth.missing ??
            error ??
            "Sign-in is not available here yet. The page will show the providers that are actually connected."}
        </p>
      ) : simulated ? (
        <p className="notice">These labeled identities are for isolated local testing only.</p>
      ) : (
        <p className="notice">
          Founder access is granted only to verified emails listed on the server.
        </p>
      )}
      {guestDraft ? (
        <p className="notice" style={{ marginTop: 16 }}>
          A guest brief is on this device. After you sign in, review it at Adopt before it is saved to this
          account.
        </p>
      ) : null}
      {user ? (
        <article className="surface-dense" style={{ padding: 24, marginTop: 20 }}>
          <p>
            Signed in as <strong>{user.displayName}</strong> ({user.email})
            {user.role === "founder" ? " · Founder" : ""}
            {simulated ? " · labeled local test identity" : ""}
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            <AppLink className="btn btn-gold" href="/account/continue">
              Continue
            </AppLink>
            {user.role === "founder" ? (
              <AppLink className="btn btn-ghost" href="/founder">
                Founder workspace
              </AppLink>
            ) : (
              <AppLink className="btn btn-ghost" href="/workspace">
                Commissions
              </AppLink>
            )}
            <AppLink className="btn btn-ghost" href="/install">
              Install on your phone
            </AppLink>
            <AppLink className="btn btn-ghost" href="/account/adopt">
              Review guest draft
            </AppLink>
            <button className="btn btn-ghost" type="button" disabled={pending} onClick={() => void signOut()}>
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </article>
      ) : (
        <div className="stack" style={{ marginTop: 20, maxWidth: 560 }}>
          {config?.auth.identities.map((identity) => (
            <button
              key={identity.email}
              className="btn btn-ghost"
              type="button"
              disabled={pending}
              onClick={() => void signInSimulated(identity.email)}
            >
              Use {identity.label} · {identity.email}
            </button>
          ))}
          {authjs && surface === "ready"
            ? enabledProviders.map((provider) =>
                provider.id === "google" ? (
                  <button
                    key="google"
                    className="btn btn-gold"
                    type="button"
                    disabled={pending}
                    onClick={() => void startProvider("google")}
                  >
                    {pending ? "Continuing…" : "Continue with Google"}
                  </button>
                ) : (
                  <form
                    key="email"
                    className="stack"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void startProvider("email");
                    }}
                  >
                    <label>
                      <span className="lbl">Email</span>
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        required
                      />
                    </label>
                    <button className="btn btn-ghost" type="submit" disabled={pending}>
                      {pending
                        ? "Sending link…"
                        : provider.capture
                          ? "Email me a captured sign-in link"
                          : "Email me a sign-in link"}
                    </button>
                    {provider.capture ? (
                      <p className="muted">
                        Local capture only. Hosted environments refuse this and require Resend or Google.
                      </p>
                    ) : null}
                  </form>
                )
              )
            : null}
        </div>
      )}
      {verifyRequested || note ? (
        <p className="notice" style={{ marginTop: 16 }}>
          {note || "Open the sign-in link from your email to finish. The guest draft stays on this device until you adopt it."}
        </p>
      ) : null}
      {error ? <p className="notice notice-warn" style={{ marginTop: 16 }}>{error}</p> : null}
    </section>
  );
}
