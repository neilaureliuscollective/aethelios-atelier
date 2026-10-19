import { AppLink } from "@/components/ui/AppLink";
import { CalendarIcon, GlobeIcon, NodesIcon } from "@/components/ui/Icons";
import { HeroComposition } from "@/components/marketing/HeroComposition";
import { SERVICE_CATALOG } from "@/lib/catalog";

export default function HomePage() {
  const website = SERVICE_CATALOG.offers.find((o) => o.id === "website");
  const booking = SERVICE_CATALOG.offers.find((o) => o.id === "booking_connected_website");
  const infra = SERVICE_CATALOG.offers.find((o) => o.id === "digital_infrastructure");

  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <p className="kicker">Founder-led digital infrastructure</p>
          <h1>
            Your vision.
            <br />
            <span className="gold-em">Personally built.</span>
          </h1>
          <p className="lede">
            Aethelios Atelier is Neil Stutes’ studio for websites and digital infrastructure. Begin a
            guided brief. Aurelius can help you organize it; Neil remains the person who reviews,
            scopes, and delivers. No subscription is required to start.
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
        <HeroComposition />
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
        <div className="offer-mosaic">
          <article className="surface-dimensional offer-card offer-website">
            <GlobeIcon />
            <h3>{website?.title}</h3>
            <p className="muted">{website?.summary}</p>
          </article>
          <article className="surface-dimensional offer-card offer-booking">
            <CalendarIcon />
            <p className="tiny">Primary path</p>
            <h3>{booking?.title}</h3>
            <p className="muted">{booking?.summary}</p>
            <p className="notice">Your existing booking provider continues to handle the bookings.</p>
          </article>
          <article className="surface-dense offer-card offer-infra">
            <NodesIcon />
            <p className="tiny">Exploratory</p>
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
            <article className="surface-glass process-card" key={num}>
              <div className="num">{num}</div>
              <h3>{title}</h3>
              <p className="muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section" aria-labelledby="founder-heading">
        <div className="founder-band surface-dimensional">
          <div>
            <p className="kicker">Founder-led</p>
            <h2 id="founder-heading">Reviewed and built by Neil Stutes.</h2>
            <p className="lede">
              Atelier is not autonomous website generation, not an Aethelios subscription, and not a
              replacement for human expertise. I read every brief I accept, and I remain accountable
              for scope, price, and delivery.
            </p>
            <AppLink className="btn btn-gold" href="/project">
              Begin your project
            </AppLink>
          </div>
          <figure className="founder-emblem">
            <img
              src="/brand/logo.webp"
              alt="Aethelios Atelier wordmark"
              width={720}
              height={720}
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
      </section>
    </>
  );
}
