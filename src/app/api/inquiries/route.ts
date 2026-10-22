import { ZodError } from "zod";
import { requireSession } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/domain/errors";
import { handleError, json, readJson } from "@/lib/http";
import { listFounderInquiries, submitInquiry } from "@/lib/inquiry/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}

export async function POST(request: Request) {
  try {
    const result = await submitInquiry(await readJson(request), { clientKey: clientKey(request) });
    if (!result.ok) {
      return json(result, 503);
    }
    return json(result, 201);
  } catch (error) {
    if (error instanceof ZodError) {
      return json(
        {
          ok: false,
          error: "invalid",
          message: "Name, a reachable email, and a short description of the need are required."
        },
        400
      );
    }
    return handleError(error);
  }
}

export async function GET() {
  try {
    const auth = await requireSession();
    if (auth.user.role !== "founder") {
      throw new ForbiddenError("Founder authorization is required.");
    }
    return json({ ok: true, inquiries: listFounderInquiries() });
  } catch (error) {
    return handleError(error);
  }
}
