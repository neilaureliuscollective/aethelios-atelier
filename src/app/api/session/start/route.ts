import { z } from "zod";
import { getAuthjs } from "@/lib/auth/authjs";
import { safeCallbackUrl } from "@/lib/auth/callbackUrl";
import { loadConfig } from "@/lib/config";
import { UnconfiguredError } from "@/lib/domain/errors";
import { handleError, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

const bodySchema = z.object({
  provider: z.enum(["google", "email"]),
  email: z.string().email().optional(),
  callbackUrl: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const config = loadConfig();
    if (config.auth.adapter !== "authjs" || !config.auth.ready) {
      throw new UnconfiguredError(
        config.auth.missing ??
          "Auth.js is not configured. Do not use simulated identities on a hosted platform."
      );
    }
    if (!config.persistence.ready) {
      throw new UnconfiguredError(
        "missing" in config.persistence && config.persistence.missing
          ? `Persistence is not configured. ${config.persistence.missing}`
          : "Persistence is not configured."
      );
    }
    const body = bodySchema.parse(await readJson(request));
    if (!config.auth.providers.some((provider) => provider.id === body.provider)) {
      throw new UnconfiguredError(
        body.provider === "google"
          ? "Google sign-in is not configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET."
          : "Email sign-in is not configured. Set AUTH_RESEND_KEY and AUTH_RESEND_FROM, or enable local email capture."
      );
    }
    const callbackUrl = safeCallbackUrl(body.callbackUrl);
    const { signIn } = getAuthjs();
    if (body.provider === "google") {
      const result = await signIn("google", { redirectTo: callbackUrl, redirect: false });
      const url = typeof result === "string" ? result : result?.url;
      if (!url) {
        throw new UnconfiguredError("Google sign-in could not be started.");
      }
      return json({
        ok: true,
        provider: "google",
        url,
        note: "Signing in does not adopt or submit a guest draft."
      });
    }
    if (!body.email) {
      throw new UnconfiguredError("An email address is required for the magic link.");
    }
    await signIn("email", { email: body.email, redirectTo: callbackUrl, redirect: false });
    const capture = config.auth.providers.some((provider) => provider.id === "email" && provider.capture);
    return json({
      ok: true,
      provider: "email",
      sent: !capture,
      capture,
      note: capture
        ? "A sign-in link was captured locally. This is not production email delivery."
        : "Check your email for a sign-in link. Signing in does not adopt or submit a guest draft."
    });
  } catch (error) {
    return handleError(error);
  }
}
