export const ORB_EMERALD = "#248368";
export const ORB_DEEP = "#0B4635";
export const ORB_GOLD = "#C7A45A";
export const ORB_GOLD_PALE = "#E2C988";
export const ORB_OBSIDIAN = "#080C0B";
export const ORB_PARTICLE_COUNT = 1800;

export type OrbParticleKind = "emerald" | "gold";

export type OrbParticle = {
  x: number;
  y: number;
  z: number;
  kind: OrbParticleKind;
  shade: number;
};

export function fibonacciSphere(count: number): Array<{ x: number; y: number; z: number }> {
  const points: Array<{ x: number; y: number; z: number }> = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const n = Math.max(1, count);
  for (let i = 0; i < n; i += 1) {
    const y = n === 1 ? 0 : 1 - (i / (n - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    points.push({
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius
    });
  }
  return points;
}

export function assignOrbKind(y: number, index: number): OrbParticleKind {
  const band = 0.15 + 0.03 * Math.sin(index * 0.37);
  if (Math.abs(y) < band) return "gold";
  if (index % 31 === 0 || index % 47 === 0) return "gold";
  return "emerald";
}

export function buildOrbParticles(count = ORB_PARTICLE_COUNT): OrbParticle[] {
  return fibonacciSphere(count).map((point, index) => ({
    ...point,
    kind: assignOrbKind(point.y, index),
    shade: (index * 13) % 100 / 100
  }));
}

export function goldShare(particles: OrbParticle[]): number {
  if (!particles.length) return 0;
  return particles.filter((particle) => particle.kind === "gold").length / particles.length;
}
