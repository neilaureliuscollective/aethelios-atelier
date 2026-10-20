import { z } from "zod";
import { requireCompanion } from "@/lib/cofounder/http";
import { PROFILE_FIELD_KEYS } from "@/lib/cofounder/types";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  proposalId: z.string().min(1),
  action: z.enum(["accept", "edit", "reject", "delete"]),
  editedValue: z.string().max(4000).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, workspace, context } = await requireCompanion(body.businessId);
    const proposal = await workspace.resolveMemory(
      context.business.id,
      auth.user,
      body.proposalId,
      body.action,
      body.editedValue
    );
    return json({ ok: true, proposal });
  } catch (error) {
    return handleError(error);
  }
}

const proposeSchema = z.object({
  businessId: z.string().min(1).optional(),
  fieldKey: z.enum(PROFILE_FIELD_KEYS),
  proposedValue: z.string().min(1).max(4000),
  rationale: z.string().max(500).optional()
});

export async function PUT(request: Request) {
  try {
    const body = proposeSchema.parse(await readJson(request));
    const { auth, workspace, context } = await requireCompanion(body.businessId);
    const proposal = await workspace.proposeMemory(
      context.business.id,
      auth.user,
      body.fieldKey,
      body.proposedValue,
      body.rationale
    );
    return json({ ok: true, proposal });
  } catch (error) {
    return handleError(error);
  }
}
