import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const service = new ProjectService(getStore());
    const event = service.startReview(id, auth.user);
    return json({
      ok: true,
      event,
      note: "Client-visible review progress is now allowed because this authorized event exists."
    });
  } catch (error) {
    return handleError(error);
  }
}
