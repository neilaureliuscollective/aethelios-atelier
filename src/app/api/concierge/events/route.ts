import { z, ZodError } from "zod";
import { isConciergeEventName, recordConciergeEvent } from "@/lib/concierge/analytics";
import { json, readJson } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().max(40),
  path: z.string().max(180).optional().default("/")
});

export async function POST(request: Request) {
  try {
    const parsed = schema.parse(await readJson(request));
    if (!isConciergeEventName(parsed.name)) {
      return json({ ok: false, error: "invalid" }, 400);
    }
    recordConciergeEvent({ name: parsed.name, path: parsed.path });
    return json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return json({ ok: false, error: "invalid" }, 400);
    }
    return json({ ok: true });
  }
}
