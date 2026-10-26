import { AppLink } from "@/components/ui/AppLink";
import { BEGIN_HREF, BEGIN_LABEL } from "@/lib/publicSite";
import { AtelierManifesto } from "@/components/marketing/AtelierManifesto";
import { ConciergeStage } from "@/components/concierge/ConciergeStage";
import { CustomProjectsInvite } from "@/components/marketing/CustomProjectsInvite";
import { PossibilitiesStage } from "@/components/marketing/PossibilitiesStage";
import { ServiceShowcase } from "@/components/marketing/ServiceShowcase";
import { Reveal } from "@/components/motion/Reveal";
import { SelectedWork } from "@/components/work/SelectedWork";
import { FULL_LOGO } from "@/lib/brand/fullLogo";

export default function HomePage() {
  return (
    <>
      <ConciergeStage />
      <AtelierManifesto />
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
            <p className="kicker">Services</p>
            <h2 id="services-heading">Four ways a commission can begin.</h2>
          </div>
          <p className="lede">
            Branding is a quality across this work, and it can also be scoped on its own. A rebrand is
            not required to start. Every build is scoped to the business —{" "}
            <AppLink href="/pricing">see how investment works</AppLink>. Neil confirms every proposal.
          </p>
        </div>
        <ServiceShowcase />
        <CustomProjectsInvite />
      </Reveal>

      <Reveal as="section" className="container section" delay={2}>
        <div className="section-head">
          <p className="kicker">Neil’s approach</p>
          <h2 id="path-heading">A more considered way to build.</h2>
          <p className="lede">
            Nothing is sent until you review the direction and choose to send it. Sending is a request.
            Neil accepts work only after he reviews it. Price and timing stay unconfirmed until he
            says so.
          </p>
        </div>
        <div className="process process-editorial">
          {(
            [
              ["01", "Understanding your vision", "Talk the business through with Aethelios — what you run, who it serves, and what has to work better.", BEGIN_HREF],
              ["02", "Thinking strategically", "Aethelios shapes the conversation into a written direction you review before anything is sent.", BEGIN_HREF],
              ["03", "Designing with intent", "Neil reads the direction personally and replies with a scoped, written proposal.", "/approach"],
              ["04", "Building for what’s next", "Design and development proceed against the agreed proposal — not an open-ended retainer.", "/approach"]
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

      <Reveal as="section" className="container section" variant="material">
        <div className="founder-band surface-obsidian">
          <div>
            <p className="kicker">Founder-led</p>
            <h2 id="founder-heading">Reviewed and built by Neil Stutes.</h2>
            <p className="lede lede-bright">
              Aethelios Atelier is founder-led studio work, separate from the main Aethelios product.
              Neil reads every brief he accepts and remains accountable for scope, price, and delivery.
              No account and no subscription — just a conversation and a proposal.
            </p>
            <AppLink className="btn btn-gold" href={BEGIN_HREF}>
              {BEGIN_LABEL}
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
