import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["accept", "reject", "edit"]),
  editedValue: z.string().max(4000).optional()
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; sid: string }> }
) {
  try {
    const auth = await requireSession();
    const { id, sid } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    const service = new ProjectService(getStore());
    const suggestion = service.resolveSuggestion(id, sid, auth.user, body.action, body.editedValue);
    return json({ ok: true, suggestion, view: service.clientView(id, auth.user) });
  } catch (error) {
    return handleError(error);
  }
}
