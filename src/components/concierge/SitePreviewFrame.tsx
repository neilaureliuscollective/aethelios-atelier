"use client";

import { DeviceFrame } from "@/components/marketing/DeviceFrame";
import type { SitePreview } from "@/lib/concierge/types";
import styles from "./concierge.module.css";

export function SitePreviewFrame({ preview }: { preview: SitePreview }) {
  return (
    <div className={styles.sitePreview}>
      <DeviceFrame variant="desktop" depth="hero" label={`${preview.title} — illustrative website sketch`}>
        <iframe
          className={styles.siteFrame}
          title={preview.title}
          srcDoc={preview.html}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
        />
      </DeviceFrame>
      <p className={styles.siteNote}>Illustrative sketch from the conversation. Not a finished website or a quote.</p>
    </div>
  );
}
