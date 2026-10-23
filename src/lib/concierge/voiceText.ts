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
