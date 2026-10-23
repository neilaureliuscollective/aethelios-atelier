"use client";

import { useEffect, useRef } from "react";
import { ArchitectOrb, type RtaCallState } from "@/components/orb/ArchitectOrb";
import { clamp01 } from "@/lib/orb/orb";
import styles from "./concierge.module.css";

export type OrbState = "idle" | "listening" | "thinking" | "composing" | "speaking";

function toCallState(state: OrbState): RtaCallState {
  if (state === "composing") return "thinking";
  if (state === "speaking") return "speaking";
  if (state === "listening") return "listening";
  if (state === "thinking") return "thinking";
  return "idle";
}

export function ConciergeOrb({
  state,
  label,
  onToggle,
  size = "hero"
}: {
  state: OrbState;
  label: string;
  onToggle: () => void;
  size?: "hero" | "docked";
}) {
  const inputRef = useRef(0.08);
  const outputRef = useRef(0.06);

  useEffect(() => {
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const t = (now - started) / 1000;
      if (state === "listening") {
        inputRef.current = clamp01(0.28 + Math.sin(t * 3.1) * 0.22);
        outputRef.current = clamp01(0.08 + Math.sin(t * 1.4) * 0.04);
      } else if (state === "speaking") {
        inputRef.current = clamp01(0.1 + Math.sin(t * 1.6) * 0.05);
        outputRef.current = clamp01(0.42 + Math.sin(t * 5.2) * 0.28);
      } else if (state === "composing") {
        inputRef.current = clamp01(0.16 + Math.sin(t * 2.2) * 0.08);
        outputRef.current = clamp01(0.34 + Math.sin(t * 3.6) * 0.16);
      } else if (state === "thinking") {
        inputRef.current = clamp01(0.12 + Math.sin(t * 1.8) * 0.06);
        outputRef.current = clamp01(0.2 + Math.sin(t * 2.4) * 0.1);
      } else {
        inputRef.current = clamp01(0.08 + Math.sin(t * 0.9) * 0.03);
        outputRef.current = clamp01(0.06 + Math.sin(t * 0.7) * 0.02);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  return (
    <button className={styles.orbButton} type="button" onClick={onToggle} aria-label={label}>
      <div className={styles.orb} data-state={state} data-size={size}>
        <span className={styles.orbFallback} aria-hidden="true" />
        <span className={styles.orbRing} aria-hidden="true" />
        <ArchitectOrb
          state={toCallState(state)}
          inputRef={inputRef}
          outputRef={outputRef}
          compact={size === "docked"}
          label={label}
          className={styles.orbGlass}
        />
      </div>
    </button>
  );
}
