import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    businessId: z.string().min(1).optional(),
    draftId: z.string().min(1),
    assetId: z.string().min(1),
    expectedUpdatedAt: z.string().optional(),
    expectedSaveRevision: z.number().int().positive().optional()
  })
  .refine((body) => Boolean(body.expectedUpdatedAt || body.expectedSaveRevision), {
    message: "A concurrency token is required to apply a retained Studio image."
  });

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const draft = await new CompanionStudio(store).applyAsset(
      context.business.id,
      auth.user,
      body.draftId,
      body.assetId,
      {
        expectedUpdatedAt: body.expectedUpdatedAt,
        expectedSaveRevision: body.expectedSaveRevision
      }
    );
    return json({ ok: true, draft, applied: true, assetId: body.assetId });
  } catch (error) {
    return handleError(error);
  }
}
