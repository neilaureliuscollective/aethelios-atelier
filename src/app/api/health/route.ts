import { publicRuntimeConfig } from "@/lib/config";
import { json } from "@/lib/http";
import { getStore } from "@/lib/persistence/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = publicRuntimeConfig();
  let persistenceReachable = false;
  if (config.persistence.ready) {
    try {
      const store = await getStore();
      await store.ping();
      persistenceReachable = true;
    } catch {
      persistenceReachable = false;
    }
  }

  return json({
    ok: true,
    service: "aethelios-atelier",
    platform: config.platform,
    persistence: {
      ...config.persistence,
      reachable: persistenceReachable
    },
    auth: { adapter: config.auth.adapter, ready: config.auth.ready, labeled: config.auth.labeled },
    aurelius: config.aurelius,
    billing: config.billing,
    companion: config.companion
  });
}
