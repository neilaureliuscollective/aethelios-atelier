import { ZodError, z } from "zod";
import { aureliusStatus } from "@/lib/aurelius/boundary";
import { conciergeRateLimited } from "@/lib/concierge/rateLimit";
import { handleError, json, readJson } from "@/lib/http";
import { LimitError } from "@/lib/domain/errors";
import { RTA_RATE_MAX } from "@/lib/rta/limits";
import { synthesizeRtaSpeech } from "@/lib/rta/speak";
import { RTA_TTS_MAX, ttsVoiceChoice } from "@/lib/rta/tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const speakSchema = z.object({
  text: z.string().trim().min(1).max(RTA_TTS_MAX),
  mode: z.enum(["rta"]).optional().default("rta")
});

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function GET() {
  const status = aureliusStatus();
  const choice = ttsVoiceChoice();
  return json({
    ok: true,
    live: status.ready,
    ...choice,
    fallback: "browser_speech"
  });
}

export async function POST(request: Request) {
  try {
    const parsed = speakSchema.parse(await readJson(request));
    if (conciergeRateLimited(`speak:${clientKey(request)}`, Date.now(), RTA_RATE_MAX)) {
      throw new LimitError("Too many spoken replies from this connection. Try again later.");
    }
    const status = aureliusStatus();
    if (!status.ready) {
      return json(
        {
          ok: false,
          error: "unavailable",
          message: "Live OpenAI speech is not authorized on this site.",
          fallback: "browser_speech"
        },
        503
      );
    }
    const audio = await synthesizeRtaSpeech(parsed.text);
    if (!audio) {
      return json(
        {
          ok: false,
          error: "unavailable",
          message: "Spoken audio could not be generated.",
          fallback: "browser_speech"
        },
        503
      );
    }
    const choice = ttsVoiceChoice();
    return new Response(Buffer.from(audio), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
        "X-Atelier-Voice": choice.voice,
        "X-Atelier-Tts-Provider": choice.provider
      }
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        { ok: false, error: "invalid", message: "That spoken reply could not be accepted." },
        400
      );
    }
    return handleError(error);
  }
}
