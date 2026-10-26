import { AppsIcon, GlobeIcon, NodesIcon, StoreIcon } from "@/components/ui/Icons";
import { AppLink } from "@/components/ui/AppLink";
import { Reveal } from "@/components/motion/Reveal";
import { SERVICE_CATALOG } from "@/lib/catalog";
import { BEGIN_HREF, BEGIN_LABEL } from "@/lib/publicSite";
import { SERVICE_CATEGORY_COPY, serviceBriefHref, type VisibleProjectType } from "@/lib/serviceCategories";

type CommissionId = Exclude<VisibleProjectType, "undecided">;

const COMMISSIONS: { id: CommissionId; icon: typeof GlobeIcon }[] = [
  { id: "website", icon: GlobeIcon },
  { id: "custom_apps_platforms", icon: AppsIcon },
  { id: "ecommerce_storefronts", icon: StoreIcon },
  { id: "digital_infrastructure", icon: NodesIcon }
];

const FACTORS = [
  ["Scope", "How many pages, screens, and features — and how much has to be built new rather than refined."],
  ["Integrations", "Booking, payments, inventory, and the tools the business already runs on, and how deeply they connect."],
  ["Content and brand", "Whether the words, photography, and identity exist, need refining, or need to be made."],
  ["Timeline", "When it has to launch, and how much has to move at once to get there."]
] as const;

const PROCESS = [
  ["01", "Talk it through", "Tell Aethelios what you run, who it serves, and what has to work better.", BEGIN_HREF],
  ["02", "Neil reviews", "Neil reads the direction personally and follows up if anything needs clarifying.", "/approach"],
  ["03", "Written proposal", "Scope, investment, and timing are set out in writing before anything is built.", "/approach"],
  ["04", "Build", "Design and development proceed against the agreed proposal, in agreed stages.", "/approach"],
  ["05", "Ongoing care", "Hosting, care, and refinement after launch — offered when it fits the build, never assumed.", "/approach"]
] as const;

const FAQ = [
  [
    "Why aren’t prices listed?",
    "Because a focused website for a barbershop and a client portal for a growing firm are different commissions. A package price would either overcharge one or under-build the other. Every project is scoped and priced to what the business actually needs."
  ],
  [
    "How do I get a number?",
    "Talk your business through with Aethelios and send the direction it writes, or send a short inquiry. Neil reviews it personally and, when the fit is right, replies with a written proposal."
  ],
  [
    "Is there a monthly subscription?",
    "No. Ongoing hosting and care are offered when they fit the build, scoped in the same proposal. Nothing renews without your agreement."
  ],
  [
    "Do I have to purchase a rebrand?",
    "No. Branding can be commissioned on its own or carried as a quality of the work. A rebrand is not required to begin."
  ],
  [
    "What about third-party costs?",
    "Booking, commerce, hosting, and similar providers can stay where they already are. Their charges are separate, and the proposal names any you would need."
  ],
  [
    "Can I pay here?",
    "No. This site does not collect payment. Terms and invoicing are set out in the proposal you agree to."
  ]
] as const;

export function PricingExperience() {
  return (
    <div className="pricing-page">
      <section className="container pricing-hero">
        <div className="pricing-hero-copy">
          <p className="kicker">Investment</p>
          <h1>
            Built to your business.
            <br />
            Priced to the work.
          </h1>
          <p className="lede">
            There are no packages here, because no two businesses need the same thing. Every
            website, app, storefront, and system Atelier builds is scoped to what your business
            actually needs — and Neil prices it personally, in writing, before anything begins.
          </p>
          <p className="notice pricing-honesty">
            Talking with Aethelios and sending your direction costs nothing and commits you to
            nothing. This site does not collect payment.
          </p>
          <div className="hero-actions">
            <AppLink className="btn btn-gold" href={BEGIN_HREF}>
              {BEGIN_LABEL}
            </AppLink>
            <AppLink className="btn btn-ghost" href="/inquire">
              Send an inquiry
            </AppLink>
          </div>
        </div>
        <aside className="pricing-ways surface-obsidian" aria-labelledby="pricing-ways-heading">
          <p className="kicker">How a project is priced</p>
          <h2 id="pricing-ways-heading">One considered build. Care when it fits.</h2>
          <ol>
            <li>
              <strong>The build</strong>
              <span>
                A one-time investment for strategy, design, and development, fixed in a written
                proposal before work begins.
              </span>
            </li>
            <li>
              <strong>Ongoing care</strong>
              <span>
                Hosting, care, and refinement after launch, priced to what was built. Optional,
                and agreed in the same proposal.
              </span>
            </li>
          </ol>
        </aside>
      </section>

      <section className="container section" id="commissions">
        <div className="section-head split-head">
          <div>
            <p className="kicker">Commissions</p>
            <h2>What can be commissioned.</h2>
          </div>
          <p className="lede">
            Each begins the same way: a conversation about the business. Independent barbers and
            salons can also start from a <AppLink href="/services/barbers-salons">focused website offer</AppLink>,
            and storefront work from <AppLink href="/services/commerce">Atelier Commerce</AppLink>.
          </p>
        </div>
        <div className="pricing-commission-list">
          {COMMISSIONS.map(({ id, icon: Icon }, index) => {
            const offer = SERVICE_CATALOG.offers.find((item) => item.id === id);
            const copy = SERVICE_CATEGORY_COPY[id];
            return (
              <Reveal
                as="article"
                className="pricing-commission surface-ivory"
                delay={(index % 3) as 0 | 1 | 2}
                key={id}
              >
                <p className="tiny">{offer?.status === "exploratory" ? "Exploratory" : "Offered"}</p>
                <Icon />
                <h3>{offer?.title ?? copy.title}</h3>
                <p className="muted">{copy.summary}</p>
                <AppLink className="btn btn-emerald-glass btn-compact" href={serviceBriefHref(id)}>
                  {BEGIN_LABEL}
                </AppLink>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="container section" id="factors">
        <div className="section-head">
          <p className="kicker">What shapes the investment</p>
          <h2>Four things decide the number.</h2>
        </div>
        <div className="pricing-boundaries">
          {FACTORS.map(([title, copy]) => (
            <article className="surface-ivory" key={title}>
              <h3>{title}</h3>
              <p className="muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container section" id="process">
        <div className="section-head">
          <p className="kicker">Process</p>
          <h2>Understand, then agree, then build.</h2>
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

      <section className="container section" id="faq">
        <div className="section-head">
          <p className="kicker">Questions</p>
          <h2>Direct answers before you begin.</h2>
        </div>
        <div className="pricing-faq">
          {FAQ.map(([question, answer]) => (
            <details className="pricing-faq-item surface-ivory" key={question}>
              <summary>{question}</summary>
              <p className="muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="container section">
        <div className="founder-band surface-obsidian">
          <div>
            <p className="kicker">Begin</p>
            <h2>Start with the business. The number follows.</h2>
            <p className="lede lede-bright">
              Tell Aethelios what you run and where it needs to go. Neil reads every direction
              personally and replies with a proposal built around it.
            </p>
            <div className="hero-actions">
              <AppLink className="btn btn-gold" href={BEGIN_HREF}>
                {BEGIN_LABEL}
              </AppLink>
              <AppLink className="btn btn-ghost" href="/inquire">
                Send an inquiry
              </AppLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
