"use client";

import { BrandMark } from "@/components/brand/BrandMark";
import { AppLink } from "@/components/ui/AppLink";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="container section">
      <div className="brand-seal">
        <BrandMark variant="lockup" withWordmark={false} size={72} />
      </div>
      <p className="kicker">Interrupted</p>
      <h1>This page could not finish loading.</h1>
      <p className="lede">
        A failed page load does not tell us whether a save or send completed. If you were writing or
        sending, open the brief or Commissions and look for the last confirmed draft or receipt
        before trying the same action again.
      </p>
      <div className="row" style={{ marginTop: 20 }}>
        <button className="btn btn-gold" type="button" onClick={() => reset()}>
          Try this page again
        </button>
        <AppLink className="btn btn-ghost" href="/workspace">
          Open Commissions
        </AppLink>
        <AppLink className="btn btn-ghost" href="/">
          Return home
        </AppLink>
      </div>
    </section>
  );
}
