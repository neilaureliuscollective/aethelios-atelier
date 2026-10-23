import { LimitError } from "@/lib/domain/errors";
import { handleError, json, readJson } from "@/lib/http";
import { inquiryRateLimited } from "@/lib/inquiry/rateLimit";
import { conciergeVoiceReady, createConciergeVoiceSession } from "@/lib/concierge/voiceSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function GET() {
  return json({
    ok: true,
    ready: conciergeVoiceReady(),
    note: "Homepage orb speech is a live two-way OpenAI voice path. It does not use browser speech recognition."
  });
}

export async function POST(request: Request) {
  try {
    if (inquiryRateLimited(`voice:${clientKey(request)}`)) {
      throw new LimitError("Too many spoken sessions were started from this connection. Type, or try later.");
    }
    const body = (await readJson<{ sdp?: string }>(request)) ?? {};
    const session = await createConciergeVoiceSession(body.sdp ?? "");
    return json({ ok: true, transport: "webrtc", sdp: session.sdp, voice: session.voice });
  } catch (error) {
    return handleError(error);
  }
}
