import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { paintChamber } from "@/lib/concierge/atmosphere";
import { hexToRgb, ORB_EMERALD, springStep, stateWeights } from "./orb";
import {
  advanceOrbMotion,
  createOrbMotion,
  createParticleCloud,
  orbEnergyTarget,
  PARTICLE_COUNT_GL,
  swirlParticle
} from "./particleField";

describe("Architect orb motion", () => {
  it("converts brand emerald and springs toward a target", () => {
    expect(hexToRgb(ORB_EMERALD)).toEqual([36 / 255, 131 / 255, 104 / 255]);
    expect(stateWeights("listening")).toEqual({ idle: 0, listen: 1, think: 0, speak: 0 });
    expect(stateWeights("speaking")).toEqual({ idle: 0, listen: 0, think: 0, speak: 1 });
    expect(stateWeights("thinking")).toEqual({ idle: 0, listen: 0, think: 1, speak: 0 });
    const next = springStep({ value: 0, vel: 0 }, 1, 0.016);
    expect(next.value).toBeGreaterThan(0);
  });

  it("builds a spherical particle cloud that swirls instead of a filled disc", () => {
    const cloud = createParticleCloud(64);
    expect(cloud).toHaveLength(256);
    let radiusSum = 0;
    for (let i = 0; i < 64; i += 1) {
      const x = cloud[i * 4]!;
      const y = cloud[i * 4 + 1]!;
      const z = cloud[i * 4 + 2]!;
      const r = Math.hypot(x, y, z);
      expect(r).toBeGreaterThan(0.6);
      expect(r).toBeLessThanOrEqual(1.001);
      radiusSum += r;
    }
    expect(radiusSum / 64).toBeGreaterThan(0.85);
    const still = createOrbMotion();
    const spun = swirlParticle(1, 0, 0, still, 0);
    expect(Math.hypot(spun.x, spun.z)).toBeCloseTo(1, 5);
    expect(Math.abs(spun.y)).toBeLessThan(0.08);
    let idle = createOrbMotion();
    let live = createOrbMotion();
    for (let i = 0; i < 60; i += 1) {
      idle = advanceOrbMotion(idle, 1 / 60, 0);
      live = advanceOrbMotion(live, 1 / 60, orbEnergyTarget(1, 0.7, 0.8));
    }
    expect(live.spin).toBeGreaterThan(idle.spin);
    const source = readFileSync("src/components/orb/ArchitectOrb.tsx", "utf8");
    expect(source).toContain("paintParticleOrb");
    expect(source).toContain("gl.POINTS");
    expect(source).toContain('setBackend("canvas2d")');
    expect(source).toContain("failIfMajorPerformanceCaveat");
    expect(source).toContain("getContextAttributes");
    expect(source).not.toContain("gl_FragColor");
    expect(source).not.toContain("pointer: coarse");
    const shader = readFileSync("src/lib/orb/particleShader.ts", "utf8");
    expect(shader).toContain("gl_PointSize");
    expect(shader).toContain("color * a");
    expect(shader).toContain("u_energy");
    expect(shader).toContain("u_spin + band");
    expect(shader).not.toMatch(/u_time \* speed/);
    expect(PARTICLE_COUNT_GL).toBeGreaterThan(8000);
    const atmosphere = readFileSync("src/lib/concierge/atmosphere.ts", "utf8");
    expect(atmosphere).toContain("float z = 1.0 / fy");
    expect(atmosphere).toContain("paintChamber");
    expect(atmosphere).toContain("vanishingX");
    expect(atmosphere).not.toContain("meridian");
    expect(atmosphere).not.toContain("aces(col * 1.18)");
  });

  it("changes pace without snapping when the voice level jumps", () => {
    // Minutes into a call, a sudden loud syllable must move the swirl by one frame's worth, not a lap.
    let motion = createOrbMotion();
    for (let i = 0; i < 60 * 300; i += 1) motion = advanceOrbMotion(motion, 1 / 60, 0.05);
    const before = motion.spin;
    const after = advanceOrbMotion(motion, 1 / 60, 1);
    const delta = Math.abs(((after.spin - before + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    expect(delta).toBeLessThan(0.03);
    expect(after.energy).toBeLessThan(0.2);
    expect(motion.spin).toBeLessThan(Math.PI * 2);
  });

  it("restarts the orb loop when it returns on screen", () => {
    const source = readFileSync("src/components/orb/ArchitectOrb.tsx", "utf8");
    expect(source).toMatch(/new IntersectionObserver\(\(entries\) => \{[\s\S]*?schedule\(\);/);
    expect(source).toContain("STATE_DAMPING");
  });

  it("paints a perspective hall instead of a flat glow", () => {
    const source = paintChamber.toString();
    expect(source).toContain("vanishingX");
    expect(source).toContain("horizonY");
    expect(source).toContain("aisles");
  });
});
