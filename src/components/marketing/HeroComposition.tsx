import { BrandMark } from "@/components/brand/BrandMark";

/** Dimensional product frame using real Atelier controls. This is the brief interface, not a client website. */
export function HeroComposition() {
  return (
    <div className="hero-composition" aria-label="Atelier brief interface">
      <div className="composition-glow" aria-hidden="true" />
      <article className="surface-glass composition-frame">
        <header className="composition-chrome">
          <BrandMark size={28} withWordmark={false} href={null} />
          <span className="tiny">Atelier brief · interface</span>
        </header>
        <p className="kicker">Your project brief</p>
        <h2 className="composition-title">What would you like to bring to life?</h2>
        <p className="muted">Start with the idea. Refine as you go. Nothing is sent until you review and consent.</p>
        <div className="composition-field surface-dense">
          <span className="lbl">Vision</span>
          <p>A branded website that presents the business clearly and links to the booking destination already in use.</p>
        </div>
        <div className="chips" aria-hidden="true">
          <span className="chip" aria-pressed="true">
            Booking-connected site
          </span>
          <span className="chip">Website</span>
          <span className="chip">Digital infrastructure</span>
        </div>
        <p className="tiny composition-note">Concept of the Atelier workspace — not a completed client project.</p>
      </article>
    </div>
  );
}
