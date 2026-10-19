import { publicRuntimeConfig } from "@/lib/config";
import { json } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  const config = publicRuntimeConfig();
  return json({
    ok: true,
    service: "aethelios-atelier",
    persistence: config.persistence,
    auth: { adapter: config.auth.adapter, ready: config.auth.ready, labeled: config.auth.labeled },
    aurelius: config.aurelius,
    billing: config.billing
  });
}
