import { AppLink } from "@/components/ui/AppLink";
import { ConciergeOpenButton } from "@/components/concierge/ConciergeOpenButton";
import { CinematicHero } from "@/components/marketing/CinematicHero";
import { CustomProjectsInvite } from "@/components/marketing/CustomProjectsInvite";
import { PossibilitiesStage } from "@/components/marketing/PossibilitiesStage";
import { ServiceShowcase } from "@/components/marketing/ServiceShowcase";
import { Reveal } from "@/components/motion/Reveal";
import { SelectedWork } from "@/components/work/SelectedWork";
import { FULL_LOGO } from "@/lib/brand/fullLogo";

export default function HomePage() {
  return (
    <>
      <CinematicHero />
      <SelectedWork variant="featured" />

      <Reveal as="section" className="container section ivory-section" delay={1}>
        <div className="section-head split-head">
          <div>
            <p className="kicker">Possibilities</p>
            <h2 id="possibilities-heading">Complete digital foundations for ambitious ideas.</h2>
          </div>
          <p className="lede">
            Explore a working demonstration of each path. These are labeled examples of websites, tools,
            storefronts, and workflows — not a portfolio of completed client results.
          </p>
        </div>
        <PossibilitiesStage />
      </Reveal>

      <Reveal as="section" className="container section" delay={1}>
        <div className="section-head split-head">
          <div>
            <p className="kicker">Our services</p>
            <h2 id="services-heading">Four ways a commission can begin.</h2>
          </div>
          <p className="lede">
            Branding is a quality across this work, and it can also be scoped on its own. A rebrand is
            not required to start. Plan prices are listed on{" "}
            <AppLink href="/pricing">Pricing</AppLink>. Neil still confirms every proposal.
          </p>
        </div>
        <ServiceShowcase />
        <CustomProjectsInvite />
      </Reveal>

      <Reveal as="section" className="container section" delay={2}>
        <div className="section-head">
          <p className="kicker">Our approach</p>
          <h2 id="path-heading">A more considered way to build.</h2>
          <p className="lede">
            Nothing is sent until you review the brief and consent. Sending a brief is a request.
            Neil accepts work only after he reviews it. Price and timing stay unconfirmed until he
            says so.
          </p>
        </div>
        <div className="process process-editorial">
          {(
            [
              ["01", "Understanding your vision", "Discover a direction and write what the business actually needs.", "/discover"],
              ["02", "Thinking strategically", "A living brief keeps statements, suggestions, and unknowns distinct.", "/project"],
              ["03", "Designing with intent", "Neil reviews accepted work and publishes versioned proposals.", "/approach"],
              ["04", "Building for what’s next", "Design and development proceed against the agreed version — not an open-ended studio.", "/approach"]
            ] as const
          ).map(([num, title, copy, href], index) => (
            <AppLink className="offer-link" href={href} key={num}>
              <article className={`surface-ivory process-card reveal-delay-${index}`}>
                <div className="num">{num}</div>
                <h3>{title}</h3>
                <p className="muted">{copy}</p>
              </article>
            </AppLink>
          ))}
        </div>
      </Reveal>

      <Reveal as="section" className="container section" delay={2}>
        <div className="section-head split-head">
          <div>
            <p className="kicker">Aethelios</p>
            <h2 id="concierge-heading">A digital concierge for the work before the brief.</h2>
          </div>
          <p className="lede">
            Aethelios is an AI guide for this studio — not a person, and not a substitute for Neil.
            He helps you name the problem, see which path may fit, and prepare a request when you
            are ready. You can leave without sending anything.
          </p>
        </div>
        <div className="row">
          <ConciergeOpenButton className="btn btn-gold">Talk with Aethelios</ConciergeOpenButton>
          <AppLink className="btn btn-ghost" href="/rta">
            Open Aethelios RTA
          </AppLink>
          <AppLink className="btn btn-ghost" href="/concierge">
            Open the dedicated view
          </AppLink>
        </div>
      </Reveal>

      <Reveal as="section" className="container section" variant="material">
        <div className="founder-band surface-obsidian">
          <div>
            <p className="kicker">Founder-led</p>
            <h2 id="founder-heading">Reviewed and built by Neil Stutes.</h2>
            <p className="lede lede-bright">
              Aethelios Atelier is founder-led studio work, separate from the main Aethelios product.
              I read every brief I accept, and I remain accountable for scope, price, and delivery. You
              can explore without a subscription.
            </p>
            <AppLink className="btn btn-gold" href="/project">
              Begin a brief
            </AppLink>
            <AppLink className="btn btn-ghost" href="/inquire">
              Send an inquiry
            </AppLink>
          </div>
          <figure className="founder-emblem">
            <img
              src={FULL_LOGO.lockupSrc}
              alt="Aethelios Atelier"
              width={FULL_LOGO.width}
              height={FULL_LOGO.height}
              loading="lazy"
              decoding="async"
            />
          </figure>
        </div>
      </Reveal>
    </>
  );
}
