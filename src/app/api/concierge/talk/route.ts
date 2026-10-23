import { runConciergeTurn } from "@/lib/concierge/talk";
import { conciergeTalkRequestSchema } from "@/lib/concierge/schema";
import { encodeConciergeEvent } from "@/lib/concierge/stream";
import type { ConciergeStreamEvent } from "@/lib/concierge/types";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
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
          document: body.document,
          signal: request.signal,
          onEvent: send
        })
          .then(() => controller.close())
          .catch((error) => {
            send({
              type: "error",
              message: error instanceof Error ? error.message : "The sketch could not be completed."
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
    note: "The concierge composes a visual sketch from conversation. It does not execute code or accept a commission."
  });
}
