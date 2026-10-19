const HOSTED_FLAGS = [
  "VERCEL",
  "NETLIFY",
  "FLY_APP_NAME",
  "RAILWAY_ENVIRONMENT",
  "RENDER",
  "CF_PAGES",
  "HEROKU_APP_NAME"
] as const;

type Env = Record<string, string | undefined>;

export function hostedPlatformName(env: Env = process.env): string | null {
  if (env.ATELIER_HOSTED === "true") return env.ATELIER_HOSTED_NAME || "hosted";
  for (const flag of HOSTED_FLAGS) {
    if (env[flag]) return flag.toLowerCase();
  }
  return null;
}

export function isIsolatedLocal(env: Env = process.env): boolean {
  return env.ATELIER_ISOLATED_LOCAL === "true";
}

export function simulatedAuthAllowed(env: Env = process.env): {
  allowed: boolean;
  reason?: string;
} {
  if (env.ATELIER_AUTH_ADAPTER !== "simulated") {
    return { allowed: false, reason: "ATELIER_AUTH_ADAPTER is not simulated" };
  }
  if (env.ATELIER_ALLOW_SIMULATED_AUTH !== "true") {
    return {
      allowed: false,
      reason: "Simulated auth requires ATELIER_ALLOW_SIMULATED_AUTH=true"
    };
  }
  const hosted = hostedPlatformName(env);
  if (hosted && !isIsolatedLocal(env)) {
    return {
      allowed: false,
      reason: `Simulated auth is refused on hosted platform (${hosted}). Set ATELIER_ISOLATED_LOCAL=true only for a deliberately isolated local/production-mode test — never on a public host.`
    };
  }
  return { allowed: true };
}
