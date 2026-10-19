import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const auth = await requireSession();
    const service = new ProjectService(getStore());
    return json({ ok: true, queue: service.founderQueue(auth.user) });
  } catch (error) {
    return handleError(error);
  }
}
