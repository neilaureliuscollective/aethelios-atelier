import "server-only";
import OpenAI from "openai";
import { DomainError, UnconfiguredError } from "@/lib/domain/errors";
import { readOpenAiApiKey } from "@/lib/runtime/hosted";

export const TRANSCRIBE_MAX_BYTES = 4 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/m4a"
]);

export function transcribeConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(readOpenAiApiKey(env));
}

export function extensionForType(type: string) {
  if (type.includes("mp4") || type.includes("m4a")) return "mp4";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("wav")) return "wav";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

export async function transcribeAudio(input: { bytes: Buffer; type: string; filename?: string }) {
  const apiKey = readOpenAiApiKey();
  if (!apiKey) {
    throw new UnconfiguredError(
      "Voice transcription needs OPENAI_API_KEY on the server. Talking still works if you type."
    );
  }
  if (input.bytes.byteLength < 64) {
    throw new DomainError("That recording was empty. Tap the orb, speak, then tap again.", "invalid", 400);
  }
  if (input.bytes.byteLength > TRANSCRIBE_MAX_BYTES) {
    throw new DomainError("That recording is too long. Speak a shorter thought and tap the orb again.", "invalid", 400);
  }
  const type = ALLOWED_TYPES.has(input.type) ? input.type : "audio/webm";
  const file = new File([new Uint8Array(input.bytes)], input.filename ?? `speech.${extensionForType(type)}`, {
    type
  });
  const client = new OpenAI({ apiKey, timeout: 30_000 });
  const preferred = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe";
  const models = preferred === "whisper-1" ? ["whisper-1"] : [preferred, "whisper-1"];
  let lastError: unknown;
  for (const model of models) {
    try {
      const result = await client.audio.transcriptions.create({
        file,
        model: model as "whisper-1",
        language: "en"
      });
      const text = typeof result.text === "string" ? result.text.trim() : "";
      if (!text) {
        throw new DomainError("Nothing could be heard. Speak again, or type.", "invalid", 400);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (error instanceof DomainError) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new DomainError("That speech could not be transcribed.", "invalid", 502);
}
