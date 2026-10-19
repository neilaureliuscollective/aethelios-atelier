import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum(["approve", "request_changes"]),
  expectedVersion: z.number().int().positive(),
  body: z.string().max(8000).optional(),
  consent: z.boolean().optional(),
  agreementTextAcknowledged: z.boolean().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string; pid: string }> }) {
  try {
    const auth = await requireSession();
    const { id, pid } = await context.params;
    const payload = bodySchema.parse(await readJson(request));
    if (payload.action === "approve" && payload.agreementTextAcknowledged !== true) {
      return json(
        { ok: false, error: "forbidden", message: "Agreement requires acknowledging the exact proposal version." },
        403
      );
    }
    const service = new ProjectService(await getStore());
    const result = await service.decideProposal(
      id,
      auth.user,
      pid,
      payload.action,
      payload.expectedVersion,
      payload.body ?? "",
      Boolean(payload.consent)
    );
    return json({
      ok: true,
      ...result,
      note:
        payload.action === "approve"
          ? "This records agreement to the named proposal version. It is not a payment."
          : "The requested changes stay attached to that version. Neil will publish a new version."
    });
  } catch (error) {
    return handleError(error);
  }
}
