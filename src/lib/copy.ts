export const CONSENT_TEXT =
  "I consent to send this brief to Neil Stutes for personal review. This is a request, not a booking, quote, agreement, or payment. Scope, timing, and price are confirmed only after founder review.";

/** Visitor-facing name of the in-app intelligence. Aurelius is Neil’s separate personal assistant. */
export const INTELLIGENCE_DISPLAY_NAME = "Aethelios";

/**
 * Stored records and internal identifiers may still say Aurelius.
 * Map those strings for display without rewriting persisted provenance values.
 */
export function displayIntelligenceLabel(value?: string | null) {
  if (!value) return INTELLIGENCE_DISPLAY_NAME;
  return value.replace(/aurelius/gi, INTELLIGENCE_DISPLAY_NAME);
}
