import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  kind: z.enum(["comment", "request_changes", "approve"]),
  expectedVersion: z.number().int().positive(),
  body: z.string().max(8000).optional(),
  consent: z.boolean().optional(),
  agreementTextAcknowledged: z.boolean().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string; vid: string }> }) {
  try {
    const auth = await requireSession();
    const { id, vid } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    if (payload.kind === "approve" && payload.agreementTextAcknowledged !== true) {
      return json(
        { ok: false, error: "forbidden", message: "Approval requires acknowledging this exact version." },
        403
      );
    }
    const service = new ProjectService(await getStore());
    const feedback = await service.addDeliveryFeedback(
      id,
      auth.user,
      vid,
      payload.kind,
      payload.expectedVersion,
      payload.body ?? "",
      Boolean(payload.consent)
    );
    return json({ ok: true, feedback });
  } catch (error) {
    return handleError(error);
  }
}
