export const RTA_TTS_PROVIDER = "openai_tts" as const;
export const RTA_TTS_MODEL = "gpt-4o-mini-tts";
export const RTA_TTS_VOICE = "cedar";
export const RTA_TTS_FORMAT = "mp3" as const;
export const RTA_TTS_MAX = 1400;

export const RTA_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "nova",
  "onyx",
  "sage",
  "shimmer",
  "verse",
  "marin",
  "cedar"
] as const;

export type RtaTtsVoice = (typeof RTA_TTS_VOICES)[number];

export const RTA_TTS_INSTRUCTIONS =
  "Calm, precise, unhurried American English. A grounded masculine presence — resonant, not theatrical. No luxury filler, no whisper, no rush.";

export function isRtaTtsVoice(value: string): value is RtaTtsVoice {
  return (RTA_TTS_VOICES as readonly string[]).includes(value);
}

export function ttsVoiceChoice(): {
  voice: typeof RTA_TTS_VOICE;
  model: typeof RTA_TTS_MODEL;
  provider: typeof RTA_TTS_PROVIDER;
  reason: string;
} {
  return {
    voice: RTA_TTS_VOICE,
    model: RTA_TTS_MODEL,
    provider: RTA_TTS_PROVIDER,
    reason:
      "Cedar is a first-party OpenAI Speech voice. Official docs recommend marin or cedar for quality. Cedar is the resonant, authoritative counterpart to marin and the best masculine built-in match without a custom voice."
  };
}
