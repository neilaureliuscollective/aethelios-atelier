import { SERVICE_CATALOG } from "@/lib/catalog";
import { publicRuntimeConfig } from "@/lib/config";
import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    ok: true,
    ...publicRuntimeConfig(),
    catalog: SERVICE_CATALOG
  });
}
