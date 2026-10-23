import type { ConciergeEvent, ConciergeEventName } from "@/lib/concierge/types";

const EVENT_NAMES = new Set<ConciergeEventName>([
  "opened",
  "first_message",
  "suggestion_selected",
  "engaged",
  "link_clicked",
  "inquiry_started",
  "inquiry_submitted",
  "handoff_requested",
  "response_failed",
  "abandoned",
  "voice_started",
  "voice_unsupported",
  "voice_denied"
]);

const events: ConciergeEvent[] = [];
const MAX = 400;

export function resetConciergeEventsForTests() {
  events.length = 0;
}

export function isConciergeEventName(value: unknown): value is ConciergeEventName {
  return typeof value === "string" && EVENT_NAMES.has(value as ConciergeEventName);
}

export function recordConciergeEvent(input: { name: ConciergeEventName; path: string }): ConciergeEvent {
  const event: ConciergeEvent = {
    name: input.name,
    path: input.path.slice(0, 120),
    createdAt: new Date().toISOString()
  };
  events.push(event);
  if (events.length > MAX) events.splice(0, events.length - MAX);
  return event;
}

export function listConciergeEvents(): ConciergeEvent[] {
  return [...events];
}

export function conciergeEventCounts() {
  const counts = Object.fromEntries([...EVENT_NAMES].map((name) => [name, 0])) as Record<ConciergeEventName, number>;
  for (const event of events) counts[event.name] += 1;
  return counts;
}

/** Client helper: send a named event with no message content. */
export async function trackConciergeEvent(name: ConciergeEventName, path: string) {
  try {
    await fetch("/api/concierge/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, path })
    });
  } catch {
    /* measurement must never block the conversation */
  }
}
