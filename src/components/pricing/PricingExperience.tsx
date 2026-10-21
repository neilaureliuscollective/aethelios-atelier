import { AppsIcon, GlobeIcon, NodesIcon, StoreIcon } from "@/components/ui/Icons";
import { AppLink } from "@/components/ui/AppLink";
import { Reveal } from "@/components/motion/Reveal";
import { PLAN_LABELS, type PlanId } from "@/lib/pricing/ids";
import type { PricingPresentation } from "@/lib/pricing/presentation";

const COMMISSION_ICONS = {
  website: GlobeIcon,
  custom_apps_platforms: AppsIcon,
  ecommerce_storefronts: StoreIcon,
  digital_infrastructure: NodesIcon
} as const;

const PROCESS = [
  ["01", "Explore", "Try a direction in Discovery. Nothing is sent from that studio.", "/discover"],
  ["02", "Brief", "Write what the business actually needs. A plan note can be reviewed, changed, or left out.", "/project"],
  ["03", "Founder review", "Neil opens accepted work. Submitted is not the same as under review.", "/approach"],
  ["04", "Agreed scope", "Deliverables, price, and timing are confirmed only in a written proposal.", "/approach"],
              ["05", "Delivery or relationship", "Build proceeds against the agreed version. An ongoing plan can sit beside a commission when that is the fit.", "/project"]
] as const;

