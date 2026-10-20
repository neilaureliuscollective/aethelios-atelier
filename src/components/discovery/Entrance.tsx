"use client";

import { useMemo } from "react";
import { AppLink } from "@/components/ui/AppLink";
import {
  createSampleExplorationDraft,
  previewInstanceId,
  type PreviewActionContext
} from "@/lib/discovery";
import { FULL_LOGO } from "@/lib/brand/fullLogo";
import { ConceptStage } from "./ConceptStage";
import styles from "./DiscoveryStudio.module.css";

export function Entrance({
  onExplore,
  onSample,
  onAction
}: {
  onExplore: () => void;
  onSample: () => void;
  onAction: (context: PreviewActionContext) => void;
}) {
  const sampleDraft = useMemo(() => createSampleExplorationDraft(), []);
  const instanceId = previewInstanceId("solo", sampleDraft.activeDirectionId, 9);

  return (
    <section className={styles.hero} aria-labelledby="discover-hero">
      <div className={styles.heroCopy}>
        <img
          className={styles.crest}
          src={FULL_LOGO.lockupSrc}
          alt="Aethelios Atelier"
          width={FULL_LOGO.width}
          height={FULL_LOGO.height}
        />
        <p className={styles.kicker}>Aethelios Atelier · Discover</p>
        <h1 id="discover-hero" className={styles.heading} data-discovery-heading tabIndex={-1}>
          See what your business
          <br />
          <span className={styles.gold}>could become.</span>
        </h1>
        <p className={styles.lede}>
          Try a direction for the business you actually run. Leave with a clear sketch Neil Stutes
          can review. No account and no contact details are required.
        </p>
        <div className={styles.actions}>
          <button className="btn btn-emerald-glass" type="button" onClick={onExplore}>
            Explore your direction
          </button>
          <button className={`${styles.btn} ${styles.btnGhost}`} type="button" onClick={onSample}>
            See a sample direction
          </button>
          <AppLink className={styles.quietLink} href="/project">
            I already know what I need
          </AppLink>
        </div>
        <p className={styles.fine}>
          This is a curated, personalized sketch — not live generation, a finished website, or a
          booking. Neil reviews every commission he accepts.
        </p>
      </div>
      <div className={styles.heroProof}>
        <p className={styles.proofCaption}>
          Illustrative custom-home studio · {sampleDraft.businessName} · not a client project
        </p>
        <div
          className={styles.previewShell}
          data-mode="desktop"
          data-entrance-sample="true"
          data-preview-instance={instanceId}
          data-preview-source="exploration"
          data-preview-direction={sampleDraft.activeDirectionId}
          data-preview-name={sampleDraft.businessName}
        >
          <div className={styles.device} data-preview-device={instanceId}>
            <ConceptStage
              instanceId={instanceId}
              draft={sampleDraft}
              directionId={sampleDraft.activeDirectionId}
              source="exploration"
              onAction={onAction}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
