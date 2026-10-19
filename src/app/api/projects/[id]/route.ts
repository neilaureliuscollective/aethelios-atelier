import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { normalizeBrief } from "@/lib/brief";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const patchSchema = z.object({
  expectedVersion: z.number().int().positive(),
  localGeneration: z.number().int().optional(),
  brief: z.unknown()
});

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const service = new ProjectService(await getStore());
    const view = await service.clientView(id, auth.user);
    return json({ ok: true, ...view });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const body = patchSchema.parse(await readJson(request));
    const service = new ProjectService(await getStore());
    const result = await service.saveBrief(
      id,
      auth.user,
      normalizeBrief(body.brief),
      body.expectedVersion,
      body.localGeneration
    );
    return json({ ok: true, ...result });
  } catch (error) {
    return handleError(error);
  }
}
