import { getAuthjs } from "@/lib/auth/authjs";
import { loadConfig } from "@/lib/config";
import { json } from "@/lib/http";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

async function handle(method: "GET" | "POST", request: NextRequest) {
  const config = loadConfig();
  if (config.auth.adapter !== "authjs" || !config.auth.ready) {
    return json(
      {
        ok: false,
        error: "unconfigured",
        message:
          config.auth.missing ??
          "Auth.js is not configured. Hosted sign-in stays off until Google and/or Resend credentials are set."
      },
      503
    );
  }
  const { handlers } = getAuthjs();
  return handlers[method](request);
}

export async function GET(request: NextRequest) {
  return handle("GET", request);
}

export async function POST(request: NextRequest) {
  return handle("POST", request);
}
