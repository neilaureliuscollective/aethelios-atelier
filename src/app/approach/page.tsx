import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { Reveal } from "@/components/motion/Reveal";

export const metadata: Metadata = { title: "Approach" };

export default function ApproachPage() {
  return (
    <section className="container section">
      <p className="kicker">Approach</p>
      <h1>Human-led, with a careful guide.</h1>
      <p className="lede">
        You can start without buying anything. Describe the business in conversation or through the
        structured brief. Guest drafts remain on this device until you sign in, review, and adopt
        them into an account.
      </p>
      <ol className="approach-steps">
        {([
          ["Discover a direction", "Try on curated, personalized directions for websites, apps, storefronts, and infrastructure. Nothing is sent from discovery.", "/discover"],
          ["Shape a living brief", "Suggestions from Aethelios stay pending until you accept them. Manual completion is enough.", "/project"],
          ["Consent to a saved snapshot", "You send an immutable copy of the exact revision you reviewed. That creates a durable receipt.", "/project"],
          ["Submitted is not under review", "Review begins only when Neil opens the commission. There is no implied acceptance or delivery date.", "/about"],
          ["Scope after human review", "Timing and price are confirmed only after that review, never by the brief itself.", "/about"]
        ] as const).map(([title, copy, href], index) => (
          <Reveal as="li" className="surface-ivory approach-step" key={title} delay={(index % 3) as 0 | 1 | 2}>
            <span className="num">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{title}</h2>
              <p className="muted">{copy}</p>
              <AppLink className="btn btn-ghost btn-compact" href={href}>
                Continue
              </AppLink>
            </div>
          </Reveal>
        ))}
      </ol>
      <p className="muted" style={{ marginTop: 24 }}>
        Notifications are not part of this local candidate. Return to your workspace to see founder
        responses. Offline edits are never treated as delivered submissions.
      </p>
      <div className="row" style={{ marginTop: 20 }}>
        <AppLink className="btn btn-emerald-glass" href="/discover">
          Explore your direction
        </AppLink>
        <AppLink className="btn btn-ghost" href="/project">
          Begin a brief
        </AppLink>
      </div>
    </section>
  );
}
