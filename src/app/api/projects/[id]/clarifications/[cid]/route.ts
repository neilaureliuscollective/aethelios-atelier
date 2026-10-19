import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  body: z.string().min(1).max(4000)
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; cid: string }> }
) {
  try {
    const auth = await requireSession();
    const { id, cid } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(await getStore());
    const response = await service.respondToClarification(id, auth.user, cid, payload.body);
    return json({ ok: true, response, view: await service.clientView(id, auth.user) });
  } catch (error) {
    return handleError(error);
  }
}
