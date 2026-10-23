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

export function swirlParticle(
  x: number,
  y: number,
  z: number,
  time: number,
  speak: number,
  output: number
) {
  const speed = 0.13 + speak * 0.46 + output * 0.3;
  const band = y * 2.55 + Math.sin(y * 8.2 + time * (0.55 + speak * 1.25)) * 0.2;
  const angle = time * speed + band;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - z * s, y, z: x * s + z * c };
}

export function paintParticleOrb(
  context: CanvasRenderingContext2D,
  cloud: Float32Array,
  size: number,
  state: RtaCallState,
  input: number,
  output: number,
  time: number,
  reduced: boolean
) {
  const cx = size / 2;
  const cy = size / 2;
  const speak = state === "speaking" ? 1 : 0;
  const listen = state === "listening" ? 1 : 0;
  const think = state === "thinking" ? 1 : 0;
  const breath = reduced ? 0 : 0.012 * Math.sin(time * 0.55);
  const radius = size * (0.44 + breath + output * 0.03 - think * 0.02);
  context.clearRect(0, 0, size, size);
  context.save();
  context.beginPath();
  context.arc(cx, cy, size * 0.5 - 1, 0, Math.PI * 2);
  context.clip();

  const bloom = context.createRadialGradient(cx, cy, radius * 0.18, cx, cy, radius * 1.08);
  bloom.addColorStop(0, `rgba(20, 90, 68, ${0.2 + output * 0.16 + speak * 0.08})`);
  bloom.addColorStop(0.55, `rgba(8, 40, 30, ${0.1 + listen * input * 0.08})`);
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
    const p = reduced ? { x: ox, y: oy, z: oz } : swirlParticle(ox, oy, oz, time, speak, output);
    const depth = clamp01(p.z * 0.5 + 0.5);
    if (depth < 0.12) continue;
    const px = cx + p.x * radius;
    const py = cy - p.y * radius;
    const gold = clamp01(1 - Math.abs(p.y) / 0.09);
    const rim = listen * input * clamp01(Math.abs(p.y) * 1.4);
    const alpha = 0.1 + depth * 0.62 + gold * 0.22 + speak * output * 0.12 + rim * 0.2;
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
