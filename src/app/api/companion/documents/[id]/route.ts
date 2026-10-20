import { requireCompanion } from "@/lib/cofounder/http";
import { handleError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const requested = new URL(request.url).searchParams.get("businessId") ?? undefined;
    const { auth, workspace, context: membership } = await requireCompanion(requested);
    const { document, blob } = await workspace.getDocumentBytes(membership.business.id, auth.user, id);
    if (!document.mime.startsWith("image/") && !document.mime.startsWith("text/") && document.mime !== "application/json") {
      return json(
        { ok: false, error: "unsupported", message: "Only authorized image or text documents can be fetched." },
        403
      );
    }
    return new Response(Buffer.from(blob.bytes), {
      status: 200,
      headers: {
        "Content-Type": blob.mime,
        "Cache-Control": "private, no-store",
        "X-Atelier-Document": document.id
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
