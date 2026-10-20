import { applyClientValue } from "@/lib/brief";
import {
  PLAN_INTEREST_FIELD,
  PLAN_INTEREST_STORAGE_KEY,
  PLAN_LABELS,
  parsePlanId,
  type PlanId
} from "@/lib/pricing/ids";
import type { Brief } from "@/lib/types";

export type PlanInterestDecision = "append" | "replace" | "skip";

export type PlanInterestRecord = {
  version: 1;
  kind: "plan_interest";
  planId: PlanId;
  capturedAt: string;
};

export type PlanInterestProposal = {
  planId: PlanId;
  label: string;
  field: typeof PLAN_INTEREST_FIELD;
  existingValue: string;
  proposedValue: string;
  defaultDecision: PlanInterestDecision;
};

export function planInterestNote(planId: PlanId): string {
  return `Discuss the ${PLAN_LABELS[planId]} ongoing plan. Selecting this did not start a subscription, accept terms, or set a price.`;
}

export function parsePlanInterestRecord(raw: unknown): PlanInterestRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<PlanInterestRecord>;
  if (value.version !== 1 || value.kind !== "plan_interest") return null;
  const planId = parsePlanId(value.planId);
  if (!planId) return null;
  return {
    version: 1,
    kind: "plan_interest",
    planId,
    capturedAt: typeof value.capturedAt === "string" ? value.capturedAt : ""
  };
}

export function createPlanInterestRecord(planId: PlanId, now = new Date()): PlanInterestRecord {
  return {
    version: 1,
    kind: "plan_interest",
    planId,
    capturedAt: now.toISOString()
  };
}

export function readPlanInterestFromSearch(search: string | URLSearchParams | null | undefined): PlanId | null {
  if (!search) return null;
  const params = typeof search === "string" ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search) : search;
  return parsePlanId(params.get("plan"));
}

export function planDiscussionHref(planId: PlanId): string {
  return `/project?plan=${planId}`;
}

export function proposePlanInterest(brief: Brief, planId: PlanId): PlanInterestProposal {
  const existingValue = brief[PLAN_INTEREST_FIELD].value;
  return {
    planId,
    label: PLAN_LABELS[planId],
    field: PLAN_INTEREST_FIELD,
    existingValue,
    proposedValue: planInterestNote(planId),
    defaultDecision: existingValue.trim() ? "append" : "replace"
  };
}

export function applyPlanInterest(input: {
  brief: Brief;
  planId: PlanId;
  decision: PlanInterestDecision;
}): Brief {
  const proposal = proposePlanInterest(input.brief, input.planId);
  if (input.decision === "skip") return input.brief;
  if (input.decision === "replace") {
    return applyClientValue(input.brief, PLAN_INTEREST_FIELD, proposal.proposedValue);
  }
  const existing = proposal.existingValue.trim();
  if (!existing) {
    return applyClientValue(input.brief, PLAN_INTEREST_FIELD, proposal.proposedValue);
  }
  if (existing.includes(proposal.proposedValue)) return input.brief;
  return applyClientValue(input.brief, PLAN_INTEREST_FIELD, `${existing}\n\n${proposal.proposedValue}`);
}

export function readStoredPlanInterest(): PlanInterestRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(PLAN_INTEREST_STORAGE_KEY);
  if (!raw) return null;
  try {
    return parsePlanInterestRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeStoredPlanInterest(record: PlanInterestRecord) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(PLAN_INTEREST_STORAGE_KEY, JSON.stringify(record));
}

export function clearStoredPlanInterest() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(PLAN_INTEREST_STORAGE_KEY);
}
