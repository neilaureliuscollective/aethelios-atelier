import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";
import { normalizeBrief } from "@/lib/brief";

export const runtime = "nodejs";

const createSchema = z.object({
  brief: z.unknown().optional()
});

export async function GET() {
  try {
    const auth = await requireSession();
    const service = new ProjectService(getStore());
    return json({
      ok: true,
      labeledPersistence: true,
      projects: service.listForOwner(auth.user)
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    const body = createSchema.parse(await readJson(request));
    const service = new ProjectService(getStore());
    const project = service.createProject(
      auth.user,
      body.brief ? normalizeBrief(body.brief) : undefined
    );
    return json({ ok: true, project }, 201);
  } catch (error) {
    return handleError(error);
  }
}
