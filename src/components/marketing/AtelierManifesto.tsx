import { AppLink } from "@/components/ui/AppLink";
import { Reveal } from "@/components/motion/Reveal";
import { FULL_LOGO } from "@/lib/brand/fullLogo";
import { ATELIER_COMMERCE_HREF } from "@/lib/offers/commerce";
import { SERVICE_CATEGORY_COPY, serviceBriefHref } from "@/lib/serviceCategories";
import styles from "./atelierManifesto.module.css";

const DISCIPLINES = [
  {
    num: "01",
    title: SERVICE_CATEGORY_COPY.website.title,
    line: "A public presence as considered as the work behind it.",
    href: serviceBriefHref("website")
  },
  {
    num: "02",
    title: SERVICE_CATEGORY_COPY.custom_apps_platforms.title,
    line: "Portals and tools shaped around how the work actually happens.",
    href: serviceBriefHref("custom_apps_platforms")
  },
  {
    num: "03",
    title: SERVICE_CATEGORY_COPY.ecommerce_storefronts.title,
    line: "A storefront the business owns, connected to the tools it already uses.",
    href: ATELIER_COMMERCE_HREF
  },
  {
    num: "04",
    title: SERVICE_CATEGORY_COPY.digital_infrastructure.title,
    line: "The quiet connections that keep the work moving after launch.",
    href: serviceBriefHref("digital_infrastructure")
  }
] as const;

const STANDARDS = [
  ["Founder-reviewed", "Neil reads every brief, sets every scope, and answers for every delivery himself."],
  ["Built around you", "The booking, payment, and tools you already use stay. Neil builds the experience around them."],
  ["Clear from the start", "Every build is scoped and priced to the business. Nothing is final until Neil confirms the proposal."]
] as const;

/** Second homepage beat: says what the studio is before the work proves it. */
export function AtelierManifesto() {
  return (
    <section className={styles.manifesto} id="atelier" aria-labelledby="atelier-heading">
      <div className={styles.seam} aria-hidden="true" />
      <div className={styles.watermark} aria-hidden="true">
        Atelier
      </div>
      <div className={styles.shell}>
        <Reveal className={styles.statement}>
          <img
            className={styles.seal}
            src={FULL_LOGO.markSrc}
            alt=""
            width={FULL_LOGO.markWidth}
            height={FULL_LOGO.markHeight}
            loading="lazy"
            decoding="async"
          />
          <p className={styles.kicker}>Aethelios Atelier · Founded and led by Neil Stutes</p>
          <h2 id="atelier-heading" className={styles.heading}>
            Your vision.
            <br />
            <em>Personally built.</em>
          </h2>
          <p className={styles.lede}>
            Neil Stutes designs and builds digital presence for businesses that refuse to look ordinary — branded
            websites, custom platforms, storefronts, and the systems underneath them.
          </p>
          <p className={styles.body}>
            Neil holds every commission himself, from first brief to final delivery. No agency handoffs, no
            template mill, and no subscription to begin.
          </p>
        </Reveal>

        <Reveal className={styles.index} delay={1}>
          <p className={styles.indexLabel}>What Neil builds</p>
          <ol className={styles.disciplines}>
            {DISCIPLINES.map((item) => (
              <li key={item.num}>
                <AppLink className={styles.discipline} href={item.href}>
                  <span className={styles.num}>{item.num}</span>
                  <span className={styles.disciplineText}>
                    <span className={styles.disciplineTitle}>{item.title}</span>
                    <span className={styles.disciplineLine}>{item.line}</span>
                  </span>
                  <span className={styles.arrow} aria-hidden="true">
                    →
                  </span>
                </AppLink>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>

      <Reveal className={styles.standards} delay={2}>
        <ul aria-label="How a commission is held">
          {STANDARDS.map(([title, copy]) => (
            <li key={title}>
              <span className={styles.standardTitle}>{title}</span>
              <span className={styles.standardCopy}>{copy}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <div className={styles.bridge}>
        <span className={styles.bridgeRule} aria-hidden="true" />
        <p>The work speaks first.</p>
        <a className={styles.bridgeLink} href="#selected-work">
          See the selected work
          <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  );
}
