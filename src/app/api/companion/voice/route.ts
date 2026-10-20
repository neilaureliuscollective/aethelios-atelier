import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionVoice, voiceCapability } from "@/lib/cofounder/voice";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  return json({ ok: true, voice: voiceCapability() });
}

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  sdp: z.string().min(10)
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const session = await new CompanionVoice(store).createWebRtcSession({
      businessId: context.business.id,
      user: auth.user,
      sdp: body.sdp
    });
    return json({ ok: true, transport: session.transport, sdp: session.sdp, workspaceBound: session.workspaceBound }, 201);
  } catch (error) {
    return handleError(error);
  }
}
