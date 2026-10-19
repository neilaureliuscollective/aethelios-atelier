"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { api } from "@/lib/client/api";
import type { User } from "@/lib/types";

type Config = {
  auth: {
    ready: boolean;
    adapter: string;
    identities: Array<{ email: string; role: string; label: string }>;
  };
};

export function AccountClient() {
  const [user, setUser] = useState<User | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    void (async () => {
      const session = await api<{ user: User | null }>("/api/session");
      setUser(session.user);
      setConfig(await api<Config>("/api/config"));
    })();
  }, []);

  async function signIn(email: string) {
    const result = await api<{ user: User; note: string }>("/api/session/sign-in", {
      method: "POST",
      body: JSON.stringify({ email })
    });
    setUser(result.user);
    setNote(result.note);
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next?.startsWith("/") ? next : "/account";
  }

  async function signOut() {
    await api("/api/session/sign-out", { method: "POST" });
    window.location.href = "/account";
  }

  return (
    <section className="container section">
      <p className="kicker">Account</p>
      <h1>Identity for this local candidate.</h1>
      <p className="lede">
        This is a labeled simulated identity adapter. It is not production auth. Signing in does not
        adopt a guest draft and does not submit a brief.
      </p>
      {!config?.auth.ready ? (
        <p className="notice notice-warn">
          Auth is unconfigured. Set ATELIER_AUTH_ADAPTER=simulated to use local identities. No hosted
          connection is available.
        </p>
      ) : null}
      {user ? (
        <article className="panel" style={{ padding: 24, marginTop: 20 }}>
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
            <button className="btn btn-ghost" type="button" onClick={() => void signOut()}>
              Sign out
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
              onClick={() => void signIn(identity.email)}
            >
              Use {identity.label} · {identity.email}
            </button>
          ))}
        </div>
      )}
      {note ? <p className="notice" style={{ marginTop: 16 }}>{note}</p> : null}
    </section>
  );
}
