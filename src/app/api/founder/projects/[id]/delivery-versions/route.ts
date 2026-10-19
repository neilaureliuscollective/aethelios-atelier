import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["design", "build"]),
  title: z.string().min(1).max(200),
  summary: z.string().min(1).max(8000),
  previewUrl: z.string().max(2000).optional(),
  notes: z.string().max(8000).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(await getStore());
    const version = await service.saveDeliveryDraft(id, auth.user, payload);
    return json({
      ok: true,
      version,
      visibility: "founder_only",
      warning: "Unpublished design and build versions are not client-visible."
    });
  } catch (error) {
    return handleError(error);
  }
}
