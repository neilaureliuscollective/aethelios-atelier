import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  status: z.enum(["upcoming", "current", "waiting_on_client", "complete"])
});

export async function POST(request: Request, context: { params: Promise<{ id: string; mid: string }> }) {
  try {
    const auth = await requireSession();
    const { id, mid } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(await getStore());
    const milestone = await service.updateMilestoneStatus(id, auth.user, mid, payload.status);
    return json({ ok: true, milestone });
  } catch (error) {
    return handleError(error);
  }
}
