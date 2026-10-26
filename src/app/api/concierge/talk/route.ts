import { runConciergeTurn } from "@/lib/concierge/talk";
import { conciergeTalkRequestSchema } from "@/lib/concierge/schema";
import { encodeConciergeEvent } from "@/lib/concierge/stream";
import type { ConciergeStreamEvent } from "@/lib/concierge/types";
import { LimitError } from "@/lib/domain/errors";
import { handleError, json, readJson } from "@/lib/http";
import { createRateLimiter } from "@/lib/inquiry/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Generous for a real conversation; stops a script from running up the model bill. */
const talkLimiter = createRateLimiter(120);

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    if (talkLimiter.limited(`talk:${clientKey(request)}`)) {
      throw new LimitError("Aethelios needs a short pause. Try again in a little while, or send an inquiry directly.");
    }
    const body = conciergeTalkRequestSchema.parse(await readJson(request));
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (event: ConciergeStreamEvent) => {
          controller.enqueue(encoder.encode(encodeConciergeEvent(event)));
        };
        void runConciergeTurn({
          message: body.message,
          history: body.history,
          brief: body.brief,
          turn: body.turn,
          document: body.document,
          preview: body.preview,
          compose: body.compose,
          signal: request.signal,
          onEvent: send
        })
          .then(() => controller.close())
          .catch((error) => {
            send({
              type: "error",
              message: error instanceof Error ? error.message : "Aethelios could not finish that reply."
            });
            controller.close();
          });
      }
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-store",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  return json({
    ok: true,
    guest: true,
    labeled: "display_only",
    note: "Aethelios holds a discovery conversation and writes a direction. It does not execute code, quote, or accept a commission."
  });
}
