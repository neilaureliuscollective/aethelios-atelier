import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { parseGuestDraft } from "@/lib/guest/draft";
import { ProjectService } from "@/lib/domain/projects";
import { ForbiddenError } from "@/lib/domain/errors";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  confirmed: z.boolean(),
  draft: z.unknown()
});

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    const body = bodySchema.parse(await readJson(request));
    const draft = parseGuestDraft(body.draft);
    if (!draft) {
      throw new ForbiddenError("The guest draft could not be read.");
    }
    const service = new ProjectService(await getStore());
    const project = await service.adoptGuestDraft(auth.user, draft, body.confirmed);
    return json({
      ok: true,
      project,
      note: "Keep the guest copy on the device until you confirm this save in the workspace."
    });
  } catch (error) {
    return handleError(error);
  }
}
