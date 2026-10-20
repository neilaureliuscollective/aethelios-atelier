import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { estimateItemSchema, formatEstimate, prepareEstimate } from "@/lib/cofounder/estimates";
import { CompanionWork } from "@/lib/cofounder/work";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  items: z.array(estimateItemSchema).min(1).max(40)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const estimate = prepareEstimate(body.items, context.profile.approvedRates);
    if (!estimate.ok) {
      return json({ ok: false, error: "invalid_estimate", message: estimate.error }, 400);
    }
    const item = await new CompanionWork(store).saveDraft(context.business.id, auth.user, {
      title: "Draft estimate — owner review required",
      body: formatEstimate(estimate.estimate),
      kind: "copy"
    });
    return json({ ok: true, estimate: estimate.estimate, workItem: item });
  } catch (error) {
    return handleError(error);
  }
}
