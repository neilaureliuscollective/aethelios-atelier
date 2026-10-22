import { z } from "zod";
import { INTAKE_FIELD_KEYS } from "@/lib/cofounder/intake";
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
    const result = await workspace.proposeDocumentIntake(membership.business.id, auth.user, {
      documentId: id,
      fieldKey: body.fieldKey,
      pageNumber: body.pageNumber,
      excerpt: body.excerpt,
      proposedValue: body.proposedValue
    });
    return json({
      ok: true,
      draft: result.draft,
      candidate: result.candidate,
      profile: result.profile,
      mode: "review" as const
    });
  } catch (error) {
    return handleError(error);
  }
}

const resolveSchema = reviewSchema.extend({
  candidateId: z.string().min(1).optional(),
  action: z.enum(["confirm", "edit"]).default("confirm"),
  ownerEdited: z.boolean().optional(),
  conflictResolution: z.enum(["replace", "keep"]).optional(),
  selectSource: z.boolean().optional()
});

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = resolveSchema.parse(await readJson(request));
    const { auth, workspace, context: membership } = await requireCompanionWrite(body.businessId);
    const result = await workspace.resolveDocumentIntake(membership.business.id, auth.user, {
      documentId: id,
      candidateId: body.candidateId,
      fieldKey: body.fieldKey,
      pageNumber: body.pageNumber,
      excerpt: body.excerpt,
      proposedValue: body.proposedValue,
      action: body.action,
      ownerEdited: body.ownerEdited,
      conflictResolution: body.conflictResolution,
      selectSource: body.selectSource
    });
    return json({
      ok: true,
      draft: result.draft,
      candidate: result.candidate,
      confirmation: result.confirmation,
      profile: result.profile
    });
  } catch (error) {
    return handleError(error);
  }
}

const rejectSchema = z.object({
  businessId: z.string().min(1).optional(),
  candidateId: z.string().min(1),
  action: z.enum(["reject", "leave"])
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = rejectSchema.parse(await readJson(request));
    const { auth, workspace, context: membership } = await requireCompanionWrite(body.businessId);
    if (body.action === "leave") {
      const candidate = membership.profile.documentCandidates.find(
        (item) => item.id === body.candidateId && item.documentId === id
      );
      return json({ ok: true, candidate, mode: "unresolved" as const });
    }
    const result = await workspace.resolveDocumentIntake(membership.business.id, auth.user, {
      documentId: id,
      candidateId: body.candidateId,
      fieldKey: "services",
      pageNumber: 1,
      excerpt: "placeholder excerpt for reject",
      action: "reject"
    });
    return json({ ok: true, candidate: result.candidate, profile: result.profile });
  } catch (error) {
    return handleError(error);
  }
}
