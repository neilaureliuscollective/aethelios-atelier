import { z } from "zod";
import { draftIntakeChange, INTAKE_FIELD_KEYS } from "@/lib/cofounder/intake";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const reviewSchema = z.object({
  businessId: z.string().min(1).optional(),
  fieldKey: z.enum(INTAKE_FIELD_KEYS),
  pageNumber: z.number().int().positive(),
  excerpt: z.string().min(8).max(4000),
  proposedValue: z.string().max(4000).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = reviewSchema.parse(await readJson(request));
    const { auth, workspace, context: membership } = await requireCompanionWrite(body.businessId);
    const preview = await workspace.previewDocument(membership.business.id, auth.user, id);
    const draft = draftIntakeChange({
      document: preview.document,
      profile: preview.profile,
      extracted: preview.extracted,
      fieldKey: body.fieldKey,
      pageNumber: body.pageNumber,
      excerpt: body.excerpt,
      proposedValue: body.proposedValue
    });
    return json({ ok: true, draft, mode: "review" as const });
  } catch (error) {
    return handleError(error);
  }
}

const confirmSchema = reviewSchema.extend({
  confirm: z.literal(true)
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = confirmSchema.parse(await readJson(request));
    const { auth, workspace, context: membership } = await requireCompanionWrite(body.businessId);
    const result = await workspace.confirmDocumentIntake(membership.business.id, auth.user, {
      documentId: id,
      fieldKey: body.fieldKey,
      pageNumber: body.pageNumber,
      excerpt: body.excerpt,
      proposedValue: body.proposedValue
    });
    return json({
      ok: true,
      draft: result.draft,
      confirmation: result.confirmation,
      profile: result.profile
    });
  } catch (error) {
    return handleError(error);
  }
}
