import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionWork } from "@/lib/cofounder/work";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  title: z.string().min(1).max(160),
  detail: z.string().max(2000).optional(),
  status: z.enum(["open", "in_progress", "done", "archived"]).optional(),
  projectId: z.string().min(1).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const item = await new CompanionWork(store).upsertTask(context.business.id, auth.user, body);
    return json({ ok: true, item });
  } catch (error) {
    return handleError(error);
  }
}
