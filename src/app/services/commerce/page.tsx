import type { Metadata } from "next";
import { AppLink } from "@/components/ui/AppLink";
import { Reveal } from "@/components/motion/Reveal";
import { DemoStore, DeviceFrame } from "@/components/marketing/DeviceFrame";
import { CommercePathCompare } from "@/components/marketing/commerce/CommercePathCompare";
import {
  ATELIER_COMMERCE_CORE_MESSAGE,
  ATELIER_COMMERCE_PUBLIC_TITLE,
  ATELIER_COMMERCE_PUBLIC_TERMS,
  COMMERCE_BENEFITS,
  COMMERCE_FAQ,
  COMMERCE_FOUNDATION_BRIEF_HREF,
  COMMERCE_FOUNDATION_EXCLUDES,
  COMMERCE_FOUNDATION_INCLUDES,
  COMMERCE_FOUNDATION_OFFER,
  COMMERCE_LAUNCH_BRIEF_HREF,
  COMMERCE_LAUNCH_EXCLUDES,
  COMMERCE_LAUNCH_INCLUDES,
  COMMERCE_LAUNCH_OFFER,
  COMMERCE_LAUNCH_STEPS,
  COMMERCE_SITUATIONS
} from "@/lib/offers/commerce";

export const metadata: Metadata = {
  title: ATELIER_COMMERCE_PUBLIC_TITLE,
  description: ATELIER_COMMERCE_CORE_MESSAGE
};

