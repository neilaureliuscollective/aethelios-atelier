import { z } from "zod";
import { requireCompanion } from "@/lib/cofounder/http";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  draftId: z.string().min(1),
  format: z.enum(["square_announcement", "story_portrait", "website_banner"])
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanion(body.businessId);
    const exported = await new CompanionStudio(store).exportDraft(
      context.business.id,
      auth.user,
      body.draftId,
      body.format
    );
    return json({ ok: true, exported });
  } catch (error) {
    return handleError(error);
  }
}
