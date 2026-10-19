import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  seedFromBrief: z.boolean().optional(),
  changeSummary: z.string().max(4000).optional(),
  scope: z.unknown().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(await getStore());
    const proposal = await service.saveProposalDraft(
      id,
      auth.user,
      payload.scope,
      payload.changeSummary ?? "",
      Boolean(payload.seedFromBrief)
    );
    return json({
      ok: true,
      proposal,
      visibility: "founder_only",
      warning: "Unpublished drafts are not client-visible. Publishing shares this exact version."
    });
  } catch (error) {
    return handleError(error);
  }
}
