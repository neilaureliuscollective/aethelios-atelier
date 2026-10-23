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
