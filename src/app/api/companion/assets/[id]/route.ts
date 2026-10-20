import { requireCompanion } from "@/lib/cofounder/http";
import { CompanionStudio } from "@/lib/cofounder/studio";
import { handleError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const requested = new URL(request.url).searchParams.get("businessId") ?? undefined;
    const { auth, store, context: workspace } = await requireCompanion(requested);
    const { asset, blob } = await new CompanionStudio(store).getAssetBytes(workspace.business.id, auth.user, id);
    return new Response(Buffer.from(blob.bytes), {
      status: 200,
      headers: {
        "Content-Type": blob.mime,
        "Cache-Control": "private, no-store",
        "X-Atelier-Asset": asset.id,
        "X-Atelier-Status": asset.status
      }
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST() {
  return json({ ok: false, error: "method_not_allowed", message: "Use GET with an authorized session." }, 405);
}
