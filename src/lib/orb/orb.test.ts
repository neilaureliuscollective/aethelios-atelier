import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hexToRgb, ORB_EMERALD, springStep, stateWeights } from "./orb";

describe("Architect orb motion", () => {
  it("converts brand emerald and springs toward a target", () => {
    expect(hexToRgb(ORB_EMERALD)).toEqual([36 / 255, 131 / 255, 104 / 255]);
    expect(stateWeights("listening")).toEqual({ idle: 0, listen: 1, think: 0, speak: 0 });
    expect(stateWeights("speaking")).toEqual({ idle: 0, listen: 0, think: 0, speak: 1 });
    expect(stateWeights("thinking")).toEqual({ idle: 0, listen: 0, think: 1, speak: 0 });
    const next = springStep({ value: 0, vel: 0 }, 1, 0.016);
    expect(next.value).toBeGreaterThan(0);
  });

  it("falls back to a painted orb when WebGL2 cannot run", () => {
    const source = readFileSync("src/components/orb/ArchitectOrb.tsx", "utf8");
    expect(source).toContain("paintFallback");
    expect(source).toContain('setBackend("canvas2d")');
    expect(source).toContain("failIfMajorPerformanceCaveat");
    expect(source).not.toContain("gl_FragColor");
  });
});
