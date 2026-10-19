import { z } from "zod";
import { AureliusBoundary } from "@/lib/aurelius/boundary";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  body: z.string().min(1).max(8000)
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    const store = getStore();
    const projects = new ProjectService(store);
    const project = projects.getOwnedProject(id, auth.user);
    const aurelius = new AureliusBoundary(store, projects);
    const result = await aurelius.reply({
      project,
      user: auth.user,
      message: body.body,
      signal: request.signal
    });
    const view = projects.clientView(id, auth.user);
    return json({
      ok: true,
      liveAi: result.liveAi,
      message: result.message,
      view
    });
  } catch (error) {
    return handleError(error);
  }
}
