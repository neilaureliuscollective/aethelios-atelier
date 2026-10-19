"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { useSession } from "@/components/shell/SessionShell";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { ownerFence } from "@/lib/client/ownerFence";
import { clearOwnerScopedData } from "@/lib/client/ownerScope";
import type { User } from "@/lib/types";

type Config = {
  auth: {
    ready: boolean;
    adapter: string;
    identities: Array<{ email: string; role: string; label: string }>;
  };
};

export function AccountClient() {
  const { user, refresh } = useSession();
  const [config, setConfig] = useState<Config | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    void api<Config>("/api/config").then(setConfig);
  }, []);

  async function signIn(email: string) {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const result = await api<{ user: User; note: string }>("/api/session/sign-in", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setNote(result.note);
      await refresh();
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next?.startsWith("/") ? next : "/account";
    } catch (err) {
      setError(actionErrorMessage(err, "Sign-in did not complete."));
    } finally {
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

  return (
    <section className="container section">
      <p className="kicker">Account</p>
      <h1>Identity for this local candidate.</h1>
      <p className="lede">
        This is a labeled simulated identity adapter. It is not production authentication. Signing in
        does not adopt a guest draft and does not submit a brief.
      </p>
      {!config?.auth.ready ? (
        <p className="notice notice-warn">
          Auth is unconfigured. Simulated identities stay off unless the isolated-local simulator gate
          is enabled. No hosted identity provider is connected.
        </p>
      ) : (
        <p className="notice">Simulated identities are for isolated local testing only.</p>
      )}
      {user ? (
        <article className="surface-dense" style={{ padding: 24, marginTop: 20 }}>
          <p>
            Signed in as <strong>{user.displayName}</strong> ({user.email}) · {user.role} · {user.adapter}
          </p>
          <div className="row" style={{ marginTop: 16 }}>
            {user.role === "founder" ? (
              <AppLink className="btn btn-gold" href="/founder">
                Founder workspace
              </AppLink>
            ) : (
              <AppLink className="btn btn-gold" href="/workspace">
                Open workspace
              </AppLink>
            )}
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
              onClick={() => void signIn(identity.email)}
            >
              Use {identity.label} · {identity.email}
            </button>
          ))}
        </div>
      )}
      {note ? <p className="notice" style={{ marginTop: 16 }}>{note}</p> : null}
      {error ? <p className="notice notice-warn" style={{ marginTop: 16 }}>{error}</p> : null}
    </section>
  );
}
