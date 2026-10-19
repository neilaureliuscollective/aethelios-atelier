import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  body: z.string().min(1).max(8000),
  kind: z.enum(["private_note", "internal_proposal"]).default("private_note")
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    const service = new ProjectService(getStore());
    const note = service.addPrivateNote(id, auth.user, payload.body, payload.kind);
    return json({
      ok: true,
      note,
      visibility: "founder_only",
      warning: "This note is private and must never be published to the client."
    });
  } catch (error) {
    return handleError(error);
  }
}
