import { requireCompanion } from "@/lib/cofounder/http";
import { CompanionWork } from "@/lib/cofounder/work";
import { handleError, json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const requested = new URL(request.url).searchParams.get("businessId") ?? undefined;
    const { auth, store, context } = await requireCompanion(requested);
    const today = await new CompanionWork(store).today(context.business.id, auth.user);
    return json({ ok: true, today });
  } catch (error) {
    return handleError(error);
  }
}
