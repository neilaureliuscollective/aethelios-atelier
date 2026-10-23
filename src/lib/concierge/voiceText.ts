export const SPOKEN_COMMIT_MS = 1600;

export function appendTranscript(current: string, spoken: string) {
  return [current.trim(), spoken.trim()].filter(Boolean).join(" ");
}

export function shouldCommitSpoken(text: string) {
  return text.trim().length >= 18;
}

export function documentSourceFromTalk(input: string, spokenTurns: string[] = []) {
  const parts = [...spokenTurns, input.trim()].filter(Boolean);
  return parts.join("\n") || "Write a first document from this conversation.";
}

/** Only completed transcripts become turns; streaming deltas would repeat words. */
export function spokenTurnFrom(payload: { type?: string; transcript?: string; text?: string }) {
  const type = payload.type ?? "";
  const text = (payload.transcript ?? payload.text ?? "").trim();
  if (!text) return null;
  if (type.includes("input_audio_transcription.completed")) return { role: "user" as const, text };
  if (/response\.(output_)?audio_transcript\.done/.test(type)) return { role: "assistant" as const, text };
  return null;
}
