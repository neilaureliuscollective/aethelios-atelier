"use client";

import { AppLink } from "@/components/ui/AppLink";
import styles from "./DiscoveryStudio.module.css";

export function Entrance({ onExplore }: { onExplore: () => void }) {
  return (
    <section className={styles.hero} aria-labelledby="discover-hero">
      <div>
        <p className={styles.kicker}>Aethelios Atelier · discovery studio</p>
        <h1 id="discover-hero" className={styles.heading} data-discovery-heading tabIndex={-1}>
          See what your business
          <br />
          <span className={styles.gold}>could become.</span>
        </h1>
        <p className={styles.lede}>
          Arrive curious. Try on a direction. Leave with a clear commission sketch Neil Stutes can
          personally review. No account and no contact details are required to explore.
        </p>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.btnGold}`} type="button" onClick={onExplore}>
            Explore your direction
          </button>
          <AppLink className={`${styles.btn} ${styles.btnGhost}`} href="/project">
            I already know what I need
          </AppLink>
        </div>
        <p className={styles.fine}>
          Aethelios is the product and the in-app intelligence. Live guidance is not on in this
          studio. What you will see are curated directions, personalized from your answers. Neil
          reviews and delivers commissions; this page does not send work, take payment, or book an
          appointment.
        </p>
        <img
          className={styles.wordmark}
          src="/brand/logo.webp"
          alt="Aethelios Atelier"
          width={256}
          height={256}
        />
      </div>
      <div className={styles.stageWrap}>
        <div className={styles.stageGlow} aria-hidden="true" />
        <div className={styles.stage}>
          <div className={styles.stageChrome}>
            <span className={styles.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Preview stage · not a live website</span>
          </div>
          <div className={styles.mini}>
            <div style={{ padding: "28px 26px 36px", color: "#F3F0E7", background: "#07090A" }}>
              <p style={{ letterSpacing: "0.22em", fontSize: 11, textTransform: "uppercase", color: "#E8D5A3" }}>
                Your business
              </p>
              <h2
                style={{
                  fontFamily: "var(--font-lumen), Georgia, serif",
                  fontSize: "clamp(32px, 4vw, 52px)",
                  lineHeight: 0.95,
                  margin: "8px 0 16px",
                  fontWeight: 500
                }}
              >
                A quieter way to be found.
              </h2>
              <p style={{ color: "#B7B1A4", maxWidth: "36ch" }}>
                A cinematic editorial opening, composed atmosphere, and a clear next step toward the
                booking tool you already use.
              </p>
              <img
                src="/discovery/scenes/lumen-nocturne.svg"
                alt=""
                width={1600}
                height={420}
                style={{ marginTop: 22, height: 220, objectFit: "cover", borderRadius: 4 }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
