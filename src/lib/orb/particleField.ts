import { clamp01, type RtaCallState } from "./orb";

const PHI = Math.PI * (3 - Math.sqrt(5));

export const PARTICLE_COUNT_GL = 14000;
export const PARTICLE_COUNT_2D = 2400;

export function createParticleCloud(count: number) {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const y = 1 - t * 2;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = PHI * i;
    const seed = ((i * 16807) % 2147483647) / 2147483647;
    const inward = seed > 0.74 ? 0.68 + seed * 0.3 : 1;
    data[i * 4] = Math.cos(theta) * ring * inward;
    data[i * 4 + 1] = y * inward;
    data[i * 4 + 2] = Math.sin(theta) * ring * inward;
    data[i * 4 + 3] = seed;
  }
  return data;
}

const TAU = Math.PI * 2;

/**
 * Integrated motion state. Rotation and wave advance by speed × dt every frame,
 * so a change in voice energy changes the pace of the orb, never its position.
 * (Computing angle = time × speed made every particle jump whenever the level moved.)
 */
export type OrbMotion = {
  spin: number;
  wave: number;
  energy: number;
};

export function createOrbMotion(): OrbMotion {
  return { spin: 0, wave: 0, energy: 0 };
}

/** Voice energy the orb should settle toward: weighted, never jittery. */
export function orbEnergyTarget(speak: number, input: number, output: number) {
  return clamp01(speak * 0.3 + output * 0.7 + input * 0.5);
}

export function advanceOrbMotion(motion: OrbMotion, dt: number, targetEnergy: number): OrbMotion {
  const step = Math.max(0, Math.min(dt, 0.05));
  const rising = targetEnergy > motion.energy;
  const k = 1 - Math.exp(-step / (rising ? 0.18 : 0.6));
  const energy = clamp01(motion.energy + (targetEnergy - motion.energy) * k);
  return {
    spin: (motion.spin + (0.32 + energy * 0.55) * step) % TAU,
    wave: (motion.wave + (0.9 + energy * 1.1) * step) % TAU,
    energy
  };
}

export function swirlParticle(x: number, y: number, z: number, motion: OrbMotion, time: number) {
  const energy = motion.energy;
  const band = y * 2.4 + Math.sin(y * 7.4 + motion.wave) * (0.22 + energy * 0.06);
  const angle = motion.spin + band;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const lift = Math.sin(time * 1.15 + y * 3.1) * (0.012 + energy * 0.012);
  return { x: x * c - z * s, y: y + lift, z: x * s + z * c };
}

/** A slow standing wave across latitude while Aethelios speaks, instead of a pulse per syllable. */
export function orbRadius(motion: OrbMotion, y: number, time: number, think: number, reduced: boolean) {
  const breath = reduced ? 0 : 0.018 * Math.sin(time * 0.8);
  const ripple = reduced ? 0 : Math.sin(y * 4.2 - motion.wave * 1.4) * motion.energy * 0.016;
  return 0.84 + breath + motion.energy * 0.045 + ripple - think * 0.03;
}

export function paintParticleOrb(
  context: CanvasRenderingContext2D,
  cloud: Float32Array,
  size: number,
  state: RtaCallState,
  motion: OrbMotion,
  time: number,
  reduced: boolean
) {
  const cx = size / 2;
  const cy = size / 2;
  const speak = state === "speaking" ? 1 : 0;
  const listen = state === "listening" ? 1 : 0;
  const think = state === "thinking" ? 1 : 0;
  const energy = motion.energy;
  const radius = size * 0.5 * orbRadius(motion, 0, time, think, reduced);
  context.clearRect(0, 0, size, size);
  context.save();
  context.beginPath();
  context.arc(cx, cy, size * 0.5 - 1, 0, Math.PI * 2);
  context.clip();

  const bloom = context.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius * 1.08);
  bloom.addColorStop(0, `rgba(20, 90, 68, ${0.2 + energy * 0.18})`);
  bloom.addColorStop(0.55, `rgba(8, 40, 30, ${0.1 + listen * energy * 0.08})`);
  bloom.addColorStop(1, "rgba(8, 12, 11, 0)");
  context.fillStyle = bloom;
  context.beginPath();
  context.arc(cx, cy, radius * 1.08, 0, Math.PI * 2);
  context.fill();

  const count = cloud.length / 4;
  for (let i = 0; i < count; i += 1) {
    const ox = cloud[i * 4]!;
    const oy = cloud[i * 4 + 1]!;
    const oz = cloud[i * 4 + 2]!;
    const seed = cloud[i * 4 + 3]!;
    const p = reduced ? { x: ox, y: oy, z: oz } : swirlParticle(ox, oy, oz, motion, time);
    const depth = clamp01(p.z * 0.5 + 0.5);
    if (depth < 0.12) continue;
    const r = radius * (orbRadius(motion, p.y, time, think, reduced) / orbRadius(motion, 0, time, think, reduced));
    const px = cx + p.x * r;
    const py = cy - p.y * r;
    const gold = clamp01(1 - Math.abs(p.y) / 0.09);
    const rim = listen * energy * clamp01(Math.abs(p.y) * 1.4);
    const alpha = 0.1 + depth * 0.62 + gold * (0.22 + energy * 0.12) + speak * energy * 0.1 + rim * 0.16;
    const dot = Math.max(0.55, (0.7 + depth * 1.15 + gold * 0.45) * (size / 420));
    if (gold > 0.35) {
      context.fillStyle = `rgba(232, 214, 156, ${alpha})`;
    } else {
      const g = 88 + depth * 90 + speak * 18;
      context.fillStyle = `rgba(${12 + depth * 28}, ${g}, ${64 + depth * 48}, ${alpha})`;
    }
    context.fillRect(px, py, dot + seed * 0.4, dot + seed * 0.4);
  }
  context.restore();
}
