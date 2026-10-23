export const ORB_EMERALD = "#248368";
export const ORB_DEEP = "#0B4635";
export const ORB_GOLD = "#C7A45A";
export const ORB_GOLD_PALE = "#E2C988";
export const ORB_OBSIDIAN = "#080C0B";

export type RtaCallState = "idle" | "listening" | "thinking" | "speaking" | "ended";

export type OrbLevels = {
  input: number;
  output: number;
};

export type OrbStateMix = {
  idle: number;
  listen: number;
  think: number;
  speak: number;
};

export type SpringValue = {
  value: number;
  vel: number;
};

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const n = Number.parseInt(value, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function envelopeToward(
  current: number,
  target: number,
  dt: number,
  attack = 0.045,
  release = 0.24
): number {
  const tau = target > current ? attack : release;
  const k = 1 - Math.exp(-Math.max(dt, 0) / Math.max(tau, 0.001));
  return clamp01(current + (target - current) * k);
}

export function springStep(
  spring: SpringValue,
  target: number,
  dt: number,
  stiffness = 180,
  damping = 22
): SpringValue {
  const acc = (target - spring.value) * stiffness - spring.vel * damping;
  const vel = spring.vel + acc * dt;
  return { value: spring.value + vel * dt, vel };
}

export function stateWeights(state: RtaCallState): OrbStateMix {
  return {
    idle: state === "idle" || state === "ended" ? 1 : 0,
    listen: state === "listening" ? 1 : 0,
    think: state === "thinking" ? 1 : 0,
    speak: state === "speaking" ? 1 : 0
  };
}

