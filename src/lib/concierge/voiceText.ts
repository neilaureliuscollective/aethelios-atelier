export function appendTranscript(current: string, spoken: string) {
  return [current.trim(), spoken.trim()].filter(Boolean).join(" ");
}
