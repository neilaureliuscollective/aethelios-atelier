import { z } from "zod";
import { requireCompanion, requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionStudio, studioLayouts } from "@/lib/cofounder/studio";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { auth, store, context } = await requireCompanion(url.searchParams.get("businessId") ?? undefined);
    const studio = new CompanionStudio(store);
    const draftId = url.searchParams.get("draftId");
    const workItemId = url.searchParams.get("workItemId");
    if (draftId) {
      const draft = await studio.getDraft(context.business.id, auth.user, draftId);
      return json({ ok: true, draft, layouts: studioLayouts() });
    }
    if (workItemId) {
      const opened = await studio.openFromWork(context.business.id, auth.user, workItemId);
      return json({ ok: true, draft: opened.draft, created: opened.created, workItem: opened.workItem, layouts: studioLayouts() });
    }
    const drafts = await studio.listDrafts(context.business.id, auth.user);
    return json({ ok: true, drafts, layouts: studioLayouts() });
  } catch (error) {
    return handleError(error);
  }
}

const createSchema = z.object({
  businessId: z.string().min(1).optional(),
  headline: z.string().min(1).max(160),
  body: z.string().max(800).optional(),
  direction: z.string().max(800).optional(),
  layout: z.enum(["square_announcement", "portrait_social", "story_portrait", "website_banner"]).optional(),
  workItemId: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const created = await new CompanionStudio(store).createFromCopy(context.business.id, auth.user, body);
    return json({ ok: true, ...created });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  businessId: z.string().min(1).optional(),
  draftId: z.string().min(1),
  layout: z.enum(["square_announcement", "portrait_social", "story_portrait", "website_banner"]).optional(),
  layers: z
    .array(
      z.object({
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
      })
    )
    .optional(),
  selectedAssetId: z.string().optional(),
  expectedUpdatedAt: z.string().optional()
});

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const draft = await new CompanionStudio(store).updateDraft(context.business.id, auth.user, body.draftId, body);
    return json({ ok: true, draft });
  } catch (error) {
    return handleError(error);
  }
}
