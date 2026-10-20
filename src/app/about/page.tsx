import type { Metadata } from "next";
import { BrandMark } from "@/components/brand/BrandMark";
import { AppLink } from "@/components/ui/AppLink";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <section className="container section">
      <div className="brand-seal">
        <BrandMark variant="lockup" withWordmark={false} size={96} href={null} />
      </div>
      <p className="kicker">About</p>
      <h1>A studio with one accountable founder.</h1>
      <p className="lede">
        Aethelios Atelier is the practice of Neil Stutes. It exists to turn a founder’s need into a
        commission that can actually be built — with a clear record of the work, and no pretence of
        unlimited custom work.
      </p>
      <div className="about-grid">
        <article className="surface-ivory value-card">
          <h3>Strategic foundation</h3>
          <p className="muted">Clarity, structure, and systems for what is next — written before build begins.</p>
        </article>
        <article className="surface-glass value-card">
          <h3>Bespoke infrastructure</h3>
          <p className="muted">Tailored digital platforms when they are a fit, never as a disguised template mill.</p>
        </article>
        <article className="surface-dense value-card">
          <h3>Founder-led partnership</h3>
          <p className="muted">Deep collaboration from strategy to delivery, with Neil accountable for the work.</p>
        </article>
      </div>
      <div className="row" style={{ marginTop: 28 }}>
        <AppLink className="btn btn-gold" href="/project">
          Begin a brief
        </AppLink>
      </div>
    </section>
  );
}
