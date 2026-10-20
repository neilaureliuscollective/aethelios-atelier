import { readSession, publicUser } from "@/lib/auth/session";
import { publicRuntimeConfig } from "@/lib/config";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await readSession();
  return json({
    ok: true,
    adapter: publicRuntimeConfig().auth,
    user: auth ? publicUser(auth.user) : null
  });
}
