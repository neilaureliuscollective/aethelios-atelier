import { LimitError } from "@/lib/domain/errors";
import { handleError, json } from "@/lib/http";
import { inquiryRateLimited } from "@/lib/inquiry/rateLimit";
import { TRANSCRIBE_MAX_BYTES, transcribeAudio, transcribeConfigured } from "@/lib/concierge/transcribe";

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
    ready: transcribeConfigured(),
    note: "Homepage voice transcribes speech into the talk box. It does not enable live sketch AI."
  });
}

export async function POST(request: Request) {
  try {
    if (inquiryRateLimited(`transcribe:${clientKey(request)}`)) {
      throw new LimitError("Too many voice recordings were sent from this connection. Type, or try later.");
    }
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File) || file.size < 1) {
      return json({ ok: false, error: "invalid", message: "A spoken recording is required." }, 400);
    }
    if (file.size > TRANSCRIBE_MAX_BYTES) {
      return json(
        { ok: false, error: "invalid", message: "That recording is too long. Speak a shorter thought." },
        400
      );
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const text = await transcribeAudio({
      bytes,
      type: file.type || "audio/webm",
      filename: file.name || undefined
    });
    return json({ ok: true, text });
  } catch (error) {
    return handleError(error);
  }
}
