import type { Metadata } from "next";

export const metadata: Metadata = { title: "Approach" };

export default function ApproachPage() {
  return (
    <section className="container section">
      <p className="kicker">Approach</p>
      <h1>Human-led, with a careful guide.</h1>
      <div className="stack" style={{ maxWidth: "72ch" }}>
        <p className="lede">
          You can start without buying anything. Describe the business in conversation or through
          the structured brief. Guest drafts remain on this device until you sign in, review, and
          adopt them into an account.
        </p>
        <article className="panel" style={{ padding: 24 }}>
          <h2>What happens next</h2>
          <ol>
            <li>You shape a living brief. Suggestions from Aurelius stay pending until you accept them.</li>
            <li>You consent to send an immutable snapshot to Neil. That creates a durable receipt.</li>
            <li>Submitted is not under review. Review begins only when Neil opens the commission.</li>
            <li>He may ask a clarification, keep private notes, and publish a labeled client-visible update.</li>
            <li>Scope, timing, and price are confirmed only after that human review.</li>
          </ol>
        </article>
        <p className="muted">
          Notifications are not part of this local candidate. Return to your workspace to see
          founder responses. Offline edits are never treated as delivered submissions.
        </p>
      </div>
    </section>
  );
}
