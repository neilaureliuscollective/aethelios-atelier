import { z } from "zod";
import { createSimulatedSession, publicUser } from "@/lib/auth/session";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await readJson(request));
    const auth = await createSimulatedSession(body.email);
    return json({
      ok: true,
      adapter: "simulated",
      labeled: true,
      user: publicUser(auth.user),
      note: "Simulated identity. Signing in does not adopt or submit a guest draft."
    });
  } catch (error) {
    return handleError(error);
  }
}
