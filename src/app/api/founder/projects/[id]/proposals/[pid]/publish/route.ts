import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const auth = await requireSession();
    const { id, pid } = await context.params;
    const service = new ProjectService(await getStore());
    const proposal = await service.publishProposal(id, auth.user, pid);
    return json({
      ok: true,
      proposal,
      visibility: "client_visible",
      note: "The client can now review this exact version. Later edits create a new version."
    });
  } catch (error) {
    return handleError(error);
  }
}
