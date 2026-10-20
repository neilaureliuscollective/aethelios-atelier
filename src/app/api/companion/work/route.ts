import { z } from "zod";
import { requireCompanion, requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionWork } from "@/lib/cofounder/work";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { auth, store, context } = await requireCompanion(url.searchParams.get("businessId") ?? undefined);
    const kind = url.searchParams.get("kind") as "draft" | "task" | "asset" | "estimate" | null;
    const items = await new CompanionWork(store).list(context.business.id, auth.user, kind ?? undefined);
    return json({ ok: true, items });
  } catch (error) {
    return handleError(error);
  }
}

const saveSchema = z.object({
  businessId: z.string().min(1).optional(),
  workItemId: z.string().min(1).optional(),
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(12_000),
  kind: z.string().max(40).optional(),
  projectId: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const body = saveSchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const item = await new CompanionWork(store).saveDraft(context.business.id, auth.user, body);
    return json({ ok: true, item });
  } catch (error) {
    return handleError(error);
  }
}

const archiveSchema = z.object({
  businessId: z.string().min(1).optional(),
  workItemId: z.string().min(1),
  action: z.enum(["archive", "confirm"]).default("archive")
});

export async function PATCH(request: Request) {
  try {
    const body = archiveSchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const work = new CompanionWork(store);
    const item =
      body.action === "confirm"
        ? await work.confirmAction(context.business.id, auth.user, body.workItemId)
        : await work.archive(context.business.id, auth.user, body.workItemId);
    return json({ ok: true, item });
  } catch (error) {
    return handleError(error);
  }
}
