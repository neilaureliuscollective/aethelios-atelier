import { ZodError } from "zod";
import { handleError, json, readJson } from "@/lib/http";
import { submitConciergeHandoff } from "@/lib/concierge/handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    const result = await submitConciergeHandoff(await readJson(request), { clientKey: clientKey(request) });
    if (!result.ok) {
      return json(result, result.error === "delivery_failed" ? 502 : 503);
    }
    return json(result, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        {
          ok: false,
          error: "invalid",
          message: "Your name and a reachable email are required to send this conversation."
        },
        400
      );
    }
    return handleError(error);
  }
}
