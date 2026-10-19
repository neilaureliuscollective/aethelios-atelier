export const CONSENT_TEXT =
  "I consent to send this brief to Neil Stutes for personal review. This is a request, not a booking, quote, agreement, or payment. Scope, timing, and price are confirmed only after founder review.";

export const PROPOSAL_AGREEMENT_TEXT =
  "I agree that this exact proposal version is the scope for this commission. This records agreement to the written deliverables, exclusions, client responsibilities, milestones, and founder-set price. It is not a payment, booking, invoice, or collected charge. Payments are not taken in Atelier.";

export const DELIVERY_APPROVAL_TEXT =
  "I approve this exact design or build version. My comments and this approval stay attached to this version. Later edits will be published as a new version instead of changing what I approved.";

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
