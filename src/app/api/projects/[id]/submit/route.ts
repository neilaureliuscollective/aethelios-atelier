import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ProjectService } from "@/lib/domain/projects";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  consent: z.literal(true),
  idempotencyKey: z.string().min(8),
  consentTextAcknowledged: z.literal(true),
  expectedVersion: z.number().int().positive()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSession();
    const { id } = await context.params;
    const body = bodySchema.parse(await readJson(request));
    const service = new ProjectService(getStore());
    const result = service.submit(id, auth.user, body.consent, body.idempotencyKey, body.expectedVersion);
    const confirmed = getStore().getSubmission(result.submission.id);
    if (!confirmed) {
      return json(
        {
          ok: false,
          error: "uncertain",
          message: "The send completed without a readable receipt. Retry the same command."
        },
        409
      );
    }
    return json({
      ok: true,
      submitted: true,
      duplicate: result.duplicate,
      receipt: {
        receiptId: confirmed.receiptId,
        submittedAt: confirmed.createdAt,
        submissionId: confirmed.id,
        version: confirmed.reviewedVersion
      },
      note: "Submitted is not the same as founder review. This receipt confirms the snapshot was stored."
    });
  } catch (error) {
    return handleError(error);
  }
}
