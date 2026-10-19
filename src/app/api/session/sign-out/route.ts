import { clearSession } from "@/lib/auth/session";
import { json } from "@/lib/http";

export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return json({ ok: true });
}
