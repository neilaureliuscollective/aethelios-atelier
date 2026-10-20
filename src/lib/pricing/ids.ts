export const PLAN_IDS = ["atelier", "connected", "partnership"] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export const PLAN_LABELS: Record<PlanId, string> = {
  atelier: "Atelier",
  connected: "Atelier Connected",
  partnership: "Atelier Partnership"
};

export function isPlanId(value: unknown): value is PlanId {
  return value === "atelier" || value === "connected" || value === "partnership";
}

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  return isPlanId(value) ? value : null;
}

export const PLAN_INTEREST_STORAGE_KEY = "atelier.planInterest.v1";

export const PLAN_INTEREST_FIELD = "constraints" as const;
