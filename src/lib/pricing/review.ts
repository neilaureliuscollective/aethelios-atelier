import "server-only";
import {
  hostedPlatformName,
  isExactLoopbackHostname,
  isIsolatedLocal,
  parseOriginHostname
} from "@/lib/runtime/hosted";

type Env = Record<string, string | undefined>;

/**
 * Local draft-pricing preview. Honored only on an isolated local machine.
 * Query parameters and ordinary client flags cannot enable this on hosted
 * platforms because this gate never reads them.
 */
export function pricingLocalReviewAllowed(env: Env = process.env): {
  allowed: boolean;
  reason?: string;
} {
  if (env.ATELIER_PRICING_LOCAL_REVIEW !== "true") {
    return { allowed: false, reason: "ATELIER_PRICING_LOCAL_REVIEW is not true" };
  }

  const hosted = hostedPlatformName(env);
  if (hosted) {
    return {
      allowed: false,
      reason: `Pricing local review is refused on hosted platform (${hosted}), even if ATELIER_PRICING_LOCAL_REVIEW is set.`
    };
  }

  if (!isIsolatedLocal(env)) {
    return {
      allowed: false,
      reason: "Pricing local review requires ATELIER_ISOLATED_LOCAL=true on a non-hosted machine."
    };
  }

  if (env.NODE_ENV === "production") {
    const hostname = parseOriginHostname(env.ATELIER_PUBLIC_ORIGIN ?? "");
    if (!isExactLoopbackHostname(hostname)) {
      return {
        allowed: false,
        reason:
          "Production-mode pricing review requires ATELIER_ISOLATED_LOCAL=true and an exact loopback hostname (localhost, 127.0.0.1, or ::1)."
      };
    }
  }

  return { allowed: true };
}

export function resolvePricingMode(env: Env = process.env): "public" | "local_review" {
  return pricingLocalReviewAllowed(env).allowed ? "local_review" : "public";
}
