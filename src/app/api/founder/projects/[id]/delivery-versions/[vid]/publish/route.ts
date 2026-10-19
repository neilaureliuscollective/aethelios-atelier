import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

export async function POST(_: Request, context: { params: Promise<{ id: string; vid: string }> }) {
  try {
    const auth = await requireSession();
    const { id, vid } = await context.params;
    const service = new ProjectService(await getStore());
    const version = await service.publishDeliveryVersion(id, auth.user, vid);
    return json({
      ok: true,
      version,
      visibility: "client_visible",
      note: "The client can now review this exact version in the review room."
    });
  } catch (error) {
    return handleError(error);
  }
}
