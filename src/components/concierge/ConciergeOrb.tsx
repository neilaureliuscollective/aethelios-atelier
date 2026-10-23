"use client";

import { useEffect, useRef } from "react";
import { ArchitectOrb, type RtaCallState } from "@/components/orb/ArchitectOrb";
import { clamp01, envelopeToward } from "@/lib/orb/orb";
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
  size = "hero",
  liveInputRef,
  liveOutputRef,
  liveLevelRef
}: {
  state: OrbState;
  label: string;
  onToggle: () => void;
  size?: "hero" | "docked";
  liveInputRef?: { current: number };
  liveOutputRef?: { current: number };
  liveLevelRef?: { current: number };
}) {
  const inputRef = useRef(0.08);
  const outputRef = useRef(0.06);
  const lastAt = useRef(0);

  useEffect(() => {
    let frame = 0;
    lastAt.current = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastAt.current) / 1000);
      lastAt.current = now;
      const t = now / 1000;
      const liveIn = clamp01(liveInputRef?.current ?? 0);
      const liveOut = clamp01(liveOutputRef?.current ?? (state === "speaking" ? liveLevelRef?.current ?? 0 : 0));
      const liveEither = Math.max(liveIn, liveOut, clamp01(liveLevelRef?.current ?? 0));
      const hasLive = Boolean(liveInputRef || liveOutputRef || liveLevelRef);
      let nextIn = inputRef.current;
      let nextOut = outputRef.current;
      if (hasLive && (state === "listening" || state === "speaking")) {
        nextIn = 0.1 + liveIn * 0.78 + (state === "speaking" ? liveOut * 0.08 : 0);
        nextOut = 0.08 + liveOut * 0.82 + (state === "listening" ? liveIn * 0.12 : 0);
        if (liveEither < 0.04) {
          nextIn = 0.1 + Math.sin(t * 0.7) * 0.02;
          nextOut = 0.07 + Math.sin(t * 0.55) * 0.015;
        }
      } else if (state === "composing") {
        nextIn = 0.14 + Math.sin(t * 0.9) * 0.04;
        nextOut = 0.22 + Math.sin(t * 1.05) * 0.06;
      } else if (state === "thinking") {
        nextIn = 0.11 + Math.sin(t * 0.75) * 0.03;
        nextOut = 0.16 + Math.sin(t * 0.85) * 0.04;
      } else {
        nextIn = 0.07 + Math.sin(t * 0.45) * 0.02;
        nextOut = 0.05 + Math.sin(t * 0.38) * 0.015;
      }
      // Rise with the voice, settle slowly: weight instead of syllable-by-syllable flicker.
      inputRef.current = envelopeToward(inputRef.current, clamp01(nextIn), dt, 0.12, 0.42);
      outputRef.current = envelopeToward(outputRef.current, clamp01(nextOut), dt, 0.1, 0.45);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [liveInputRef, liveLevelRef, liveOutputRef, state]);

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
