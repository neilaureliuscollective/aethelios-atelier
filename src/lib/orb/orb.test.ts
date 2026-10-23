import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { paintChamber } from "@/lib/concierge/atmosphere";
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
    expect(source).toContain("0.46");
    expect(source).toContain('setBackend("canvas2d")');
    expect(source).toContain("failIfMajorPerformanceCaveat");
    expect(source).not.toContain("gl_FragColor");
    const glass = readFileSync("src/lib/orb/glassShader.ts", "utf8");
    expect(glass).toContain("uv *= 0.56");
    expect(glass).toContain("sin(u_time * 0.11)");
    const atmosphere = readFileSync("src/lib/concierge/atmosphere.ts", "utf8");
    expect(atmosphere).toContain("float z = 1.0 / fy");
    expect(atmosphere).toContain("paintChamber");
    expect(atmosphere).toContain("vanishingX");
    expect(atmosphere).not.toContain("meridian");
    expect(atmosphere).not.toContain("aces(col * 1.18)");
  });

  it("paints a perspective hall instead of a flat glow", () => {
    const source = paintChamber.toString();
    expect(source).toContain("vanishingX");
    expect(source).toContain("horizonY");
    expect(source).toContain("aisles");
  });
});
