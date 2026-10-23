export const SPEECH_RMS = 0.045;
export const SILENCE_MS = 1300;
export const MAX_RECORD_MS = 18_000;

export function speechGain(rms: number) {
  return Math.max(0, Math.min(1, (rms - 0.01) / 0.11));
}

export function rmsFromTimeDomain(bytes: Uint8Array) {
  if (!bytes.length) return 0;
  let sum = 0;
  for (const sample of bytes) {
    const n = (sample - 128) / 128;
    sum += n * n;
  }
  return Math.sqrt(sum / bytes.length);
}

export function shouldFinishRecording(input: {
  heardSpeech: boolean;
  lastLoudAt: number;
  startedAt: number;
  now: number;
}) {
  if (input.now - input.startedAt >= MAX_RECORD_MS) return true;
  if (!input.heardSpeech) return false;
  return input.now - input.lastLoudAt >= SILENCE_MS;
}

export function holdSpokenPhase(input: {
  current: "listening" | "speaking";
  remoteLoud: boolean;
  loudForMs: number;
  quietForMs: number;
}): "listening" | "speaking" {
  if (input.current === "speaking") {
    return input.quietForMs >= 420 ? "listening" : "speaking";
  }
  return input.loudForMs >= 180 ? "speaking" : "listening";
}

export function orbPresenceLabel(input: {
  name: string;
  error?: string;
  phase: "idle" | "starting" | "listening" | "speaking";
  pending?: boolean;
  hasDocument?: boolean;
}) {
  if (input.error) return input.error;
  if (input.phase === "speaking") return `${input.name} is speaking`;
  if (input.phase === "listening" || input.phase === "starting") return "Listening";
  if (input.pending) return input.hasDocument ? `${input.name} is writing the document` : `${input.name} is writing`;
  return `Tap the orb to talk with ${input.name}`;
}
