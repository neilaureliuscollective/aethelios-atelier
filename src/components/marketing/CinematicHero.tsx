import { AppLink } from "@/components/ui/AppLink";
import { DeviceFrame, DemoWebsite } from "@/components/marketing/DeviceFrame";

export function CinematicHero() {
  return (
    <section className="cinematic-hero" aria-labelledby="home-hero">
      <div className="cinematic-media" aria-hidden="true">
        <picture>
          <source srcSet="/atmosphere/colonnade.webp" type="image/webp" />
          <img
            src="/atmosphere/colonnade.jpg"
            alt=""
            width={1920}
            height={1080}
            fetchPriority="high"
            decoding="async"
          />
        </picture>
      </div>
      <div className="cinematic-shade" aria-hidden="true" />
      <div className="container cinematic-grid">
        <div className="hero-copy cinematic-copy">
          <p className="kicker">Digital experiences · bespoke solutions</p>
          <h1 id="home-hero">
            Your vision.
            <br />
            <span className="gold-em">Personally built.</span>
          </h1>
          <p className="lede lede-bright">
            Aethelios Atelier creates refined digital experiences — branded websites, custom platforms,
            e-commerce systems, and the infrastructure that keeps it all running. Neil Stutes reviews
            every commission. No subscription is required to start.
          </p>
          <div className="hero-actions">
            <AppLink className="btn btn-emerald-glass" href="/discover">
              Explore your direction
              <span className="btn-arrow" aria-hidden="true">
                →
              </span>
            </AppLink>
            <AppLink className="btn btn-gold" href="/project">
              Begin your project
            </AppLink>
          </div>
          <ul className="trust-row" aria-label="How a commission is held">
            <li>Strategy & architecture</li>
            <li>Design & development</li>
            <li>Secure & scalable</li>
            <li>Ongoing partnership</li>
          </ul>
        </div>
        <div className="hero-devices" aria-label="Demonstration of a digital presence">
          <DeviceFrame variant="desktop" label="Demonstration website on a desktop">
            <DemoWebsite
              name="Aethelios Atelier"
              kicker="Ideas shaped by purpose"
              headline="A considered digital presence."
              image="/atmosphere/colonnade.webp"
              imageAlt="Architectural light used as atmosphere behind a website demonstration"
              action="Learn more"
            />
          </DeviceFrame>
          <div className="hero-device-stack">
            <DeviceFrame variant="tablet" label="Demonstration website on a tablet">
              <DemoWebsite
                name="Northline"
                kicker="Bespoke digital experiences"
                headline="A presence designed for ambitious work."
                image="/atmosphere/lumen.webp"
                imageAlt="Glass pavilion atmosphere used inside a website demonstration"
                action="View work"
              />
            </DeviceFrame>
            <DeviceFrame variant="phone" label="Demonstration website on a phone">
              <DemoWebsite
                name="Field & Form"
                kicker="Built to last"
                headline="Quiet, useful, online."
                image="/atmosphere/hearth.webp"
                imageAlt="Timber interior atmosphere used inside a mobile website demonstration"
                action="Begin"
              />
            </DeviceFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
