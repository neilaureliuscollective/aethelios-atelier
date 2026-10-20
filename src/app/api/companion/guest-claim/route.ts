import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { GuestWorkService, publicGuestClaim } from "@/lib/guest/claim";
import { handleError, json, readJson } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";

const bodySchema = z.object({
  guestWorkId: z.string().min(1).max(80),
  kind: z.enum(["discovery", "brief"]),
  destination: z.string().max(200).optional(),
  payload: z.unknown().optional()
});

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    const guestWorkId = new URL(request.url).searchParams.get("guestWorkId") ?? "";
    const claim = await new GuestWorkService(await getStore()).readForUser(auth.user, guestWorkId);
    return json({ ok: true, claim: claim ? publicGuestClaim(claim) : null });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    const body = bodySchema.parse(await readJson(request));
    const claim = await new GuestWorkService(await getStore()).claim(auth.user, body);
    return json({ ok: true, claim: publicGuestClaim(claim) });
  } catch (error) {
    return handleError(error);
  }
}
