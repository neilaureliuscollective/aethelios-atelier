import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  body: z.string().min(1).max(8000)
});

export async function POST(request: Request, context: { params: Promise<{ id: string; rid: string }> }) {
  try {
    const auth = await requireSession();
    const { id, rid } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(await getStore());
    const resolved = await service.respondToContentRequest(id, auth.user, rid, payload.body);
    return json({ ok: true, request: resolved });
  } catch (error) {
    return handleError(error);
  }
}
