import { z } from "zod";
import { requireCompanionWrite } from "@/lib/cofounder/http";
import { CompanionVoice, voiceCapability } from "@/lib/cofounder/voice";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  return json({ ok: true, voice: voiceCapability() });
}

const startSchema = z.object({
  businessId: z.string().min(1).optional(),
  sdp: z.string().min(10)
});

const endSchema = z.object({
  businessId: z.string().min(1).optional(),
  usageEventId: z.string().min(1),
  action: z.enum(["end", "cancel"]).default("end"),
  startedAt: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = startSchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const session = await new CompanionVoice(store).createWebRtcSession({
      businessId: context.business.id,
      user: auth.user,
      sdp: body.sdp
    });
    return json(
      {
        ok: true,
        transport: session.transport,
        sdp: session.sdp,
        workspaceBound: session.workspaceBound,
        usageEventId: session.usageEventId,
        billedMinutes: session.billedMinutes,
        limitation: session.limitation
      },
      201
    );
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = endSchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanionWrite(body.businessId);
    const ended = await new CompanionVoice(store).endSession({
      businessId: context.business.id,
      user: auth.user,
      usageEventId: body.usageEventId,
      startedAt: body.startedAt ?? new Date().toISOString()
    });
    return json({
      ok: true,
      billedMinutes: ended.billedMinutes,
      elapsedMs: ended.elapsedMs,
      limitation: ended.limitation
    });
  } catch (error) {
    return handleError(error);
  }
}
