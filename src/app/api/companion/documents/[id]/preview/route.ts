import { requireCompanion } from "@/lib/cofounder/http";
import { handleError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const requested = new URL(request.url).searchParams.get("businessId") ?? undefined;
    const { auth, workspace, context: membership } = await requireCompanion(requested);
    const preview = await workspace.previewDocument(membership.business.id, auth.user, id);
    return json({
      ok: true,
      document: {
        id: preview.document.id,
        title: preview.document.title,
        mime: preview.document.mime,
        status: preview.document.status,
        source: preview.document.source,
        createdAt: preview.document.createdAt
      },
      extracted: preview.extracted
    });
  } catch (error) {
    return handleError(error);
  }
}
