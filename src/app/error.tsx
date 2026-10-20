"use client";

import { AppLink } from "@/components/ui/AppLink";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="container section">
      <p className="kicker">Interrupted</p>
      <h1>This page could not finish loading.</h1>
      <p className="lede">
        Nothing was marked saved, submitted, generated, or sent. Your last confirmed work is still
        where it was. You can try again or return home.
      </p>
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn btn-gold" type="button" onClick={() => reset()}>
          Try again
        </button>
        <AppLink className="btn btn-ghost" href="/">
          Return home
        </AppLink>
      </div>
    </section>
  );
}
