import styles from "./examples.module.css";

export function IllustrativeBadge() {
  return <p className={styles.badge}>Illustrative concept · not a completed commission</p>;
}

export function NorthridgeSite({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.site} ${density === "phone" ? styles.phone : ""}`}>
      <IllustrativeBadge />
      <header>
        <strong className={styles.word}>Northridge</strong>
        <div className={styles.nav} aria-hidden="true">
          <span>Home</span>
          <span>Approach</span>
          <span>Our work</span>
          <span>Journal</span>
        </div>
        <span className={styles.enquire}>Enquire</span>
      </header>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>Custom homes · lasting places</p>
          <h3>Homes in harmony with place</h3>
          <p className={styles.lede}>
            Timber houses designed for the land they occupy — a public presence that explains the work
            before anyone writes.
          </p>
          <span className={styles.cta}>View our work</span>
        </div>
        <figure>
          <img
            src="/atmosphere/hearth.webp"
            alt="Illustrative timber house used inside a branded website example"
            width={1200}
            height={800}
          />
        </figure>
      </section>
      {density === "desktop" ? (
        <ul className={styles.pillars}>
          <li>
            <strong>Considered design</strong>
            Plans that begin with light, land, and how a family actually lives.
          </li>
          <li>
            <strong>Natural materials</strong>
            Timber, stone, and linen used with restraint rather than spectacle.
          </li>
          <li>
            <strong>Lasting craft</strong>
            Details meant to age in place, not chase a season of trends.
          </li>
          <li>
            <strong>Clear next step</strong>
            A visitor can enquire without a fabricated booking engine.
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export function HalcyonStore({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.site} ${styles.halcyon} ${density === "phone" ? styles.phone : ""}`}>
      <IllustrativeBadge />
      <header>
        <strong className={styles.word}>Halcyon Still</strong>
        <div className={styles.nav} aria-hidden="true">
          <span>Shop</span>
          <span>Journal</span>
          <span>Visit</span>
        </div>
        <span className={styles.enquire}>Collection</span>
      </header>
      <section className={styles.store}>
        <figure className={styles.product}>
          <img
            src="/atmosphere/storefront.webp"
            alt="Illustrative amber bottle used inside a storefront example"
            width={800}
            height={600}
          />
        </figure>
        <div>
          <p className={styles.kicker}>Seasonal edit</p>
          <h3>Quiet objects, clearly offered.</h3>
          <p className={styles.lede}>
            A commerce page that can carry scent, cloth, and still-life with room to decide. Payments
            are not collected in this demonstration.
          </p>
          <p className={styles.price}>Rest oil · shown as an example product, not for sale here</p>
          <span className={styles.cta}>View the collection</span>
        </div>
      </section>
      {density === "desktop" ? (
        <div className={styles.products}>
          <article className={styles.product}>
            <img src="/atmosphere/storefront.webp" alt="" width={400} height={240} />
            <p>
              <strong>Amber rest</strong>
              <br />
              Evening oil in corked glass
            </p>
          </article>
          <article className={styles.product}>
            <img src="/atmosphere/hearth.webp" alt="" width={400} height={240} />
            <p>
              <strong>Linen hour</strong>
              <br />
              A still-life for the shop journal
            </p>
          </article>
        </div>
      ) : null}
    </div>
  );
}

export function MarlowPortal({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.app} ${density === "phone" ? styles.phone : ""}`}>
      <p className={styles.badge}>Illustrative app · not a live operations product</p>
      <header>
        <strong className={styles.word}>Marlow Studio</strong>
        <div className={styles.nav} aria-hidden="true">
          <span>Overview</span>
          <span>Queue</span>
          <span>Files</span>
        </div>
        <span className={styles.enquire}>Review</span>
      </header>
      <div className={styles.appGrid}>
        <article className={styles.card}>
          <p>Today’s queue</p>
          <strong>Finish drawings for the river house</strong>
          <ul>
            <li>
              Site notes <span>Ready</span>
            </li>
            <li>
              Client questions <span>3 open</span>
            </li>
            <li>
              Next sitting <span>Thursday</span>
            </li>
          </ul>
        </article>
        <article className={styles.card}>
          <p>Purpose-built screens</p>
          <strong>A workshop portal, not a generic dashboard.</strong>
          <ul>
            <li>
              Role <span>Studio lead</span>
            </li>
            <li>
              Status <span>In review</span>
            </li>
          </ul>
        </article>
        {density === "desktop" ? (
          <article className={`${styles.card} ${styles.wide}`}>
            <p>What this kind of commission is for</p>
            <strong>Tools that match how the business already works.</strong>
            <ul>
              <li>
                Shared files, a review queue, and a next step — without inventing a CRM.
              </li>
            </ul>
          </article>
        ) : null}
      </div>
    </div>
  );
}

export function HarborRelay({ density = "desktop" }: { density?: "desktop" | "phone" }) {
  return (
    <div className={`${styles.relay} ${density === "phone" ? styles.phone : ""}`}>
      <p className={styles.badge}>Illustrative workflow · not a proprietary platform</p>
      <header>
        <strong className={styles.word}>Harbor Relay</strong>
      </header>
      <div className={styles.flow}>
        <article className={styles.step}>
          <span>01</span>
          <strong>Public site</strong>
          <p>The presence people find first.</p>
        </article>
        <article className={styles.step}>
          <span>02</span>
          <strong>Existing tools</strong>
          <p>Booking, files, or mail they already trust.</p>
        </article>
        <article className={styles.step}>
          <span>03</span>
          <strong>Handoff</strong>
          <p>A practical path, not a new system to learn.</p>
        </article>
      </div>
      {density === "desktop" ? (
        <p className={styles.note}>
          Demonstration of practical connections — Atelier does not operate the booking or payment tools.
        </p>
      ) : null}
    </div>
  );
}
