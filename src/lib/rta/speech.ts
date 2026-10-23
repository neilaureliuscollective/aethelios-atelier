import { RTA_MIN_UTTERANCE, RTA_TTS_CHUNK, RTA_UTTERANCE_IDLE_MS } from "@/lib/rta/limits";
import { spokenSummary } from "@/lib/concierge/voice";

const FATAL_RECOGNITION = new Set(["not-allowed", "service-not-allowed"]);

export function spokenForRta(text: string, maxSentences = 10, maxChars = 1400): string {
  return spokenSummary(text, maxSentences, maxChars);
}

export function chunkSpokenText(text: string, maxChars = RTA_TTS_CHUNK): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      let piece = "";
      for (const word of sentence.split(" ")) {
        const next = piece ? `${piece} ${word}` : word;
        if (next.length > maxChars && piece) {
          chunks.push(piece);
          piece = word.length > maxChars ? word.slice(0, maxChars) : word;
        } else {
          piece = next.length > maxChars ? next.slice(0, maxChars) : next;
        }
      }
      if (piece) chunks.push(piece);
      continue;
    }
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = sentence;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function mergeTranscript(finals: string[], interim = ""): string {
  return [...finals, interim]
    .map((part) => part.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ");
}

export function shouldFlushUtterance(input: {
  lastResultAt: number;
  now: number;
  text: string;
  idleMs?: number;
  minChars?: number;
}): boolean {
  const idle = input.idleMs ?? RTA_UTTERANCE_IDLE_MS;
  const min = input.minChars ?? RTA_MIN_UTTERANCE;
  if (input.now - input.lastResultAt < idle) return false;
  return input.text.trim().length >= min;
}

export function shouldRestartRecognition(error?: string): boolean {
  if (!error) return true;
  return !FATAL_RECOGNITION.has(error);
}

export function rmsFromTimeDomain(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const centered = ((samples[i] ?? 128) - 128) / 128;
    sum += centered * centered;
  }
  return Math.min(1, Math.sqrt(sum / samples.length) * 3.2);
}

export function speakEnvelope(nowMs: number, pulse = 0): number {
  const wave = 0.22 + 0.1 * Math.sin(nowMs / 90) + 0.06 * Math.sin(nowMs / 37);
  return Math.min(1, wave + pulse);
}
