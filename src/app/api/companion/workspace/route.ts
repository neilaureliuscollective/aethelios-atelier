import { z } from "zod";
import { canMutateWorkspace } from "@/lib/cofounder/workspace";
import { requireCompanion, requireCompanionWrite } from "@/lib/cofounder/http";
import { pendingDocumentCandidates } from "@/lib/cofounder/profile";
import { clientSafeDocuments, clientSafeProfile } from "@/lib/cofounder/isolation";
import { CompanionUsage } from "@/lib/cofounder/usage";
import { voiceCapability } from "@/lib/cofounder/voice";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get("businessId") ?? undefined;
    const { auth, store, workspace, context } = await requireCompanion(requested);
    const usage = await new CompanionUsage(store).snapshot(context.business.id, auth.user);
    const businesses = await workspace.listForUser(auth.user);
    const confirmation = await store.companion.getBusinessConfirmation(context.business.id);
    return json({
      ok: true,
      business: context.business,
      confirmation,
      membership: context.membership,
      profile: clientSafeProfile(context.profile),
      rawProfile: context.profile,
      documents: clientSafeDocuments(context.documents),
      documentCandidates: pendingDocumentCandidates(context.profile),
      projects: context.projects,
      memoryPending: context.memoryPending,
      businesses,
      usage,
      intelligence: aureliusStatus(),
      voice: voiceCapability(),
      canMutate: canMutateWorkspace(context, auth.user)
    });
  } catch (error) {
    return handleError(error);
  }
}

const patchSchema = z.object({
  businessId: z.string().min(1).optional(),
  name: z.string().max(160).optional(),
  fields: z.record(z.string(), z.unknown()).optional(),
  approvedRates: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        unit: z.enum(["each", "hour", "project"]),
        amountCents: z.number().int().nonnegative(),
        currency: z.literal("USD"),
        source: z.string(),
        updatedAt: z.string()
      })
    )
    .optional(),
  sourceDocumentIds: z.array(z.string()).optional()
});

export async function PATCH(request: Request) {
  try {
    const body = patchSchema.parse(await readJson(request));
    const { auth, workspace, context } = await requireCompanionWrite(body.businessId);
    const fields = { ...context.profile.fields };
    if (body.name) {
      fields.name = { ...fields.name, value: body.name, kind: "confirmed", source: "owner", updatedAt: new Date().toISOString() };
    }
    if (body.fields) {
      for (const [key, value] of Object.entries(body.fields)) {
        if (key in fields && value && typeof value === "object") {
          const current = fields[key as keyof typeof fields];
          const incoming = value as { value?: string; kind?: "confirmed" | "preference" };
          const nextValue = incoming.value ?? current.value;
          const valueChanged = incoming.value !== undefined && incoming.value !== current.value;
          fields[key as keyof typeof fields] = valueChanged
            ? {
                ...current,
                value: nextValue,
                kind: incoming.kind ?? current.kind,
                source: "owner",
                updatedAt: new Date().toISOString(),
                sourceDocumentId: undefined,
                sourcePage: undefined,
                sourceExcerpt: undefined,
                sourceStatus: undefined
              }
            : {
                ...current,
                value: nextValue,
                kind: incoming.kind ?? current.kind,
                updatedAt: new Date().toISOString()
              };
        }
      }
    }
    const profile = await workspace.updateProfile(context.business.id, auth.user, {
      fields,
      approvedRates: body.approvedRates,
      sourceDocumentIds: body.sourceDocumentIds
    });
    return json({ ok: true, profile });
  } catch (error) {
    return handleError(error);
  }
}
