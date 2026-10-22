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
        structured brief. A guest draft can be sent as an inquiry without creating an account.
      </p>
      <ol className="approach-steps">
        {([
          ["Discover a direction", "Try on curated, personalized directions for websites, apps, storefronts, and infrastructure. Nothing is sent from discovery.", "/discover"],
          ["Shape a living brief", "Suggestions from Aethelios stay pending until you accept them. Manual completion is enough.", "/project"],
          ["Consent to a saved snapshot", "You send the brief you reviewed. That is a request for Neil, not a booking or payment.", "/inquire"],
          ["A sent brief is a request", "Neil accepts work only after he opens the commission. There is no implied acceptance or delivery date.", "/about"],
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
        Guest inquiries are emailed to Neil when sending is configured. Founder replies are not
        pushed as notifications yet. Offline edits are never treated as delivered submissions.
      </p>
      <div className="row" style={{ marginTop: 20 }}>
        <AppLink className="btn btn-emerald-glass" href="/discover">
          Explore your direction
        </AppLink>
        <AppLink className="btn btn-ghost" href="/project">
          Begin a brief
        </AppLink>
        <AppLink className="btn btn-ghost" href="/inquire">
          Send a short inquiry
        </AppLink>
      </div>
    </section>
  );
}
