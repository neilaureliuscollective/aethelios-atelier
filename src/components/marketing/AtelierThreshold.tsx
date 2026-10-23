import { Reveal } from "@/components/motion/Reveal";
import { AppLink } from "@/components/ui/AppLink";
import { FULL_LOGO } from "@/lib/brand/fullLogo";
import { INTELLIGENCE_DISPLAY_NAME } from "@/lib/copy";
import { ATELIER_COMMERCE_HREF } from "@/lib/offers/commerce";
import { SERVICE_CATEGORY_COPY, serviceBriefHref, type VisibleProjectType } from "@/lib/serviceCategories";
import styles from "./atelierThreshold.module.css";

/**
 * The homepage’s second room. The orb stage carries no company statement, so this
 * section says who Atelier is and what it builds before the selected work is shown.
 */
const DISCIPLINES: { id: VisibleProjectType; numeral: string; line: string; href: string }[] = [
  {
    id: "website",
    numeral: "I",
    line: "A public presence that earns trust before the first conversation.",
    href: serviceBriefHref("website")
  },
  {
    id: "custom_apps_platforms",
    numeral: "II",
    line: "Portals and tools shaped around how the work actually happens.",
    href: serviceBriefHref("custom_apps_platforms")
  },
  {
    id: "ecommerce_storefronts",
    numeral: "III",
    line: "A storefront the business owns, connected to the tools it already uses.",
    href: ATELIER_COMMERCE_HREF
  },
  {
    id: "digital_infrastructure",
    numeral: "IV",
    line: "The quiet connections that keep the work moving behind the scenes.",
    href: serviceBriefHref("digital_infrastructure")
  }
];

const STANDARDS = [
  {
    title: "One accountable founder",
    copy: "Neil Stutes reads every brief he accepts and answers for scope, price, and delivery."
  },
  {
    title: "Written before it is built",
    copy: "A living brief, then a versioned proposal. You agree to the exact version that gets built."
  },
  {
    title: "No subscription to begin",
    copy: "Explore, talk, and send a brief without an account. Nothing is sent until you consent."
  }
] as const;

export function AtelierThreshold() {
  return (
    <section className={styles.threshold} id="the-atelier" aria-labelledby="atelier-heading">
      <div className={styles.descent} aria-hidden="true" />
      <div className={styles.shell}>
        <Reveal className={styles.statement}>
          <img
            className={styles.mark}
            src={FULL_LOGO.markSrc}
            alt=""
            width={FULL_LOGO.markWidth}
            height={FULL_LOGO.markHeight}
            loading="lazy"
            decoding="async"
          />
          <p className={styles.kicker}>Aethelios Atelier · A founder-led digital studio</p>
          <h2 id="atelier-heading" className={styles.heading}>
            Your vision.
            <br />
            <em>Personally built.</em>
          </h2>
          <p className={styles.lede}>
            Aethelios Atelier designs and builds the digital side of serious businesses — branded
            websites, custom platforms, storefronts, and the infrastructure that keeps it all running.
            Every commission is reviewed, scoped, and delivered by Neil Stutes.
          </p>
          <p className={styles.orbNote}>
            <span className={styles.orbDot} aria-hidden="true" />
            {INTELLIGENCE_DISPLAY_NAME}, the orb above, is the studio’s intelligence. It helps you shape
            the idea out loud. Neil decides what gets built — and builds it.
          </p>
        </Reveal>

        <Reveal as="ol" className={styles.disciplines} delay={1} aria-label="What Atelier builds">
          {DISCIPLINES.map((discipline) => {
            const copy = SERVICE_CATEGORY_COPY[discipline.id];
            return (
              <li key={discipline.id} className={styles.discipline}>
                <AppLink className={styles.disciplineLink} href={discipline.href}>
                  <span className={styles.numeral} aria-hidden="true">
                    {discipline.numeral}
                  </span>
                  <span className={styles.disciplineShort}>{copy.short}</span>
                  <span className={styles.disciplineTitle}>{copy.title}</span>
                  <span className={styles.disciplineLine}>{discipline.line}</span>
                  <span className={styles.disciplineArrow} aria-hidden="true">
                    →
                  </span>
                </AppLink>
              </li>
            );
          })}
        </Reveal>

        <Reveal className={styles.standards} delay={2}>
          {STANDARDS.map((standard) => (
            <article key={standard.title} className={styles.standard}>
              <h3 className={styles.standardTitle}>{standard.title}</h3>
              <p className={styles.standardCopy}>{standard.copy}</p>
            </article>
          ))}
        </Reveal>

        <Reveal className={styles.bridge} delay={3}>
          <span className={styles.bridgeRule} aria-hidden="true" />
          <p className={styles.bridgeLine}>
            Proof before promises. <em>One completed commission, live today.</em>
          </p>
          <a className={styles.bridgeLink} href="#selected-work">
            See the work
            <span aria-hidden="true">↓</span>
          </a>
        </Reveal>
      </div>
    </section>
  );
}
