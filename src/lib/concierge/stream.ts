import type { ConciergeStreamEvent } from "./types";

export function encodeConciergeEvent(event: ConciergeStreamEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function parseConciergeChunk(chunk: string): ConciergeStreamEvent[] {
  const events: ConciergeStreamEvent[] = [];
  for (const block of chunk.split("\n\n")) {
    const type = block.match(/^event: (.+)$/m)?.[1];
    const raw = block.match(/^data: (.+)$/m)?.[1];
    if (!type || !raw) continue;
    try {
      events.push(JSON.parse(raw) as ConciergeStreamEvent);
    } catch {
      continue;
    }
  }
  return events;
}
