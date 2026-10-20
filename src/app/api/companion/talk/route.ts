import { z } from "zod";
import { requireCompanion } from "@/lib/cofounder/http";
import { CompanionTalk } from "@/lib/cofounder/talk";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const { auth, store, context } = await requireCompanion(url.searchParams.get("businessId") ?? undefined);
    const talk = new CompanionTalk(store);
    const history = await talk.history(
      context.business.id,
      auth.user,
      url.searchParams.get("conversationId") ?? undefined
    );
    return json({
      ok: true,
      conversation: history.conversation,
      messages: history.messages,
      startingActions: talk.startingActions()
    });
  } catch (error) {
    return handleError(error);
  }
}

const bodySchema = z.object({
  businessId: z.string().min(1).optional(),
  conversationId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  message: z.string().min(1).max(8000),
  idempotencyKey: z.string().min(8).max(80).optional()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const { auth, store, context } = await requireCompanion(body.businessId);
    const talk = new CompanionTalk(store);
    const turn = await talk.turn({
      businessId: context.business.id,
      user: auth.user,
      auth,
      message: body.message,
      conversationId: body.conversationId,
      projectId: body.projectId,
      idempotencyKey: body.idempotencyKey,
      signal: request.signal
    });
    return json({ ok: true, ...turn });
  } catch (error) {
    return handleError(error);
  }
}
