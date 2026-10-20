import { z } from "zod";
import { BusinessAdoption } from "@/lib/cofounder/confirmation";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  businessName: z.string().max(160),
  businessContext: z.string().max(2000).optional(),
  sourceSelectionId: z.string().max(80).nullable().optional(),
  sourceRevision: z.number().int().nonnegative().nullable().optional(),
  directionId: z.string().max(40).nullable().optional(),
  replaceConfirmedDirection: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const confirmation = await new BusinessAdoption(store).confirm(context.business.id, auth.user, {
      businessName: body.businessName,
      businessContext: body.businessContext ?? "",
      sourceSelectionId: body.sourceSelectionId,
      sourceRevision: body.sourceRevision,
      directionId: body.directionId,
      replaceConfirmedDirection: body.replaceConfirmedDirection
    });
    return json({ ok: true, confirmation });
  } catch (error) {
    return handleError(error);
  }
}
