"use client";

import { useEffect, useRef, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { accountLink, afterAdoption } from "@/lib/auth/continuation";
import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import { FIELD_LABELS } from "@/lib/brief";
import { api } from "@/lib/client/api";
import { ownerFence } from "@/lib/client/ownerFence";
import { actionErrorMessage } from "@/lib/client/asyncAction";
import { markGuestRetained, readGuestDraft } from "@/lib/guest/draft";
import { useSession } from "@/components/shell/SessionShell";
import { BRIEF_FIELD_KEYS, type GuestDraft, type Project } from "@/lib/types";

export function AdoptClient() {
  const { user, loading, generation } = useSession();
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [next, setNext] = useState("/account");
  const [signInHref, setSignInHref] = useState(accountLink("/account/adopt"));

  useEffect(() => {
    setDraft(readGuestDraft());
    setNext(safeCallbackUrl(new URLSearchParams(window.location.search).get("next")));
    setSignInHref(accountLink(window.location.pathname + window.location.search));
  }, []);

  if (loading) {
    return (
      <section className="container section">
        <h1>Checking this account…</h1>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="container section">
        <h1>Sign in first.</h1>
        <p className="lede">Adopting a guest draft requires an authenticated account and an explicit review.</p>
        <a className="btn btn-gold" href={signInHref}>
          Sign in
        </a>
      </section>
    );
  }

  if (!draft) {
    return (
      <section className="container section">
        <h1>No guest draft on this device.</h1>
        <AppLink className="btn btn-ghost" href={next}>Continue to your destination</AppLink>
        <AppLink className="btn btn-gold" href="/project">
          Begin a brief
        </AppLink>
      </section>
    );
  }

  async function adopt() {
    if (!draft || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const result = await api<{ project: Project }>("/api/projects/adopt", {
        method: "POST",
        body: JSON.stringify({ confirmed: true, draft })
      });
      if (!ownerFence.isCurrent(generation, user?.id ?? null)) return;
      markGuestRetained(draft, result.project.id);
      setStatus(`Adopted into ${result.project.id}. The guest copy stays on this device until you dismiss it.`);
      window.location.href = afterAdoption(next, result.project.id);
    } catch (err) {
      if (!ownerFence.isCurrent(generation, user?.id ?? null)) return;
      setError(actionErrorMessage(err, "Adoption did not confirm. The guest draft is still on this device."));
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <section className="container section">
      <p className="kicker">Explicit adoption</p>
      <h1>Review the guest draft before it belongs to this account.</h1>
      <p className="lede">
        Signed in as {user.email}. This will copy the device draft into this account. It will not
        submit the brief. The guest copy is retained until the server save is confirmed.
      </p>
      <p className="notice">This saves a commission brief. It does not automatically copy its contents into your private Companion business. {next.startsWith("/companion") ? "After saving, you will return to the Companion item you opened." : "You can review the saved brief in your commission workspace."}</p>
      <ul>
        {draft.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <article className="surface-dense" style={{ padding: 24, marginTop: 16 }}>
        {BRIEF_FIELD_KEYS.map((key) =>
          draft.brief[key].value ? (
            <p key={key}>
              <strong>{FIELD_LABELS[key]}:</strong> {draft.brief[key].value}
            </p>
          ) : null
        )}
      </article>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn btn-gold" type="button" disabled={pending} onClick={() => void adopt()}>
          {pending ? "Adopting…" : "Adopt into this account"}
        </button>
        <AppLink className="btn btn-ghost" href={next === "/account" ? "/workspace" : next}>
          Keep them separate and continue
        </AppLink>
      </div>
      {status ? <p className="notice">{status}</p> : null}
      {error ? <p className="notice notice-warn">{error}</p> : null}
    </section>
  );
}
