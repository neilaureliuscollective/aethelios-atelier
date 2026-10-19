import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["clarification", "progress_note", "decision"]),
  body: z.string().min(1).max(4000),
  requiresResponse: z.boolean().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(getStore());
    const update = service.publishUpdate(
      id,
      auth.user,
      payload.kind,
      payload.body,
      payload.kind === "clarification" ? true : Boolean(payload.requiresResponse)
    );
    return json({
      ok: true,
      update,
      visibility: "client_visible",
      labeled: true
    });
  } catch (error) {
    return handleError(error);
  }
}
