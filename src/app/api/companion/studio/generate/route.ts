import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  draftId: z.string().min(1),
  prompt: z.string().min(1).max(2000),
  idempotencyKey: z.string().min(8).max(80),
  sourceAssetId: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const generated = await new CompanionStudio(store).generate(context.business.id, auth.user, auth, {
      draftId: body.draftId,
      prompt: body.prompt,
      idempotencyKey: body.idempotencyKey,
      sourceAssetId: body.sourceAssetId,
      signal: request.signal
    });
    return json({
      ok: true,
      asset: generated.asset,
      applied: generated.applied,
      draft: generated.draft,
      conflict: generated.conflict
    });
  } catch (error) {
    return handleError(error);
  }
}
