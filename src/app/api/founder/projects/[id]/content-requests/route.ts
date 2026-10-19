import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  detail: z.string().min(1).max(4000)
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(await getStore());
    const requestItem = await service.addContentRequest(id, auth.user, payload.title, payload.detail);
    return json({ ok: true, request: requestItem, visibility: "client_visible" });
  } catch (error) {
    return handleError(error);
  }
}
