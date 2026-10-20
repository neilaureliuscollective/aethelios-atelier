import type { PlanId, UsageKind, UsageSnapshot } from "@/lib/cofounder/types";

export type PlanLimits = {
  talk: number;
  images: number;
  voiceMinutes: number;
  concurrentGenerations: number;
  documents: number;
};

export type PlanDefinition = {
  id: PlanId;
  label: string;
  outcomes: string[];
  limits: PlanLimits;
};

/**
 * Operational capacity for the companion. Customer-facing copy should lead with
 * outcomes, not hourly allotments. These are server-enforced budgets, not
 * commercial promises.
 */
export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  atelier: {
    id: "atelier",
    label: "Atelier",
    outcomes: ["Managed care of the living business context", "Ongoing content drafts", "Connected Talk and Studio work"],
    limits: { talk: 80, images: 20, voiceMinutes: 30, concurrentGenerations: 1, documents: 24 }
  },
  connected: {
    id: "connected",
    label: "Atelier Connected",
    outcomes: ["Managed care", "Higher content cadence", "Connected work across more projects"],
    limits: { talk: 160, images: 40, voiceMinutes: 60, concurrentGenerations: 2, documents: 48 }
  },
  partnership: {
    id: "partnership",
    label: "Atelier Partnership",
    outcomes: ["Closer operating cadence", "Broader connected work", "Founder-reviewed larger changes"],
    limits: { talk: 240, images: 60, voiceMinutes: 90, concurrentGenerations: 2, documents: 80 }
  }
};

/**
 * Founder starting commercial structure. Not a live catalog, not checkout, and
 * not rendered in customer-facing companion UI until billing is reviewed.
 */
export const STARTING_COMMERCIAL_TERMS = {
  status: "not_finalized" as const,
  source: "founder_starting_structure",
  note: "Subject to final scope and terms. Not activated as Stripe products.",
  plans: {
    atelier: { setupUsd: 299, monthlyUsd: 249 },
    connected: { setupUsd: 499, monthlyUsd: 399 },
    partnership: { setupUsd: null, monthlyUsd: 699, setup: "quoted" as const }
  }
};

export function resolvePlanId(value: string | undefined | null): PlanId {
  if (value === "connected" || value === "partnership" || value === "atelier") return value;
  return "atelier";
}

export function limitsForPlan(planId: PlanId, overrides?: Partial<PlanLimits>): PlanLimits {
  return { ...PLAN_DEFINITIONS[planId].limits, ...overrides };
}

export function periodStartIso(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function toUsageSnapshot(input: {
  planId: PlanId;
  talkUsed: number;
  imagesUsed: number;
  voiceMinutesUsed: number;
  limits?: Partial<PlanLimits>;
  now?: Date;
}): UsageSnapshot {
  const limits = limitsForPlan(input.planId, input.limits);
  return {
    planId: input.planId,
    periodStart: periodStartIso(input.now),
    talkUsed: input.talkUsed,
    talkLimit: limits.talk,
    imagesUsed: input.imagesUsed,
    imageLimit: limits.images,
    voiceMinutesUsed: input.voiceMinutesUsed,
    voiceMinuteLimit: limits.voiceMinutes,
    concurrentLimit: limits.concurrentGenerations,
    remaining: {
      talk: Math.max(0, limits.talk - input.talkUsed),
      images: Math.max(0, limits.images - input.imagesUsed),
      voiceMinutes: Math.max(0, limits.voiceMinutes - input.voiceMinutesUsed)
    }
  };
}

export function assertWithinBudget(
  snapshot: UsageSnapshot,
  kind: UsageKind,
  units = 1
): { ok: true } | { ok: false; message: string } {
  if (kind === "talk" && snapshot.talkUsed + units > snapshot.talkLimit) {
    return {
      ok: false,
      message:
        "This workspace has reached its configured Talk budget for the period. Saved work is unchanged. Raise the limit in configuration or continue manually."
    };
  }
  if (kind === "image" && snapshot.imagesUsed + units > snapshot.imageLimit) {
    return {
      ok: false,
      message:
        "This workspace has reached its configured image-generation budget. Existing drafts and logos remain available."
    };
  }
  if (kind === "voice" && snapshot.voiceMinutesUsed + units > snapshot.voiceMinuteLimit) {
    return {
      ok: false,
      message: "This workspace has reached its configured voice budget. Text Talk remains available."
    };
  }
  return { ok: true };
}
