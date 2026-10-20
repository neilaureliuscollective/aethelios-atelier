import { AppLink } from "@/components/ui/AppLink";
import { HeroShowcase } from "@/components/marketing/HeroShowcase";
import { FULL_LOGO } from "@/lib/brand/fullLogo";

export function CinematicHero() {
  return (
    <section className="cinematic-hero" aria-labelledby="home-hero">
      <div className="cinematic-media" aria-hidden="true">
        <picture>
          <source
            media="(max-width: 720px)"
            srcSet="/atmosphere/colonnade.webp"
            type="image/webp"
          />
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
      <div className="cinematic-shell">
        <div className="hero-copy cinematic-copy">
          <figure className="hero-mark">
            <img
              src={FULL_LOGO.lockupSrc}
              alt="Aethelios Atelier"
              width={FULL_LOGO.width}
              height={FULL_LOGO.height}
              fetchPriority="high"
              decoding="async"
            />
          </figure>
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
        <HeroShowcase />
      </div>
    </section>
  );
}
