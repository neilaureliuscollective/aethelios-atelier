import { PLAN_IDS, type PlanId } from "@/lib/cofounder/types";

export { PLAN_IDS, type PlanId };

export const PLAN_LABELS: Record<PlanId, string> = {
  atelier: "Atelier",
  connected: "Atelier Connected",
  partnership: "Atelier Partnership"
};

export function isPlanId(value: unknown): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(String(value));
}

export function parsePlanId(value: string | null | undefined): PlanId | null {
  if (!value) return null;
  return isPlanId(value) ? value : null;
}

export const PLAN_INTEREST_STORAGE_KEY = "atelier.planInterest.v1";

export const PLAN_INTEREST_FIELD = "constraints" as const;
