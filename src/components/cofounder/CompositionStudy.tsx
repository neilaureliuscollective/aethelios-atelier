"use client";

import { useEffect, useRef, useState } from "react";
import type { CompositionSpec } from "@/lib/cofounder/composition";
import { renderComposition } from "@/lib/cofounder/renderComposition";

/** A real compositor view, never a decorative mockup or separate export implementation. */
export function CompositionStudy({ spec, label }: { spec: CompositionSpec; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    const canvas = ref.current;
    if (!canvas) return;
    setFailed(false);
    canvas.dataset.renderState = "pending";
    void renderComposition(spec, document.createElement("canvas")).then((result) => {
      if (!active) return;
      canvas.width = result.width; canvas.height = result.height;
      canvas.getContext("2d")?.drawImage(result, 0, 0);
      canvas.dataset.renderState = "ready";
    }).catch(() => { if (active) { canvas.width = 0; canvas.height = 0; canvas.dataset.renderState = "error"; setFailed(true); } });
    return () => { active = false; };
  }, [spec]);
  return <>{failed ? <span role="status">Preview unavailable. Shorten copy or reopen this format.</span> : null}<canvas ref={ref} aria-label={label} style={{ width: "100%", height: "auto", display: failed ? "none" : "block" }} /></>;
}
