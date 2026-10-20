"use client";

import { useEffect, useId, useRef, useState } from "react";
import { DeviceFrame } from "@/components/marketing/DeviceFrame";
import { NorthridgeSite } from "@/components/marketing/ExampleBusinesses";
import styles from "./examples.module.css";

export function HeroShowcase() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = dialogRef.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <div className="hero-stage">
      <div className="hero-stage-glow" aria-hidden="true" />
      <div className="hero-desktop-wrap">
        <DeviceFrame variant="desktop" depth="hero" label="Illustrative Northridge website on a desktop">
          <NorthridgeSite density="desktop" />
        </DeviceFrame>
      </div>
      <div className="hero-phone-wrap" aria-hidden="true">
        <DeviceFrame variant="phone" depth="hero" label="Illustrative Northridge website on a phone">
          <NorthridgeSite density="phone" />
        </DeviceFrame>
      </div>
      <p className="hero-stage-note">
        One illustrative branded website, shown at desktop and phone. Not a completed client project.
      </p>
      <button className="btn btn-ghost hero-inspect" type="button" onClick={() => setOpen(true)}>
        Inspect this example
      </button>
      <dialog
        ref={dialogRef}
        className={styles.inspectBody}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
      >
        <p className="tiny">Illustrative concept</p>
        <h2 id={titleId}>Northridge — a distinctive service website</h2>
        <p>
          This is a working layout for a fictional custom-home studio. It shows how a branded website
          can carry photography, a clear promise, and a next step. It is not a finished commission,
          testimonial, or live booking tool.
        </p>
        <DeviceFrame variant="desktop" label="Larger Northridge website example">
          <NorthridgeSite density="desktop" />
        </DeviceFrame>
        <div className={styles.inspectActions}>
          <button className="btn btn-gold" type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
}
