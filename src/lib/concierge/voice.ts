export type ConciergeVoiceState = "idle" | "listening" | "thinking" | "speaking" | "unsupported" | "denied";

export type BrowserVoiceSupport = {
  listen: boolean;
  speak: boolean;
};

export const CONCIERGE_VOICE_PRIVACY =
  "Talk uses this browser’s speech service. Atelier receives the words, not an audio recording. You can type instead at any time.";

export function detectBrowserVoice(globalObject: {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
  speechSynthesis?: unknown;
} = globalThis as never): BrowserVoiceSupport {
  return {
    listen: Boolean(globalObject.SpeechRecognition || globalObject.webkitSpeechRecognition),
    speak: Boolean(globalObject.speechSynthesis)
  };
}

export function spokenSummary(text: string, maxSentences = 2, maxChars = 320): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const spoken = (sentences.length ? sentences.slice(0, maxSentences) : [cleaned]).join(" ");
  if (spoken.length <= maxChars) return spoken;
  return `${spoken.slice(0, maxChars - 1).trim()}…`;
}

export function voiceStatusCopy(state: ConciergeVoiceState, support: BrowserVoiceSupport): string {
  if (!support.listen) {
    return "This browser cannot take dictation. Type your question — Firefox in particular has no speech recognition.";
  }
  switch (state) {
    case "listening":
      return "Listening. Speak naturally. Tap again to stop.";
    case "thinking":
      return "Considering that…";
    case "speaking":
      return "Speaking a short answer. The full note stays on screen. Tap to interrupt.";
    case "denied":
      return "The microphone was blocked. You can still type.";
    case "unsupported":
      return "Voice is not available in this browser. Typing still works.";
    default:
      return support.speak
        ? "Talk when you are ready. I will keep the written note and speak only a short answer."
        : "You can dictate. This browser will not speak the reply aloud.";
  }
}

export function attachSpokenText<T extends { message: string }>(
  result: T,
  options?: { maxSentences?: number; maxChars?: number }
): T & { spokenText: string } {
  return {
    ...result,
    spokenText: spokenSummary(result.message, options?.maxSentences ?? 2, options?.maxChars ?? 320)
  };
}
