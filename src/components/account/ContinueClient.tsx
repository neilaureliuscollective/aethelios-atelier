"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { useSession } from "@/components/shell/SessionShell";
import { firstLoginState } from "@/lib/account/firstLogin";
import { INSTALL_COPY } from "@/lib/account/installCopy";
import { accountLink } from "@/lib/auth/continuation";
import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import { api } from "@/lib/client/api";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { readGuestDraft } from "@/lib/guest/draft";
import type { Project } from "@/lib/types";

export function ContinueClient() {
  const { user, loading } = useSession();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [guestDraft, setGuestDraft] = useState(false);
  const [intended, setIntended] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setGuestDraft(Boolean(readGuestDraft()));
    setIntended(safeCallbackUrl(new URLSearchParams(window.location.search).get("next"), ""));
  }, []);

  useEffect(() => {
    if (!user) {
      setProjects(null);
      return;
    }
    void api<{ projects: Project[] }>("/api/projects")
      .then((result) => setProjects(result.projects))
      .catch((err) => setError(actionErrorMessage(err, "Saved work could not be loaded.")));
  }, [user]);

  if (loading) {
    return (
      <section className="container section">
        <p className="kicker">Welcome</p>
        <h1>Checking this account…</h1>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="container section">
        <p className="kicker">Welcome</p>
        <h1>Sign in to return to your work.</h1>
        <p className="lede">
          An Atelier account is free. It does not start a subscription, create a payment, or grant
          founder access.
        </p>
        <a className="btn btn-gold" href={accountLink(intended || "/account/continue")}>
          Sign in
        </a>
      </section>
    );
  }

  const state = firstLoginState({
    role: user.role,
    projects: projects ?? [],
    hasGuestDraft: guestDraft,
    intended
  });
  const primary = state.actions.find((action) => action.kind === "primary");
  const secondary = state.actions.filter((action) => action.href !== primary?.href);

  return (
    <section className="container section">
      <p className="kicker">{user.displayName}</p>
      <h1>{state.title}</h1>
      <p className="lede">{state.lede}</p>
      {error ? <p className="notice notice-warn">{error}</p> : null}
      {projects === null && !error ? <p className="notice">Looking for saved work on this account…</p> : null}
      <div className="row" style={{ marginTop: 20 }}>
        {primary ? (
          <AppLink className="btn btn-gold" href={primary.href}>
            {primary.label}
          </AppLink>
        ) : null}
        {secondary.slice(0, 3).map((action) => (
          <AppLink className="btn btn-ghost" href={action.href} key={action.href}>
            {action.label}
          </AppLink>
        ))}
      </div>
      <article className="surface-dense" style={{ padding: 24, marginTop: 28, maxWidth: 640 }}>
        <p className="tiny">{INSTALL_COPY.kicker}</p>
        <h2 style={{ fontSize: 28 }}>{INSTALL_COPY.title}</h2>
        <p className="muted">{INSTALL_COPY.lede}</p>
        <div className="row" style={{ marginTop: 12 }}>
          <AppLink className="btn btn-ghost" href="/install">
            Phone install steps
          </AppLink>
        </div>
      </article>
    </section>
  );
}
