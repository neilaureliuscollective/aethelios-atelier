import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { Reveal } from "@/components/motion/Reveal";
import { BarbersSalonShowcase } from "@/components/marketing/barbers/BarbersSalonShowcase";
import { SelectedWork } from "@/components/work/SelectedWork";
import { SALON_INDUSTRY_ASSETS } from "@/lib/industry/assets";
import {
  BARBERS_SALON_BENEFITS,
  BARBERS_SALON_FAQ,
  BARBERS_SALON_WALKTHROUGH,
  BARBERS_SALONS_BRIEF_HREF,
  BARBERS_SALONS_CORE_MESSAGE,
  BARBERS_SALONS_OFFER,
  BARBERS_SALONS_PUBLIC_TERMS
} from "@/lib/offers/barbersSalons";
import { INDUSTRY_IMAGE_SOURCES } from "@/lib/work/fixItShop";

export const metadata: Metadata = {
  title: BARBERS_SALONS_OFFER.title,
  description: BARBERS_SALONS_CORE_MESSAGE
};

export default function BarbersSalonsPage() {
  return (
    <div className="barbers-page">
      <section className="cinematic-hero barbers-hero" aria-labelledby="barbers-hero">
        <div className="cinematic-media" aria-hidden="true">
          <picture>
            <source srcSet={SALON_INDUSTRY_ASSETS.specialistHero.src} type="image/webp" />
            <img
              src={SALON_INDUSTRY_ASSETS.specialistHero.jpg}
              alt=""
              width={SALON_INDUSTRY_ASSETS.specialistHero.width}
              height={SALON_INDUSTRY_ASSETS.specialistHero.height}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </div>
        <div className="cinematic-shade" aria-hidden="true" />
        <div className="cinematic-shell barbers-hero-shell">
          <div className="hero-copy cinematic-copy">
            <p className="kicker">{BARBERS_SALONS_OFFER.kicker}</p>
            <h1 id="barbers-hero">
              {BARBERS_SALONS_OFFER.title}
              <br />
              <span className="gold-em">One shop. Clearly presented.</span>
            </h1>
            <p className="lede lede-bright">{BARBERS_SALONS_CORE_MESSAGE}</p>
            <p className="lede lede-bright">{BARBERS_SALONS_OFFER.summary}</p>
            <div className="hero-actions">
              <AppLink className="btn btn-gold" href={BARBERS_SALONS_BRIEF_HREF}>
                Start my website brief
              </AppLink>
              <AppLink className="btn btn-emerald-glass" href="#real-work">
                See selected work
              </AppLink>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <p className="kicker">Completed work</p>
          <h2>A real website, before the illustrative direction.</h2>
          <p className="lede">
            Fix It Shop is a completed public website for a men’s salon. Vale & Crown, further down
            this page, is a labeled fictional demonstration — not a client and not a substitute for
            this work.
          </p>
        </div>
        <SelectedWork variant="editorial" />
      </section>

      <section className="container section" id="demonstration">
        <div className="section-head">
          <p className="kicker">Illustrative direction</p>
          <h2>A website the professional actually opens.</h2>
          <p className="lede">
            Move through story, work, services, visit details, and the booking handoff. Desktop and
            phone stay in step. Vale & Crown is a labeled fictional shop, not a live salon and not a
            client record.
          </p>
        </div>
        <BarbersSalonShowcase />
        <p className="notice" style={{ marginTop: 18 }}>
          {INDUSTRY_IMAGE_SOURCES.generated} {INDUSTRY_IMAGE_SOURCES.references}
        </p>
      </section>

      <section className="container section">
        <div className="section-head">
          <p className="kicker">Why this exists</p>
          <h2>Presence first. Booking stays where it already works.</h2>
        </div>
        <div className="barbers-benefits">
          {BARBERS_SALON_BENEFITS.map((item, index) => (
            <Reveal as="article" className="surface-ivory barbers-benefit" delay={(index % 3) as 0 | 1 | 2} key={item.title}>
              <p className="tiny">0{index + 1}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <p className="kicker">How a visitor moves</p>
          <h2>Explore the work. View services. Book with the existing provider.</h2>
        </div>
        <ol className="barbers-walk">
          {BARBERS_SALON_WALKTHROUGH.map((item) => (
            <li className="surface-read" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container section" id="care">
        <Reveal as="article" className="service-feature surface-ivory">
          <div>
            <p className="tiny">Build and care</p>
            <h2>A considered first site, then ordinary maintenance.</h2>
            <p className="lede">
              Neil delivers a custom branded website and installable web app, then keeps the agreed
              digital presence in good order. The professional keeps the current booking provider.
            </p>
            <p>{BARBERS_SALONS_PUBLIC_TERMS}</p>
            <AppLink className="btn btn-gold" href={BARBERS_SALONS_BRIEF_HREF}>
              Start my website brief
            </AppLink>
          </div>
          <div className="surface-read service-spec">
            <h3>The focused first version</h3>
            <ul>
              <li>One location and one existing booking connection</li>
              <li>Story and team, services, gallery, location and hours</li>
              <li>A clear booking action that opens the provider already in use</li>
              <li>An installable phone experience, accepted by that browser and device</li>
            </ul>
            <h3>Ongoing care, in ordinary language</h3>
            <ul>
              <li>Keeping the site available and maintaining the implementation</li>
              <li>Checking important links and handling agreed small content changes</li>
              <li>Provider fees and domain renewal sit outside this offer</li>
              <li>Larger additions are scoped before work begins</li>
            </ul>
            <h3>Not in this phase</h3>
            <ul>
              <li>A booking engine, live time slots, or migrated client records</li>
              <li>App Store or Google Play listings</li>
              <li>Products, Reserve commissions, wholesale inventory, or private labeling</li>
              <li>Support-time promises, free domains, unlimited edits, or search-ranking claims</li>
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="container section" id="questions">
        <div className="section-head">
          <p className="kicker">Questions</p>
          <h2>Clear limits. No invented guarantees.</h2>
        </div>
        <div className="barbers-faq">
          {BARBERS_SALON_FAQ.map((item) => (
            <article className="surface-ivory" key={item.id}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
        <div className="row" style={{ marginTop: 28 }}>
          <AppLink className="btn btn-gold" href={BARBERS_SALONS_BRIEF_HREF}>
            Start my website brief
          </AppLink>
          <AppLink className="btn btn-ghost" href="/services">
            All services
          </AppLink>
          <AppLink className="btn btn-ghost" href="/pricing">
            Published plan prices
          </AppLink>
        </div>
      </section>
    </div>
  );
}
