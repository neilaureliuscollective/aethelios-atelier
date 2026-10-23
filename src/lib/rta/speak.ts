import "server-only";
import OpenAI from "openai";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { loadConfig } from "@/lib/config";
import { looksLikeMaliciousInput, sanitizeConciergeMessage } from "@/lib/concierge/safety";
import { spokenForRta } from "@/lib/rta/speech";
import { RTA_TTS_FORMAT, RTA_TTS_INSTRUCTIONS, RTA_TTS_MAX, RTA_TTS_MODEL, RTA_TTS_VOICE } from "@/lib/rta/tts";

export type RtaSpeechClient = {
  audio: {
    speech: {
      create: (body: {
        model: string;
        voice: string;
        input: string;
        instructions?: string;
        response_format?: "mp3" | "wav" | "opus" | "aac" | "flac" | "pcm";
      }) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> }>;
    };
  };
};

export function prepareSpokenInput(input: unknown): string {
  const cleaned = spokenForRta(sanitizeConciergeMessage(input, RTA_TTS_MAX), 10, RTA_TTS_MAX);
  if (!cleaned || looksLikeMaliciousInput(cleaned)) return "";
  return cleaned;
}

export async function synthesizeRtaSpeech(
  input: unknown,
  client?: RtaSpeechClient
): Promise<Uint8Array | null> {
  const text = prepareSpokenInput(input);
  if (!text) return null;
  const status = aureliusStatus();
  if (!status.ready && !client) return null;
  try {
    const config = loadConfig();
    const speech =
      client ??
      new OpenAI({ apiKey: config.openAiKey, timeout: config.openAiTimeoutMs });
    const response = await speech.audio.speech.create({
      model: RTA_TTS_MODEL,
      voice: RTA_TTS_VOICE,
      input: text,
      instructions: RTA_TTS_INSTRUCTIONS,
      response_format: RTA_TTS_FORMAT
    });
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}