export function PricingExperience({ presentation }: { presentation: PricingPresentation }) {
  const local = presentation.mode === "local_review";

  return (
    <div className="pricing-page">
      {local && presentation.reviewBanner ? (
        <p className="pricing-review-banner" role="status">
          {presentation.reviewBanner}
        </p>
      ) : null}

      <section className="container pricing-hero">
        <div className="pricing-hero-copy">
          <p className="kicker">Pricing</p>
          <h1>
            Human-led work,
            <br />
            held with care.
          </h1>
          <p className="lede">
            Atelier is a founder-led studio. Neil Stutes reviews every brief, confirms what will be
            built, and remains accountable for price and timing. You can explore, write, and request
            a commission without buying a monthly plan.
          </p>
          <div className="hero-actions">
            <AppLink className="btn btn-emerald-glass" href="/discover">
              Explore your project
            </AppLink>
            <AppLink className="btn btn-gold" href="/project">
              Begin a brief
            </AppLink>
          </div>
        </div>
        <aside className="pricing-ways surface-obsidian" aria-labelledby="pricing-ways-heading">
          <p className="kicker">Two ways of working</p>
          <h2 id="pricing-ways-heading">A commission, a relationship, or both.</h2>
          <ol>
            <li>
              <strong>Founder-led commissions</strong>
              <span>
                Branded websites, custom apps and platforms, storefronts, and scoped digital
                infrastructure. Branding can be commissioned separately.
              </span>
            </li>
            <li>
              <strong>Ongoing Atelier plans</strong>
              <span>
                A monthly relationship around the private commission workspace and founder-led
                support. It is separate from a scoped commission and from the main Aethelios
                product. Remaining terms are confirmed in a proposal.
              </span>
            </li>
          </ol>
        </aside>
      </section>

      <nav className="container pricing-switch" aria-label="Pricing sections">
        <AppLink className="btn btn-ghost btn-compact" href="#commissions">
          Project commissions
        </AppLink>
        <AppLink className="btn btn-ghost btn-compact" href="#plans">
          Ongoing plans
        </AppLink>
        <AppLink className="btn btn-ghost btn-compact" href="#comparison">
          Compare
        </AppLink>
        <AppLink className="btn btn-ghost btn-compact" href="#faq">
          Questions
        </AppLink>
      </nav>

      <section className="container section" id="commissions">
        <div className="section-head split-head">
          <div>
            <p className="kicker">Commissions</p>
            <h2>Scoped work, reviewed by Neil.</h2>
          </div>
          <p className="lede">
            Describe the need. Neil confirms deliverables, price, and timing before work is
            accepted. A monthly plan is not required to begin, and a rebrand is not required to
            start. Independent barbers and salons can also begin from a{" "}
            <AppLink href="/services/barbers-salons">focused website offer</AppLink> — that is not a
            fourth published plan, and its exact proposal is confirmed by Neil.
          </p>
        </div>
        <div className="pricing-commission-list">
          {presentation.commissions.map((commission, index) => {
            const Icon = COMMISSION_ICONS[commission.id];
            return (
              <Reveal
                as="article"
                className="pricing-commission surface-ivory"
                delay={(index % 3) as 0 | 1 | 2}
                key={commission.id}
              >
                <p className="tiny">{commission.status === "exploratory" ? "Exploratory" : "Offered"}</p>
                <Icon />
                <h3>{commission.title}</h3>
                <p className="muted">{commission.summary}</p>
                <AppLink className="btn btn-emerald-glass btn-compact" href={commission.href}>
                  {commission.action}
                </AppLink>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="container section" id="plans">
        <div className="section-head split-head">
          <div>
            <p className="kicker">Ongoing plans</p>
            <h2>A relationship, not a checkout.</h2>
          </div>
          <p className="lede">
            These plans list a one-time setup charge and a monthly service charge in USD. The
            monthly amount is the ongoing studio relationship. Selecting a plan does not start a
            subscription, collect payment, or unlock unlimited websites, coding, revisions, AI, or
            integrations. Custom commissions are scoped separately. Beyond the listed prices,
            differences between plans are confirmed by Neil.
          </p>
        </div>
        <div className="pricing-plan-grid">
          {presentation.plans.map((plan, index) => (
            <Reveal
              as="article"
              className={`pricing-plan ${plan.id === "partnership" ? "surface-obsidian" : "surface-ivory"}`}
              data-pricing-plan={plan.id}
              delay={(index % 3) as 0 | 1 | 2}
              key={plan.id}
            >
              <p className="tiny" data-pricing-eyebrow>
                {local ? "Local review" : "USD"}
              </p>
              <h3>{plan.name}</h3>
              <p className={plan.id === "partnership" ? "lede-bright" : "muted"}>{plan.relationship}</p>
              <dl className="pricing-charges">
                <div>
                  <dt data-pricing-charge="setup">Setup</dt>
                  <dd data-pricing-amount="setup">{plan.setup.formatted}</dd>
                </div>
                <div>
                  <dt data-pricing-charge="ongoing">Ongoing</dt>
                  <dd data-pricing-amount="ongoing">{plan.recurring.formatted}</dd>
                </div>
              </dl>
              {local && plan.founderDecisions.length > 0 ? (
                <ul className="pricing-founder-notes">
                  {plan.founderDecisions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <AppLink className="btn btn-emerald-glass" href={plan.action.href}>
                {plan.action.label}
              </AppLink>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="container section" id="meaning">
        <div className="section-head">
          <p className="kicker">What the charges mean</p>
          <h2>Setup, monthly service, and separately scoped work.</h2>
        </div>
        <div className="pricing-meaning">
          <article className="surface-ivory">
            <h3>Setup</h3>
            <p className="muted">
              Setup is the one-time starting charge for that plan. It is not collected here and
              does not mean work has been accepted. Partnership setup stays quoted until Neil
              writes a specific figure. Quoted setup is never shown as $0.
            </p>
          </article>
          <article className="surface-ivory">
            <h3>Ongoing</h3>
            <p className="muted">
              Ongoing is the monthly Atelier relationship around the private commission workspace
              and founder-led support. It is not the main Aethelios product, not unlimited custom
              work, and not a charge collected here. Custom commissions stay separately scoped. A
              proposal confirms deliverables before work begins.
            </p>
          </article>
        </div>
      </section>

      <section className="container section" id="comparison">
        <div className="section-head">
          <p className="kicker">Comparison</p>
          <h2>Published prices, and what a proposal still confirms.</h2>
          <p className="lede">
            Setup and monthly amounts match the plan cards. Remaining deliverables and terms are
            confirmed in a written proposal. Capabilities that are not offered yet are not sold as
            extras.
          </p>
        </div>
        <div className="pricing-compare">
          {presentation.comparison.map((row) => (
            <article className="pricing-compare-row surface-read" key={row.id}>
              <h3>
                {row.label}
                {row.founderDecision ? <span className="tiny"> Founder decision</span> : null}
              </h3>
              <dl>
                {(Object.keys(PLAN_LABELS) as PlanId[]).map((id) => (
                  <div key={id}>
                    <dt>{PLAN_LABELS[id]}</dt>
                    <dd>{row.values[id]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="container section" id="process">
        <div className="section-head">
          <p className="kicker">Process</p>
          <h2>Explore, then agree, then build.</h2>
        </div>
        <ol className="pricing-process">
          {PROCESS.map(([num, title, copy, href], index) => (
            <Reveal as="li" className="surface-ivory approach-step" delay={(index % 3) as 0 | 1 | 2} key={title}>
              <span className="num">{num}</span>
              <div>
                <h3>{title}</h3>
                <p className="muted">{copy}</p>
                <AppLink className="btn btn-ghost btn-compact" href={href}>
                  Continue
                </AppLink>
              </div>
            </Reveal>
          ))}
        </ol>
      </section>

      <section className="container section" id="boundaries">
        <div className="section-head">
          <p className="kicker">Boundaries</p>
          <h2>What stays outside these prices.</h2>
        </div>
        <div className="pricing-boundaries">
          <article className="surface-ivory">
            <h3>Larger changes</h3>
            <p className="muted">
              Material changes after an agreed proposal are reviewed by Neil. Nothing on this page
              is an unlimited-revision, unlimited-website, or unlimited-coding allowance.
            </p>
          </article>
          <article className="surface-ivory">
            <h3>Third-party costs</h3>
            <p className="muted">
              Booking, commerce, hosting, and similar providers stay where they already are when
              that is the fit. Their charges are not collected in Atelier and are not priced here.
            </p>
          </article>
          <article className="surface-ivory">
            <h3>Capabilities not offered yet</h3>
            <p className="muted">
              Live AI, voice, notifications, and billing are not available to purchase here. Their
              presence in the product later would be confirmed separately.
            </p>
          </article>
        </div>
      </section>

      <section className="container section" id="faq">
        <div className="section-head">
          <p className="kicker">Questions</p>
          <h2>Direct answers before you write.</h2>
        </div>
        <div className="pricing-faq">
          {presentation.faq.map((item) => (
            <details className="pricing-faq-item surface-ivory" key={item.id}>
              <summary>{item.question}</summary>
              <p className="muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      {local && presentation.founderChecklist.length > 0 ? (
        <section className="container section" id="founder-checklist">
          <div className="section-head">
            <p className="kicker">Local review</p>
            <h2>Remaining founder decisions.</h2>
            <p className="lede">
              Unresolved commercial terms stay on this isolated checklist. They are not published
              as customer policy.
            </p>
          </div>
          <ol className="pricing-checklist surface-read">
            {presentation.founderChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="container section">
        <div className="founder-band surface-obsidian">
          <div>
            <p className="kicker">Begin</p>
            <h2>Explore first. Agree before anything is built.</h2>
            <p className="lede lede-bright">
              Explore a direction, write a brief, and let Neil review it. Selecting a plan only
              offers a discussion note you can keep, change, or leave behind. Nothing here buys a
              subscription.
            </p>
            <div className="hero-actions">
              <AppLink className="btn btn-emerald-glass" href="/discover">
                Explore your project
              </AppLink>
              <AppLink className="btn btn-gold" href="/project">
                Begin a brief
              </AppLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
