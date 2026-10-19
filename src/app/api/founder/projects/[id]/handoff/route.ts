import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const service = new ProjectService(await getStore());
    const handoff = await service.deliveryHandoff(id, auth.user);
    return json({
      ok: true,
      handoff,
      visibility: "founder_only",
      note: "Copy this structured brief into Cursor or Codex. Payments are not included."
    });
  } catch (error) {
    return handleError(error);
  }
}
