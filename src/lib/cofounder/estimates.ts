import { z } from "zod";
import type { ApprovedRate, EstimateLine, PreparedEstimate } from "@/lib/cofounder/types";

export const estimateItemSchema = z.object({
  label: z.string().min(1).max(200),
  quantity: z.number().finite().positive().max(10_000),
  rateId: z.string().min(1).max(80)
});

export type EstimateItemInput = z.infer<typeof estimateItemSchema>;

export function centsToUsd(cents: number) {
  return (cents / 100).toFixed(2);
}

export function prepareEstimate(
  items: EstimateItemInput[],
  rates: ApprovedRate[]
): { ok: true; estimate: PreparedEstimate } | { ok: false; error: string } {
  const parsed = z.array(estimateItemSchema).min(1).max(40).safeParse(items);
  if (!parsed.success) {
    return { ok: false, error: "Estimate items are invalid. Quantity and an approved rate are required." };
  }
  const byId = new Map(rates.map((rate) => [rate.id, rate]));
  const lines: EstimateLine[] = [];
  for (const item of parsed.data) {
    const rate = byId.get(item.rateId);
    if (!rate) {
      return {
        ok: false,
        error: `No approved rate matches “${item.rateId}”. Estimates only use owner-supplied rates.`
      };
    }
    const amountCents = Math.round(item.quantity * rate.amountCents);
    if (!Number.isSafeInteger(amountCents)) {
      return { ok: false, error: "Estimate total is outside a safe integer range." };
    }
    lines.push({
      id: `line_${rate.id}_${lines.length + 1}`,
      label: item.label,
      quantity: item.quantity,
      rateId: rate.id,
      amountCents
    });
  }
  const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  return {
    ok: true,
    estimate: {
      currency: "USD",
      lines,
      subtotalCents,
      labeled: "draft_requires_owner_review",
      notes:
        "Draft estimate from owner-supplied items and approved rates. This is not a quote, invoice, or collected charge. Neil confirms commercial terms."
    }
  };
}

export function formatEstimate(estimate: PreparedEstimate) {
  const lines = estimate.lines
    .map((line) => `- ${line.label}: ${line.quantity} × $${centsToUsd(line.amountCents / line.quantity)} = $${centsToUsd(line.amountCents)}`)
    .join("\n");
  return [
    "Draft estimate — owner review required",
    lines,
    `Subtotal: $${centsToUsd(estimate.subtotalCents)} ${estimate.currency}`,
    estimate.notes
  ].join("\n");
}
