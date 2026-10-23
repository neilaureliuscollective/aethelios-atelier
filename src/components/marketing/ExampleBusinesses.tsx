import styles from "./examples.module.css";

export function IllustrativeBadge() {
  return <p className={styles.badge}>Illustrative concept · not a completed commission</p>;
}

export function CoteauFieldSite({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.site} ${density === "phone" ? styles.phone : ""}`}>
      <IllustrativeBadge />
      <header>
        <strong className={styles.word}>Coteau Field</strong>
        <div className={styles.nav} aria-hidden="true">
          <span>Work</span>
          <span>Process</span>
          <span>Parish</span>
        </div>
        <span className={styles.enquire}>Enquire</span>
      </header>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Custom homes · Lafayette &amp; Youngsville</p>
          <h3>Homes built for this parish.</h3>
          <p className={styles.lede}>
            A public presence for a builder who already knows the land, the light, and the next
            conversation. No booking product — a clear enquire.
          </p>
          <span className={styles.cta}>View the work</span>
        </div>
        <figure>
          <picture>
            <source srcSet="/atmosphere/coteau-field.webp" type="image/webp" />
            <img
              src="/atmosphere/coteau-field.jpg"
              alt="Illustrative night house used inside a Lafayette builder website example"
              width={1600}
              height={900}
            />
          </picture>
        </figure>
      </section>
      {density === "desktop" ? (
        <ul className={styles.pillars}>
          <li>
            <strong>Parish land</strong>
            Lots in Lafayette, Youngsville, and the coteau — not a catalog of other climates.
          </li>
          <li>
            <strong>Night presence</strong>
            Photography that shows how a house holds after dark, when people actually arrive.
          </li>
          <li>
            <strong>Named process</strong>
            From first walk to last punch, with a price said only after review.
          </li>
          <li>
            <strong>Clear next step</strong>
            Enquire. This example does not invent a booking engine.
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export function NightjarRoast({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.site} ${styles.storefront} ${density === "phone" ? styles.phone : ""}`}>
      <IllustrativeBadge />
      <header>
        <strong className={styles.word}>Nightjar Roast</strong>
        <div className={styles.nav} aria-hidden="true">
          <span>Roast</span>
          <span>Pantry</span>
          <span>Visit</span>
        </div>
        <span className={styles.enquire}>Shop</span>
      </header>
      <section className={styles.store}>
        <figure className={styles.product}>
          <picture>
            <source srcSet="/atmosphere/nightjar-roast.webp" type="image/webp" />
            <img
              src="/atmosphere/nightjar-roast.jpg"
              alt="Illustrative coffee bag and amber bottle used inside a storefront example"
              width={800}
              height={600}
            />
          </picture>
        </figure>
        <div>
          <p className={styles.kicker}>Parish pantry</p>
          <h3>Quiet objects, clearly offered.</h3>
          <p className={styles.lede}>
            A Lafayette roast and a small-batch extract, shown the way a shop would hold them —
            dark still-life, one gold price. Payments are not collected here.
          </p>
          <p className={styles.price}>Parish roast · shown as an example, not for sale</p>
          <span className={styles.cta}>Shop the roast</span>
        </div>
      </section>
      {density === "desktop" ? (
        <div className={styles.products}>
          <article className={styles.product}>
            <picture>
              <source srcSet="/atmosphere/nightjar-roast.webp" type="image/webp" />
              <img src="/atmosphere/nightjar-roast.jpg" alt="" width={400} height={240} />
            </picture>
            <p>
              <strong>Parish roast</strong>
              <br />
              Whole bean, dark bag
            </p>
          </article>
          <article className={styles.product}>
            <picture>
              <source srcSet="/atmosphere/sable-hearth.webp" type="image/webp" />
              <img src="/atmosphere/sable-hearth.jpg" alt="" width={400} height={240} />
            </picture>
            <p>
              <strong>Table reserve</strong>
              <br />
              A still for the shop journal
            </p>
          </article>
        </div>
      ) : null}
    </div>
  );
}

export function CoteauYard({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.app} ${density === "phone" ? styles.phone : ""}`}>
      <p className={styles.badge}>Illustrative app · not a live operations product</p>
      <header>
        <strong className={styles.word}>Coteau Yard</strong>
        <div className={styles.nav} aria-hidden="true">
          <span>Jobs</span>
          <span>Selections</span>
          <span>Punch</span>
        </div>
        <span className={styles.enquire}>Today</span>
      </header>
      <div className={styles.appGrid}>
        <article className={styles.card}>
          <p>Today’s site</p>
          <strong>Walk the Youngsville lot before the pour.</strong>
          <ul>
            <li>
              Selections <span>3 open</span>
            </li>
            <li>
              Punch items <span>Ready</span>
            </li>
            <li>
              Next visit <span>Thursday</span>
            </li>
          </ul>
        </article>
        <article className={styles.card}>
          <p>Purpose-built screens</p>
          <strong>A builder’s yard book, not a generic dashboard.</strong>
          <ul>
            <li>
              Role <span>Superintendent</span>
            </li>
            <li>
              Job <span>Coteau Field 14</span>
            </li>
          </ul>
        </article>
        {density === "desktop" ? (
          <article className={`${styles.card} ${styles.wide}`}>
            <p>What this kind of commission is for</p>
            <strong>Tools that match how the crew already works.</strong>
            <ul>
              <li>
                Shared files, a punch list, and a next site visit — without inventing a CRM.
              </li>
            </ul>
          </article>
        ) : null}
      </div>
    </div>
  );
}

export function SableReserve({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.relay} ${density === "phone" ? styles.phone : ""}`}>
      <p className={styles.badge}>Illustrative workflow · not a proprietary platform</p>
      <header>
        <strong className={styles.word}>Sable Hearth</strong>
        <span className={styles.enquire}>Reserve</span>
      </header>
      <figure className={styles.relayStill}>
        <picture>
          <source srcSet="/atmosphere/sable-hearth.webp" type="image/webp" />
          <img
            src="/atmosphere/sable-hearth.jpg"
            alt="Illustrative dining still used inside a reservation-handoff example"
            width={1600}
            height={900}
          />
        </picture>
      </figure>
      <div className={styles.flow}>
        <article className={styles.step}>
          <span>01</span>
          <strong>Public site</strong>
          <p>Jefferson Street dining, found first.</p>
        </article>
        <article className={styles.step}>
          <span>02</span>
          <strong>Existing tool</strong>
          <p>The reservation book they already trust.</p>
        </article>
        <article className={styles.step}>
          <span>03</span>
          <strong>Handoff</strong>
          <p>A table held — not a new system to learn.</p>
        </article>
      </div>
      {density === "desktop" ? (
        <p className={styles.note}>
          Demonstration of a practical connection — Atelier does not operate the reservation or
          payment tools.
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use CoteauFieldSite */
export function NorthridgeSite(props: { density?: "desktop" | "phone" }) {
  return <CoteauFieldSite {...props} />;
}

/** @deprecated Use NightjarRoast */
export function HalcyonStore(props: { density?: "desktop" | "phone" }) {
  return <NightjarRoast {...props} />;
}

/** @deprecated Use CoteauYard */
export function MarlowPortal(props: { density?: "desktop" | "phone" }) {
  return <CoteauYard {...props} />;
}

/** @deprecated Use SableReserve */
export function HarborRelay(props: { density?: "desktop" | "phone" }) {
  return <SableReserve {...props} />;
}
