import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { brandKitFromSelection } from "@/lib/cofounder/brandKit";
import { ConflictError, DomainError } from "@/lib/domain/errors";
import { handleError, json, readJson } from "@/lib/http";

const schema = z.object({
  businessId: z.string().min(1), selection: z.unknown(),
  mode: z.enum(["new_brand", "existing_brand"]), locked: z.boolean(),
  expectedProfileUpdatedAt: z.string().min(1)
});
export async function POST(request: Request) {
  try {
    const body = schema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    if (body.expectedProfileUpdatedAt !== context.profile.updatedAt) {
      throw new ConflictError("The business profile changed. Reload and review the direction again.");
    }
    const kit = brandKitFromSelection(body.selection, {
      previous: context.profile.brandKit, mode: body.mode, locked: body.locked,
      retainedAssets: context.profile.brandAssets
    });
    if (!kit) throw new DomainError("The Discovery selection is invalid or outdated.", "invalid_direction");
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(context.profile.updatedAt) + 1)).toISOString();
    const profile = await store.companion.compareAndSwapProfile({
      ...context.profile, brandKit: kit, updatedAt, updatedBy: auth.user.id
    }, body.expectedProfileUpdatedAt);
    if (!profile) throw new ConflictError("The business profile changed while saving. Reload and review again.");
    return json({ ok: true, brandKit: profile.brandKit });
  } catch (error) { return handleError(error); }
}
