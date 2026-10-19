import { AppLink } from "@/components/ui/AppLink";
import { CalendarIcon, GlobeIcon, NodesIcon } from "@/components/ui/Icons";
import { SERVICE_CATALOG } from "@/lib/catalog";

export default function HomePage() {
  const website = SERVICE_CATALOG.offers.find((o) => o.id === "website");
  const booking = SERVICE_CATALOG.offers.find((o) => o.id === "booking_connected_website");
  const infra = SERVICE_CATALOG.offers.find((o) => o.id === "digital_infrastructure");

  return (
    <>
      <section className="container hero">
        <div>
          <p className="kicker">Founder-led digital infrastructure</p>
          <h1>
            Your vision.
            <br />
            <span className="gold-em">Personally built.</span>
          </h1>
          <p className="lede">
            Aethelios Atelier helps business owners turn a need into a clear commission that Neil
            Stutes personally scopes and delivers. Begin a guided brief — no subscription required.
            Aurelius can help you organize the work; Neil remains responsible for accepting it.
          </p>
          <div className="hero-actions">
            <AppLink className="btn btn-gold" href="/project">
              Begin your project
            </AppLink>
            <AppLink className="btn btn-ghost" href="/approach">
              How it works
            </AppLink>
          </div>
        </div>
        <div className="hero-mark">
          <img src="/brand/logo.webp" alt="Aethelios Atelier emblem" width={720} height={720} />
        </div>
      </section>

      <section className="container section" aria-labelledby="services-heading">
        <div className="section-head">
          <p className="kicker">What Atelier delivers</p>
          <h2 id="services-heading">A focused offer, held open to what comes next.</h2>
          <p className="lede">
            The first commission type is a branded website and installable web app connected to the
            booking provider you already use. That provider continues to handle appointments and
            payments. Linking is not a replacement booking engine.
          </p>
        </div>
        <div className="card-grid">
          <article className="panel service-card">
            <GlobeIcon />
            <h3>{website?.title}</h3>
            <p className="muted">{website?.summary}</p>
          </article>
          <article className="panel service-card">
            <CalendarIcon />
            <h3>{booking?.title}</h3>
            <p className="muted">{booking?.summary}</p>
          </article>
          <article className="panel service-card">
            <NodesIcon />
            <h3>{infra?.title}</h3>
            <p className="muted">{infra?.summary}</p>
          </article>
        </div>
      </section>

      <section className="container section" aria-labelledby="path-heading">
        <div className="section-head">
          <p className="kicker">A considered process</p>
          <h2 id="path-heading">A clear path from idea to execution.</h2>
          <p className="lede">
            Nothing is sent until you review the brief and consent. Submitted is not the same as
            under founder review. Price and timing stay unconfirmed until Neil says so.
          </p>
        </div>
        <div className="process">
          {[
            ["01", "Brief", "Describe the business, audience, and destination. Conversation and a structured path are both available."],
            ["02", "Founder review", "Neil personally opens accepted submissions. Review starts only when he begins it."],
            ["03", "Agreed scope", "A tailored scope, if the work is a fit. Estimates before this point are nonbinding."],
            ["04", "Build", "Design, develop, and refine with you. Unlimited custom work is not offered."]
          ].map(([num, title, copy]) => (
            <article className="panel process-card" key={num}>
              <div className="num">{num}</div>
              <h3>{title}</h3>
              <p className="muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section" aria-labelledby="founder-heading">
        <div className="panel cta-band founder-band">
          <div>
            <p className="kicker">Founder-led</p>
            <h2 id="founder-heading">Reviewed and built by Neil Stutes.</h2>
            <p className="lede">
              Atelier is not autonomous website generation, not an Aethelios subscription, and not a
              replacement for human expertise. Aurelius clarifies; Neil accepts, prices, and delivers.
            </p>
            <AppLink className="btn btn-gold" href="/project">
              Begin your project
            </AppLink>
          </div>
          <div className="hero-mark">
            <img src="/brand/icon.webp" alt="" width={280} height={280} />
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="panel cta-band">
          <div>
            <p className="kicker">Let’s create together</p>
            <h2>Tell us what you want to create.</h2>
            <p className="muted">
              Share the details you have. You can continue as a guest on this device and sign in
              only when you are ready to send the brief.
            </p>
          </div>
          <AppLink className="btn btn-gold" href="/project">
            Begin your project
          </AppLink>
        </div>
      </section>
    </>
  );
}