export default function AtelierCommercePage() {
  return (
    <div className="commerce-page">
      <section className="cinematic-hero commerce-hero" aria-labelledby="commerce-hero">
        <div className="cinematic-media" aria-hidden="true">
          <picture>
            <source srcSet="/atmosphere/storefront.webp" type="image/webp" />
            <img
              src="/atmosphere/storefront.jpg"
              alt=""
              width={1920}
              height={1080}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </div>
        <div className="cinematic-shade" aria-hidden="true" />
        <div className="cinematic-shell commerce-hero-shell">
          <div className="hero-copy cinematic-copy">
            <p className="kicker">Commerce division</p>
            <h1 id="commerce-hero">
              {ATELIER_COMMERCE_PUBLIC_TITLE}
              <br />
              <span className="gold-em">Your brand. Sourced with care.</span>
            </h1>
            <p className="lede lede-bright">{ATELIER_COMMERCE_CORE_MESSAGE}</p>
            <p className="lede lede-bright">
              Aethelios Atelier helps a founder source a first assortment and launch a storefront the
              founder owns. This is not a second company and not a catalog of Atelier products.
            </p>
            <div className="hero-actions">
              <AppLink className="btn btn-gold" href={COMMERCE_LAUNCH_BRIEF_HREF}>
                Start a Commerce Launch brief
              </AppLink>
              <AppLink className="btn btn-emerald-glass" href={COMMERCE_FOUNDATION_BRIEF_HREF}>
                I already know what I sell
              </AppLink>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <p className="kicker">Who this is for</p>
          <h2>Two engagements. One studio.</h2>
          <p className="lede">
            The difference is the work required — not a longer list of decorations. Clients who
            already know what they sell do not buy product research.
          </p>
        </div>
        <div className="barbers-benefits">
          {COMMERCE_SITUATIONS.map((item, index) => (
            <Reveal as="article" className="surface-ivory barbers-benefit" delay={(index % 3) as 0 | 1 | 2} key={item.title}>
              <p className="tiny">{item.path}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="section-head">
          <p className="kicker">What this is</p>
          <h2>A commerce division inside Atelier.</h2>
        </div>
        <div className="barbers-benefits">
          {COMMERCE_BENEFITS.map((item, index) => (
            <Reveal as="article" className="surface-ivory barbers-benefit" delay={(index % 3) as 0 | 1 | 2} key={item.title}>
              <p className="tiny">0{index + 1}</p>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section" id="compare">
        <div className="section-head">
          <p className="kicker">Compare</p>
          <h2>Choose the work the brief actually needs.</h2>
          <p className="lede">
            {COMMERCE_FOUNDATION_OFFER.title} builds the store. {COMMERCE_LAUNCH_OFFER.title} adds
            sourcing and white-label direction first.
          </p>
        </div>
        <CommercePathCompare />
      </section>

      <section className="container section" id="launch">
        <div className="section-head">
          <p className="kicker">{COMMERCE_LAUNCH_OFFER.title}</p>
          <h2>Research, then a store the client owns.</h2>
          <p className="lede">{COMMERCE_LAUNCH_OFFER.summary}</p>
        </div>
        <ol className="barbers-walk">
          {COMMERCE_LAUNCH_STEPS.map((item) => (
            <li className="surface-read" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
        <Reveal as="article" className="service-feature surface-ivory" style={{ marginTop: 28 }}>
          <div>
            <p className="tiny">Included when Launch is the fit</p>
            <h2>A first assortment, not a finished catalog.</h2>
            <p className="lede">
              Identifying a supplier does not establish that the supplier is trustworthy, that the
              product will sell, or that the business will be profitable.
            </p>
            <AppLink className="btn btn-gold" href={COMMERCE_LAUNCH_BRIEF_HREF}>
              Start a Commerce Launch brief
            </AppLink>
          </div>
          <div className="surface-read service-spec">
            <h3>Includes</h3>
            <ul>
              {COMMERCE_LAUNCH_INCLUDES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Does not include</h3>
            <ul>
              {COMMERCE_LAUNCH_EXCLUDES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="container section" id="foundation">
        <Reveal as="article" className="service-feature surface-ivory">
          <div>
            <p className="tiny">{COMMERCE_FOUNDATION_OFFER.title}</p>
            <h2>A storefront for products that already exist.</h2>
            <p className="lede">{COMMERCE_FOUNDATION_OFFER.summary}</p>
            <p>{ATELIER_COMMERCE_PUBLIC_TERMS}</p>
            <AppLink className="btn btn-gold" href={COMMERCE_FOUNDATION_BRIEF_HREF}>
              Start a Commerce Foundation brief
            </AppLink>
          </div>
          <div className="surface-read service-spec">
            <h3>Includes</h3>
            <ul>
              {COMMERCE_FOUNDATION_INCLUDES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h3>Does not include</h3>
            <ul>
              {COMMERCE_FOUNDATION_EXCLUDES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      <section className="container section">
        <div className="section-head">
          <p className="kicker">Platforms and ownership</p>
          <h2>The client owns the store account.</h2>
          <p className="lede">
            Shopify is the usual starting platform. WooCommerce is used when the client already lives
            in WordPress or needs that ownership model. Custom or headless work is only scoped when
            a standard store cannot carry the brief. Atelier does not collect payments for that store.
          </p>
        </div>
      </section>

      <section className="container section" id="demonstration">
        <div className="section-head">
          <p className="kicker">Illustrative direction</p>
          <h2>How a considered storefront can feel.</h2>
          <p className="lede">
            Halcyon Still is a labeled demonstration. It is not a catalog of products for sale, not a
            client record, and not a claim of completed commerce results.
          </p>
        </div>
        <DeviceFrame variant="desktop" depth="tile" label="Illustrative storefront">
          <DemoStore />
        </DeviceFrame>
      </section>

      <section className="container section" id="questions">
        <div className="section-head">
          <p className="kicker">Questions</p>
          <h2>Clear limits. No invented guarantees.</h2>
        </div>
        <div className="barbers-faq">
          {COMMERCE_FAQ.map((item) => (
            <article className="surface-ivory" key={item.id}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
        <div className="row" style={{ marginTop: 28 }}>
          <AppLink className="btn btn-gold" href={COMMERCE_LAUNCH_BRIEF_HREF}>
            Start a Commerce Launch brief
          </AppLink>
          <AppLink className="btn btn-emerald-glass" href={COMMERCE_FOUNDATION_BRIEF_HREF}>
            Start a Commerce Foundation brief
          </AppLink>
          <AppLink className="btn btn-ghost" href="/services">
            All services
          </AppLink>
          <AppLink className="btn btn-ghost" href="/pricing">
            How investment works
          </AppLink>
        </div>
      </section>
    </div>
  );
}
