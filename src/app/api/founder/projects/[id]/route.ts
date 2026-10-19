import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const service = new ProjectService(getStore());
    return json({ ok: true, ...service.founderView(id, auth.user) });
  } catch (error) {
    return handleError(error);
  }
}
