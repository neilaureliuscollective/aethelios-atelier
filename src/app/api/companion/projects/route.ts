import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  projectId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, workspace, context } = await requireCompanionWrite(body.businessId);
    const project = await workspace.linkProject(context.business.id, auth.user, body.projectId);
    return json({ ok: true, project });
  } catch (error) {
    return handleError(error);
  }
}
