import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const layerSchema = z.object({
  id: z.string(),
  kind: z.enum(["headline", "body", "logo", "image"]),
  text: z.string().optional(),
  assetId: z.string().optional(),
  documentId: z.string().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  cropX: z.number().optional(),
  cropY: z.number().optional(),
  cropZoom: z.number().optional()
});

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  draftId: z.string().min(1),
  format: z.enum(["square_announcement", "portrait_social", "story_portrait", "website_banner", "direction_board"]),
  composedPngBase64: z.string().min(8),
  expectedUpdatedAt: z.string().optional(),
  layers: z.array(layerSchema).optional(),
  layout: z.enum(["square_announcement", "portrait_social", "story_portrait", "website_banner", "direction_board"]).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const exported = await new CompanionStudio(store).exportDraft(
      context.business.id,
      auth.user,
      body.draftId,
      body.format,
      {
        composedPngBase64: body.composedPngBase64,
        expectedUpdatedAt: body.expectedUpdatedAt,
        layers: body.layers,
        layout: body.layout ?? body.format
      }
    );
    return json({ ok: true, exported });
  } catch (error) {
    return handleError(error);
  }
}
