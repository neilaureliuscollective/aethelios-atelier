"use client";

import { useEffect, useState } from "react";
import { AppLink } from "@/components/ui/AppLink";
import { FIELD_LABELS } from "@/lib/brief";
import { api } from "@/lib/client/api";
import { markGuestRetained, readGuestDraft } from "@/lib/guest/draft";
import { BRIEF_FIELD_KEYS, type GuestDraft, type Project, type User } from "@/lib/types";

export function AdoptClient() {
  const [user, setUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<GuestDraft | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    void (async () => {
      const session = await api<{ user: User | null }>("/api/session");
      setUser(session.user);
      setDraft(readGuestDraft());
    })();
  }, []);

  if (!user) {
    return (
      <section className="container section">
        <h1>Sign in first.</h1>
        <p className="lede">Adopting a guest draft requires an authenticated account and an explicit review.</p>
        <a className="btn btn-gold" href="/account?next=/account/adopt">
          Sign in
        </a>
      </section>
    );
  }

  if (!draft) {
    return (
      <section className="container section">
        <h1>No guest draft on this device.</h1>
        <a className="btn btn-gold" href="/project">
          Begin a brief
        </a>
      </section>
    );
  }

  async function adopt() {
    if (!draft) return;
    const result = await api<{ project: Project }>("/api/projects/adopt", {
      method: "POST",
      body: JSON.stringify({ confirmed: true, draft })
    });
    markGuestRetained(draft, result.project.id);
    setStatus(`Adopted into ${result.project.id}. The guest copy stays on this device until you dismiss it.`);
    window.location.href = `/workspace/${result.project.id}`;
  }

  return (
    <section className="container section">
      <p className="kicker">Explicit adoption</p>
      <h1>Review the guest draft before it belongs to this account.</h1>
      <p className="lede">
        Signed in as {user.email}. This will copy the device draft into this account. It will not
        submit the brief. The guest copy is retained until the server save is confirmed.
      </p>
      <ul>
        {draft.limitations.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <article className="panel" style={{ padding: 24, marginTop: 16 }}>
        {BRIEF_FIELD_KEYS.map((key) =>
          draft.brief[key].value ? (
            <p key={key}>
              <strong>{FIELD_LABELS[key]}:</strong> {draft.brief[key].value}
            </p>
          ) : null
        )}
      </article>
      <div className="row" style={{ marginTop: 18 }}>
        <button className="btn btn-gold" type="button" onClick={() => void adopt()}>
          Adopt into this account
        </button>
        <AppLink className="btn btn-ghost" href="/workspace">
          Keep them separate
        </AppLink>
      </div>
      {status ? <p className="notice">{status}</p> : null}
    </section>
  );
}
