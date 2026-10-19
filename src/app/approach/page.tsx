import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";

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
        {[
          ["Shape a living brief", "Suggestions from Aethelios stay pending until you accept them. Manual completion is enough."],
          ["Consent to a saved snapshot", "You send an immutable copy of the exact revision you reviewed. That creates a durable receipt."],
          ["Submitted is not under review", "Review begins only when Neil opens the commission. There is no implied acceptance or delivery date."],
          ["Clarification and private work", "He may ask a question, keep private notes, and publish a labeled client-visible update."],
          ["Scope after human review", "Timing and price are confirmed only after that review, never by the brief itself."]
        ].map(([title, copy], index) => (
          <li className="surface-dimensional approach-step" key={title}>
            <span className="num">{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{title}</h2>
              <p className="muted">{copy}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="muted" style={{ marginTop: 24 }}>
        Notifications are not part of this local candidate. Return to your workspace to see founder
        responses. Offline edits are never treated as delivered submissions.
      </p>
      <AppLink className="btn btn-gold" href="/project">
        Begin your project
      </AppLink>
    </section>
  );
}
